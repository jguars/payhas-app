-- Payhas Plus: one monthly plan per family, 20 TMT.
--
--                     Free                       Plus
--   profiles          2 (adults included)        3 (adults included)
--   games             Quick play: 4              all 10
--   videos            30 a day per profile       no cap (the parent's limits still apply)
--   parent dashboard  today                      7-day history, top topics, recent videos
--
-- Safety never sits behind the plan: limits, quiet hours, pause, hiding and
-- flagged videos work the same on Free.
--
-- Paying: activation codes now (sold through shops, banks or operators, entered
-- by the parent behind the PIN); local card payment adds its own source later.
-- Each payment is a period in private.plus_periods; a new period starts when
-- the current one ends, so codes stack.
--
-- Families created before this keep any profiles they already have; the limit
-- only stops new ones.
--
-- Note for later migrations: get_family_dashboard, get_for_you,
-- get_following_feed and get_channel_videos are now thin public wrappers. The
-- real bodies moved to private.*_all / private.family_dashboard; change those.

-- ── plan state ──────────────────────────────────────────────────────────────
create table private.plus_periods (
  id bigint generated always as identity primary key,
  family_id uuid not null references public.families (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  source text not null check (source in ('code', 'card', 'gift')),
  ref text,
  created_at timestamptz not null default now()
);
create index plus_periods_family_idx on private.plus_periods (family_id, ends_at desc);

-- Codes are stored hashed: a leaked table can't be redeemed.
create table private.activation_codes (
  code_hash bytea primary key,
  months smallint not null default 1 check (months between 1 and 24),
  batch text not null,
  created_at timestamptz not null default now(),
  redeemed_family uuid references public.families (id) on delete set null,
  redeemed_at timestamptz
);

-- Wrong codes per family, for the rate limit (5 an hour).
create table private.code_attempts (
  family_id uuid not null references public.families (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index code_attempts_family_idx on private.code_attempts (family_id, created_at desc);

create function private.plus_until(p_family uuid)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select max(ends_at) from private.plus_periods where family_id = p_family and ends_at > now();
$$;

create function private.is_plus(p_family uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.plus_periods
                  where family_id = p_family and starts_at <= now() and ends_at > now());
$$;

create function private.profile_limit(p_family uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.is_plus(p_family) then 3 else 2 end;
$$;

-- Videos this profile may still start today; null = no cap (Plus).
-- "Today" is the household's day; a video counts once it has been on screen.
create function private.videos_left(p_profile public.profiles)
returns int
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_day_start timestamptz;
begin
  if private.is_plus(p_profile.family_id) then
    return null;
  end if;
  select time_zone into v_tz from public.families where id = p_profile.family_id;
  v_day_start := (date_trunc('day', now() at time zone v_tz)) at time zone v_tz;
  return greatest(0, 30 - (
    select count(distinct e.video_id)::int from public.video_events e
     where e.profile_id = p_profile.id and e.kind = 'impression' and e.created_at >= v_day_start));
end;
$$;

-- ── what the app reads ──────────────────────────────────────────────────────
-- The signed-in family's plan. No PIN: it only says what's unlocked, and
-- "Who's watching?" and onboarding need it for the Add tile.
create function public.get_family_plan()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_family uuid := private.my_family_id();
begin
  if v_family is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'plus', private.is_plus(v_family),
    'plus_until', private.plus_until(v_family),
    'profile_limit', private.profile_limit(v_family),
    'profiles', (select count(*) from public.profiles where family_id = v_family),
    'price_tmt', 20,
    'card_payments', false
  );
end;
$$;

-- What a profile may use right now: the games that are open and today's videos.
create function public.get_profile_plan(p_session uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles := private.session_profile(p_session);
  v_plus boolean := private.is_plus(v_profile.family_id);
begin
  return jsonb_build_object(
    'plus', v_plus,
    'games', case when v_plus then null else to_jsonb(array['bubbles', 'moles', 'catch', 'echo']) end,
    'video_cap', case when v_plus then null else 30 end,
    'videos_left', private.videos_left(v_profile)
  );
end;
$$;

-- ── activation codes ────────────────────────────────────────────────────────
-- Codes look like PAYH-7KQ2-M9XD-4TRB: 12 characters from an alphabet without
-- 0/O, 1/I/L; dashes, spaces, case and the PAYH prefix don't matter. The hash
-- covers the 12 random characters only.
create function private.code_hash(p_code text)
returns bytea
language sql
immutable
set search_path = ''
as $$
  select extensions.digest(regexp_replace(c, '^PAYH(.{12})$', '\1'), 'sha256')
    from (select regexp_replace(upper(coalesce(p_code, '')), '[^A-Z0-9]', '', 'g') as c) s;
$$;

-- 'ok' (with plus_until), 'invalid', 'used' or 'too_many'. Never raises on a
-- bad code, so the attempt is recorded.
create function public.redeem_code(p_parent uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family uuid := private.parent_family(p_parent);
  v_row private.activation_codes;
  v_from timestamptz;
begin
  if (select count(*) from private.code_attempts
       where family_id = v_family and created_at > now() - interval '1 hour') >= 5 then
    return jsonb_build_object('result', 'too_many');
  end if;

  select * into v_row from private.activation_codes where code_hash = private.code_hash(p_code) for update;
  if not found then
    insert into private.code_attempts (family_id) values (v_family);
    return jsonb_build_object('result', 'invalid');
  end if;
  if v_row.redeemed_at is not null then
    insert into private.code_attempts (family_id) values (v_family);
    return jsonb_build_object('result', 'used');
  end if;

  update private.activation_codes set redeemed_family = v_family, redeemed_at = now()
   where code_hash = v_row.code_hash;
  v_from := greatest(now(), coalesce(private.plus_until(v_family), now()));
  insert into private.plus_periods (family_id, starts_at, ends_at, source, ref)
  values (v_family, v_from, v_from + make_interval(months => v_row.months), 'code', v_row.batch);

  return jsonb_build_object('result', 'ok', 'plus_until', private.plus_until(v_family));
end;
$$;

-- For admins, in the SQL editor: a batch of new codes, shown once.
--   select * from private.create_plus_codes(100, 1, 'shop-ashgabat-2026-11');
create function private.create_plus_codes(p_count int, p_months int default 1, p_batch text default 'manual')
returns table (code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_bytes bytea;
  v_raw text;
begin
  for i in 1..least(greatest(p_count, 1), 10000) loop
    loop
      v_bytes := extensions.gen_random_bytes(12);
      v_raw := '';
      for j in 0..11 loop
        v_raw := v_raw || substr(v_alphabet, 1 + (get_byte(v_bytes, j) % 31), 1);
      end loop;
      exit when not exists (select 1 from private.activation_codes where code_hash = private.code_hash(v_raw));
    end loop;
    insert into private.activation_codes (code_hash, months, batch) values (private.code_hash(v_raw), p_months, p_batch);
    code := 'PAYH-' || substr(v_raw, 1, 4) || '-' || substr(v_raw, 5, 4) || '-' || substr(v_raw, 9, 4);
    return next;
  end loop;
end;
$$;

-- ── profile limit ───────────────────────────────────────────────────────────
create function private.enforce_profile_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.profiles where family_id = new.family_id) >= private.profile_limit(new.family_id) then
    raise exception 'plan_profile_limit' using errcode = 'P0001',
      hint = 'Free families have 2 profiles; Payhas Plus has 3.';
  end if;
  return new;
end;
$$;

create trigger enforce_profile_limit
  before insert on public.profiles
  for each row execute function private.enforce_profile_limit();

-- ── feeds: the daily cap on Free ────────────────────────────────────────────
alter function public.get_for_you(uuid, int, uuid[]) rename to get_for_you_all;
alter function public.get_for_you_all(uuid, int, uuid[]) set schema private;
alter function public.get_following_feed(uuid, int) rename to get_following_feed_all;
alter function public.get_following_feed_all(uuid, int) set schema private;
alter function public.get_channel_videos(uuid, text, int, int) rename to get_channel_videos_all;
alter function public.get_channel_videos_all(uuid, text, int, int) set schema private;
revoke all on function private.get_for_you_all(uuid, int, uuid[]) from public, anon, authenticated;
revoke all on function private.get_following_feed_all(uuid, int) from public, anon, authenticated;
revoke all on function private.get_channel_videos_all(uuid, text, int, int) from public, anon, authenticated;

create function public.get_for_you(p_session uuid, p_limit int default 15, p_exclude uuid[] default '{}')
returns setof public.videos
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_left int := private.videos_left(private.session_profile(p_session));
begin
  if v_left = 0 then
    return;
  end if;
  return query select * from private.get_for_you_all(p_session, least(p_limit, coalesce(v_left, p_limit)), p_exclude);
end;
$$;

create function public.get_following_feed(p_session uuid, p_limit int default 20)
returns setof public.videos
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_left int := private.videos_left(private.session_profile(p_session));
begin
  if v_left = 0 then
    return;
  end if;
  return query select * from private.get_following_feed_all(p_session, least(p_limit, coalesce(v_left, p_limit)));
end;
$$;

create function public.get_channel_videos(p_session uuid, p_creator text, p_limit int default 30, p_offset int default 0)
returns setof public.videos
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_left int := private.videos_left(private.session_profile(p_session));
begin
  if v_left = 0 then
    return;
  end if;
  return query select * from private.get_channel_videos_all(p_session, p_creator, least(p_limit, coalesce(v_left, p_limit)), p_offset);
end;
$$;

-- ── dashboard: today only on Free ───────────────────────────────────────────
alter function public.get_family_dashboard(uuid, text) rename to family_dashboard;
alter function public.family_dashboard(uuid, text) set schema private;
revoke all on function private.family_dashboard(uuid, text) from public, anon, authenticated;

create function public.get_family_dashboard(p_parent uuid, p_tz text default 'UTC')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_plus boolean := private.is_plus(private.parent_family(p_parent));
  v jsonb := private.family_dashboard(p_parent, p_tz);
begin
  if not v_plus then
    -- Today's bar stays (the hero card reads it); history, topics and recent go.
    v := jsonb_set(v, '{profiles}', coalesce((
      select jsonb_agg(p || jsonb_build_object(
               'week', jsonb_build_array(p -> 'week' -> (jsonb_array_length(p -> 'week') - 1)),
               'topics', '[]'::jsonb,
               'recent', '[]'::jsonb)
             order by ord)
        from jsonb_array_elements(v -> 'profiles') with ordinality as x(p, ord)
    ), '[]'::jsonb));
  end if;
  return v || jsonb_build_object('plus', v_plus);
end;
$$;

-- ── grants ──────────────────────────────────────────────────────────────────
alter table private.plus_periods enable row level security;
alter table private.activation_codes enable row level security;
alter table private.code_attempts enable row level security;
revoke all on private.plus_periods, private.activation_codes, private.code_attempts from anon, authenticated;

revoke all on function private.plus_until(uuid), private.is_plus(uuid), private.profile_limit(uuid),
  private.videos_left(public.profiles), private.code_hash(text), private.create_plus_codes(int, int, text),
  private.enforce_profile_limit() from public, anon, authenticated;

revoke all on function public.get_family_plan() from public, anon;
revoke all on function public.get_profile_plan(uuid) from public, anon;
revoke all on function public.redeem_code(uuid, text) from public, anon;
revoke all on function public.get_for_you(uuid, int, uuid[]) from public, anon;
revoke all on function public.get_following_feed(uuid, int) from public, anon;
revoke all on function public.get_channel_videos(uuid, text, int, int) from public, anon;
revoke all on function public.get_family_dashboard(uuid, text) from public, anon;

grant execute on function public.get_family_plan() to authenticated;
grant execute on function public.get_profile_plan(uuid) to authenticated;
grant execute on function public.redeem_code(uuid, text) to authenticated;
grant execute on function public.get_for_you(uuid, int, uuid[]) to authenticated;
grant execute on function public.get_following_feed(uuid, int) to authenticated;
grant execute on function public.get_channel_videos(uuid, text, int, int) to authenticated;
grant execute on function public.get_family_dashboard(uuid, text) to authenticated;
