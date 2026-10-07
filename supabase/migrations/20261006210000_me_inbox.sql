-- Payhas Phase 5: Me + Inbox.
--   • Family controls on profiles (daily limit, quiet hours) — PIN to change.
--   • Saves, follows and watch time per profile, for the Me stats and taste.
--   • An inbox fed by triggers: welcome, new videos for you, family changes.
-- Like videos, the new tables have RLS on and no policies: clients reach them
-- only through RPCs that resolve the profile from a session token.

-- ── controls ────────────────────────────────────────────────────────────────
alter table public.profiles
  add column daily_limit_minutes smallint check (daily_limit_minutes between 5 and 600),
  add column quiet_hours boolean not null default false,
  add column taste_reset_at timestamptz;

-- ── shared helpers ──────────────────────────────────────────────────────────
create function private.session_profile(p_session uuid)
returns public.profiles
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.profiles;
begin
  select p.* into v
    from private.profile_sessions s
    join public.profiles p on p.id = s.profile_id
   where s.token = p_session
     and s.owner_id = (select auth.uid())
     and s.expires_at > now();
  if not found then
    raise exception 'profile session expired' using errcode = '42501';
  end if;
  return v;
end;
$$;

-- The lane gate, once. Mirrors passesLaneGate() in algorithm/tasteEngine.ts.
create function private.video_allowed(p_lane public.lane, v public.videos)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select v.status = 'published'
     and v.lane <= p_lane
     and v.safety >= case p_lane when 'little' then 0.98 when 'kids' then 0.95 when 'teen' then 0.9 else 0.8 end
     and (p_lane <> 'little' or v.human_reviewed);
$$;

create or replace function public.get_feed(p_session uuid, p_limit int default 20, p_before timestamptz default null)
returns setof public.videos
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles := private.session_profile(p_session);
begin
  return query
    select v.* from public.videos v
     where private.video_allowed(v_profile.lane, v)
       and (p_before is null or v.published_at < p_before)
     order by v.published_at desc
     limit least(greatest(p_limit, 1), 50);
end;
$$;

-- ── library: saves, follows, watch time ─────────────────────────────────────
create table public.saves (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, video_id)
);
create index saves_video_id_idx on public.saves (video_id);

create table public.follows (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  creator_name text not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, creator_name)
);

create table public.watch_events (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  seconds int not null check (seconds between 1 and 3600),
  created_at timestamptz not null default now()
);
create index watch_events_profile_created_idx on public.watch_events (profile_id, created_at desc);
create index watch_events_video_id_idx on public.watch_events (video_id);

