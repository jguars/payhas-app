-- Co-parents, and a child's phone that can leave or delete its account.
--
-- A co-parent is another grown-up with their own login (their own phone
-- number) who runs the family alongside the owner: dashboard, rules, Who's
-- watching, with the family's parent PIN. They join like a phone does — a
-- code from the parent's Phones list, then Allow — but the code is a
-- 'coparent' code, and the join also confirms their number (join-family).
-- They're a family_devices row of kind 'coparent' carrying that number, so
-- phone-auth can sign them back in later.
--
-- Also closes two gaps linked phones opened: a parent session now needs the
-- owner or a co-parent (not just the PIN), and delete_profile on a child's
-- phone can only reach that child.

-- ── co-parent rows ───────────────────────────────────────────────────────────
alter table public.family_devices drop constraint family_devices_kind_check;
alter table public.family_devices add constraint family_devices_kind_check check (kind in ('child', 'shared', 'coparent'));
alter table public.family_devices add column phone text unique check (phone ~ '^\+993[0-9]{8}$');
alter table public.family_devices add constraint family_devices_coparent_phone check ((kind = 'coparent') = (phone is not null));

alter table private.link_codes add column kind text not null default 'device' check (kind in ('device', 'coparent'));
alter table private.link_codes add constraint link_codes_coparent_no_profile check (kind = 'device' or profile_id is null);

-- A co-parent's account is created to join a family, so it gets none of its own.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email like '%@devices.payhas.invalid' or new.raw_user_meta_data ->> 'joins_family' = 'true' then
    return new;
  end if;
  insert into public.families (owner_id) values (new.id);
  return new;
end;
$$;

-- ── who runs the family ──────────────────────────────────────────────────────
-- The family a user is a parent of: as its owner, or as an allowed co-parent.
create function private.parent_family_of(p_user uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select id from public.families where owner_id = p_user),
    (select family_id from public.family_devices where user_id = p_user and kind = 'coparent' and status = 'active')
  );
$$;

create or replace function private.my_family_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    private.parent_family_of((select auth.uid())),
    (select family_id from public.family_devices where user_id = (select auth.uid()) and status = 'active')
  );
$$;

create or replace function private.parent_family(p_parent uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v uuid;
begin
  select private.parent_family_of(s.owner_id) into v
    from private.parent_sessions s
   where s.token = p_parent and s.owner_id = (select auth.uid()) and s.expires_at > now();
  if v is null then
    raise exception 'parent session expired' using errcode = '42501';
  end if;
  return v;
end;
$$;

-- The PIN alone no longer opens the dashboard: a child's or shared phone that knows it still can't.
create or replace function public.start_parent_session(p_pin text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v uuid;
begin
  if private.parent_family_of((select auth.uid())) is null then
    raise exception 'not a parent of this family' using errcode = '42501';
  end if;
  if not private.check_pin(p_pin) then
    return null;
  end if;
  delete from private.parent_sessions where owner_id = (select auth.uid()) and expires_at < now();
  insert into private.parent_sessions (owner_id) values ((select auth.uid())) returning token into v;
  return v;
end;
$$;

-- A child's phone can only ever delete its own child.
create or replace function public.delete_profile(p_pin text, p_profile_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_locked uuid := private.my_device_profile();
begin
  if not private.check_pin(p_pin) then
    return false;
  end if;
  delete from public.profiles
   where id = p_profile_id and family_id = private.my_family_id()
     and (v_locked is null or id = v_locked);
  return true;
end;
$$;

create or replace function public.set_family_language(p_language text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.families set language = p_language
   where id = private.parent_family_of((select auth.uid())) and p_language in ('en', 'tk', 'tr', 'ru');
$$;

-- ── codes ────────────────────────────────────────────────────────────────────
drop function public.create_link_code(uuid, uuid);
/** A fresh 6-digit code: a child's phone (p_profile), a shared phone, or a co-parent (p_kind 'coparent'). */
create function public.create_link_code(p_parent uuid, p_profile uuid default null, p_kind text default 'device')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family uuid := private.parent_family(p_parent);
  v_code text;
  v_row private.link_codes;
begin
  if p_kind not in ('device', 'coparent') or (p_kind = 'coparent' and p_profile is not null) then
    raise exception 'bad kind' using errcode = '22023';
  end if;
  if p_profile is not null and not exists (select 1 from public.profiles where id = p_profile and family_id = v_family) then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;
  delete from private.link_codes
   where used_at is null
     and (expires_at < now() or (family_id = v_family and profile_id is not distinct from p_profile and kind = p_kind));
  loop
    v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
    begin
      insert into private.link_codes (family_id, profile_id, code, kind) values (v_family, p_profile, v_code, p_kind) returning * into v_row;
      exit;
    exception when unique_violation then
    end;
  end loop;
  return jsonb_build_object('id', v_row.id, 'code', v_row.code, 'expires_at', v_row.expires_at, 'kind', v_row.kind);
end;
$$;

drop function public.claim_link_code(text, text);
-- join-family only (service role). A co-parent code isn't used up until the
-- number comes with it: without one the answer is needs_phone, and a number
-- that already has a family (or is already a co-parent) is phone_taken.
create function public.claim_link_code(p_code text, p_ip text, p_phone text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v private.link_codes;
begin
  if (select count(*) from private.join_attempts where ip = p_ip and at > now() - interval '10 minutes') >= 10 then
    return jsonb_build_object('state', 'too_many');
  end if;
  select * into v from private.link_codes where code = p_code and used_at is null and expires_at > now();
  if not found then
    insert into private.join_attempts (ip) values (p_ip);
    delete from private.join_attempts where at < now() - interval '1 day';
    return jsonb_build_object('state', 'bad_code');
  end if;
  if v.kind = 'coparent' then
    if p_phone is null then
      return jsonb_build_object('state', 'needs_phone');
    end if;
    if exists (select 1 from public.families where phone = p_phone) or exists (select 1 from public.family_devices where phone = p_phone) then
      return jsonb_build_object('state', 'phone_taken');
    end if;
  end if;
  update private.link_codes set used_at = now() where id = v.id and used_at is null;
  if not found then
    return jsonb_build_object('state', 'bad_code');
  end if;
  return jsonb_build_object('state', 'ok', 'kind', v.kind, 'code_id', v.id, 'family_id', v.family_id, 'profile_id', v.profile_id);
end;
$$;
revoke all on function public.claim_link_code(text, text, text) from public, anon, authenticated;
grant execute on function public.claim_link_code(text, text, text) to service_role;

drop function public.list_devices(uuid);
create function public.list_devices(p_parent uuid)
returns table (id uuid, name text, kind text, status text, profile_id uuid, profile_name text, phone text, last_seen_at timestamptz, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.name, d.kind, d.status, d.profile_id, p.display_name, d.phone, d.last_seen_at, d.created_at
    from public.family_devices d
    left join public.profiles p on p.id = d.profile_id
   where d.family_id = private.parent_family(p_parent)
   order by d.created_at desc;
$$;

-- ── a linked phone leaving ────────────────────────────────────────────────────
/** "Sign out of this phone": the phone leaves the family; a new code links it again. */
create function public.leave_family_phone()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.family_devices where user_id = (select auth.uid()) and kind in ('child', 'shared')) then
    return false;
  end if;
  delete from private.profile_sessions where owner_id = (select auth.uid());
  delete from auth.users where id = (select auth.uid());
  return true;
end;
$$;

/** "Delete my account" on a child's phone: with the parent PIN, the child's profile and data go, and the phone leaves. */
create function public.delete_my_profile(p_pin text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile uuid := private.my_device_profile();
begin
  if v_profile is null then
    raise exception 'not a child''s phone' using errcode = '42501';
  end if;
  if not private.check_pin(p_pin) then
    return false;
  end if;
  delete from public.profiles where id = v_profile;
  delete from private.profile_sessions where owner_id = (select auth.uid());
  delete from auth.users where id = (select auth.uid());
  return true;
end;
$$;

revoke all on function private.parent_family_of(uuid) from public, anon, authenticated;
revoke all on function public.create_link_code(uuid, uuid, text), public.list_devices(uuid), public.leave_family_phone(), public.delete_my_profile(text) from public, anon;
grant execute on function public.create_link_code(uuid, uuid, text), public.list_devices(uuid), public.leave_family_phone(), public.delete_my_profile(text) to authenticated;