-- ── inbox ───────────────────────────────────────────────────────────────────
create table public.inbox_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('welcome', 'new_video', 'family')),
  title text not null,
  body text not null default '',
  video_id uuid references public.videos (id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index inbox_items_profile_created_idx on public.inbox_items (profile_id, created_at desc);
create index inbox_items_video_id_idx on public.inbox_items (video_id);

alter table public.saves enable row level security;
alter table public.follows enable row level security;
alter table public.watch_events enable row level security;
alter table public.inbox_items enable row level security;
revoke all on public.saves, public.follows, public.watch_events, public.inbox_items from anon, authenticated;

-- ── triggers that fill the inbox ────────────────────────────────────────────
create function private.inbox_welcome()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.inbox_items (profile_id, kind, title, body)
  values (new.id, 'welcome', 'Welcome, ' || new.display_name, 'Everything here is picked for your lane.');
  return new;
end;
$$;

create trigger on_profile_created
  after insert on public.profiles
  for each row execute function private.inbox_welcome();

-- A newly published video lands in the inbox of every profile it is allowed
-- for that follows its creator or picked one of its topics.
create function private.inbox_new_video()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'published' or (tg_op = 'UPDATE' and old.status = 'published') then
    return new;
  end if;

  insert into public.inbox_items (profile_id, kind, title, body, video_id)
  select p.id,
         'new_video',
         case when f.profile_id is not null then 'New from ' || new.creator_name
              else 'New in ' || coalesce((select i.label from public.interests i
                                           join public.profile_interests pi on pi.interest_slug = i.slug
                                          where pi.profile_id = p.id and i.slug = any (new.topics)
                                          order by i.sort limit 1), 'your topics') end,
         new.caption,
         new.id
    from public.profiles p
    left join public.follows f on f.profile_id = p.id and f.creator_name = new.creator_name
   where private.video_allowed(p.lane, new)
     and (f.profile_id is not null
          or exists (select 1 from public.profile_interests pi
                      where pi.profile_id = p.id and pi.interest_slug = any (new.topics)));
  return new;
end;
$$;

create trigger on_video_published
  after insert or update of status on public.videos
  for each row execute function private.inbox_new_video();

revoke all on all functions in schema private from public, anon, authenticated;

-- ── client RPCs ─────────────────────────────────────────────────────────────
create function public.toggle_save(p_session uuid, p_video_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles := private.session_profile(p_session);
begin
  delete from public.saves where profile_id = v_profile.id and video_id = p_video_id;
  if found then return false; end if;
  insert into public.saves (profile_id, video_id) values (v_profile.id, p_video_id);
  return true;
end;
$$;

create function public.toggle_follow(p_session uuid, p_creator text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles := private.session_profile(p_session);
begin
  delete from public.follows where profile_id = v_profile.id and creator_name = p_creator;
  if found then return false; end if;
  insert into public.follows (profile_id, creator_name) values (v_profile.id, p_creator);
  return true;
end;
$$;

create function public.log_watch(p_session uuid, p_video_id uuid, p_seconds int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles := private.session_profile(p_session);
begin
  if p_seconds < 1 then return; end if;
  insert into public.watch_events (profile_id, video_id, seconds)
  values (v_profile.id, p_video_id, least(p_seconds, 3600));
end;
$$;

create function public.get_library(p_session uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles := private.session_profile(p_session);
begin
  return jsonb_build_object(
    'saved', coalesce((select jsonb_agg(video_id) from public.saves where profile_id = v_profile.id), '[]'::jsonb),
    'following', coalesce((select jsonb_agg(creator_name) from public.follows where profile_id = v_profile.id), '[]'::jsonb)
  );
end;
$$;

-- Everything the Me tab shows. p_tz decides where "today" starts.
create function public.get_me(p_session uuid, p_tz text default 'UTC')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles := private.session_profile(p_session);
  v_tz text := case when exists (select 1 from pg_catalog.pg_timezone_names where name = p_tz) then p_tz else 'UTC' end;
  v_day_start timestamptz := (date_trunc('day', now() at time zone v_tz)) at time zone v_tz;
  v_since timestamptz := greatest(now() - interval '30 days', coalesce(v_profile.taste_reset_at, '-infinity'));
begin
  return jsonb_build_object(
    'today_seconds', (select coalesce(sum(seconds), 0) from public.watch_events
                       where profile_id = v_profile.id and created_at >= v_day_start),
    'saved', (select count(*) from public.saves where profile_id = v_profile.id),
    'following', (select count(*) from public.follows where profile_id = v_profile.id),
    -- Share of watch time per topic since the last reset, plus every picked
    -- interest (share 0 if unwatched) so the client can show "exploring".
    'taste', coalesce((
      with w as (
        select t.topic, e.seconds
          from public.watch_events e
          join public.videos v on v.id = e.video_id
          cross join lateral unnest(v.topics) as t(topic)
         where e.profile_id = v_profile.id and e.created_at > v_since
      ),
      shares as (
        select topic, sum(seconds)::float / nullif((select sum(seconds) from w), 0) as share
          from w group by topic
      )
      select jsonb_agg(jsonb_build_object('slug', i.slug, 'label', i.label, 'share', coalesce(s.share, 0),
                                          'picked', pi.profile_id is not null)
                       order by coalesce(s.share, 0) desc, i.sort)
        from public.interests i
        left join shares s on s.topic = i.slug
        left join public.profile_interests pi on pi.interest_slug = i.slug and pi.profile_id = v_profile.id
       where s.topic is not null or pi.profile_id is not null
    ), '[]'::jsonb)
  );
end;
$$;

create function public.reset_taste(p_session uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles := private.session_profile(p_session);
begin
  update public.profiles set taste_reset_at = now() where id = v_profile.id;
end;
$$;

-- Parent-only. Returns false on a wrong PIN (never raises, so lockout counts stick).
create function public.save_controls(p_pin text, p_profile_id uuid, p_daily_limit_minutes smallint, p_quiet_hours boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.profiles;
begin
  if not private.check_pin(p_pin) then
    return false;
  end if;

  select * into v_old from public.profiles where id = p_profile_id and family_id = private.my_family_id();
  if not found then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;

  update public.profiles
     set daily_limit_minutes = p_daily_limit_minutes, quiet_hours = p_quiet_hours
   where id = p_profile_id;

  if v_old.daily_limit_minutes is distinct from p_daily_limit_minutes then
    insert into public.inbox_items (profile_id, kind, title, body)
    values (p_profile_id, 'family',
            case when p_daily_limit_minutes is null then 'Daily limit turned off'
                 else 'Daily limit set to ' || p_daily_limit_minutes || ' min' end,
            'Set by a parent.');
  end if;
  if v_old.quiet_hours is distinct from p_quiet_hours then
    insert into public.inbox_items (profile_id, kind, title, body)
    values (p_profile_id, 'family',
            case when p_quiet_hours then 'Quiet hours on' else 'Quiet hours off' end,
            case when p_quiet_hours then 'No videos from 8pm to 7am.' else 'Set by a parent.' end);
  end if;
  return true;
end;
$$;

create function public.get_inbox(p_session uuid)
returns setof public.inbox_items
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles := private.session_profile(p_session);
begin
  return query
    select * from public.inbox_items
     where profile_id = v_profile.id
       -- A video item disappears if the video is no longer allowed (lane changed, unpublished).
       and (video_id is null or exists (select 1 from public.videos v where v.id = video_id and private.video_allowed(v_profile.lane, v)))
     order by created_at desc
     limit 50;
end;
$$;

create function public.mark_inbox_read(p_session uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles := private.session_profile(p_session);
begin
  update public.inbox_items set read_at = now() where profile_id = v_profile.id and read_at is null;
end;
$$;

revoke all on function public.toggle_save(uuid, uuid) from public, anon;
revoke all on function public.toggle_follow(uuid, text) from public, anon;
revoke all on function public.log_watch(uuid, uuid, int) from public, anon;
revoke all on function public.get_library(uuid) from public, anon;
revoke all on function public.get_me(uuid, text) from public, anon;
revoke all on function public.reset_taste(uuid) from public, anon;
revoke all on function public.save_controls(text, uuid, smallint, boolean) from public, anon;
revoke all on function public.get_inbox(uuid) from public, anon;
revoke all on function public.mark_inbox_read(uuid) from public, anon;

grant execute on function public.toggle_save(uuid, uuid) to authenticated;
grant execute on function public.toggle_follow(uuid, text) to authenticated;
grant execute on function public.log_watch(uuid, uuid, int) to authenticated;
grant execute on function public.get_library(uuid) to authenticated;
grant execute on function public.get_me(uuid, text) to authenticated;
grant execute on function public.reset_taste(uuid) to authenticated;
grant execute on function public.save_controls(text, uuid, smallint, boolean) to authenticated;
grant execute on function public.get_inbox(uuid) to authenticated;
grant execute on function public.mark_inbox_read(uuid) to authenticated;

-- ── backfill for profiles that already exist ────────────────────────────────
insert into public.inbox_items (profile_id, kind, title, body, created_at)
select id, 'welcome', 'Welcome, ' || display_name, 'Everything here is picked for your lane.', created_at
  from public.profiles;

insert into public.inbox_items (profile_id, kind, title, body, video_id, created_at)
select p.id, 'new_video',
       'New in ' || (select i.label from public.interests i
                       join public.profile_interests pi on pi.interest_slug = i.slug
                      where pi.profile_id = p.id and i.slug = any (v.topics)
                      order by i.sort limit 1),
       v.caption, v.id, v.published_at
  from public.profiles p
  join public.videos v on private.video_allowed(p.lane, v)
 where exists (select 1 from public.profile_interests pi
                where pi.profile_id = p.id and pi.interest_slug = any (v.topics));
