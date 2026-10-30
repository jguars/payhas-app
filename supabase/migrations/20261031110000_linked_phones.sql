-- Linked phones: each family member can use Payhas on their own phone.
--
-- The parent's account stays the family. Another phone joins with a 6-digit
-- code made on the parent's dashboard (10 minutes, once), then waits until
-- the parent taps Allow. A joined phone is its own auth user (created by the
-- `join-family` edge function), recorded in public.family_devices:
--   kind 'child'  → locked to one profile: sees and opens only that profile;
--   kind 'shared' → "Who's watching?" for the whole family, like the parent's phone.
-- Neither can open the parent dashboard: parent sessions still need the
-- family owner's own sign-in. Removing a phone deletes its auth user, which
-- ends its profile sessions at once.
--
-- How it plugs in: private.my_family_id() now also answers for an allowed
-- phone, and the read policies on families / profiles / interests use it, so
-- everything the app reads at launch works on a linked phone unchanged.
-- Profile sessions were already tied to whoever opened them.

-- ── tables ──────────────────────────────────────────────────────────────────
create table public.family_devices (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('child', 'shared')),
  name text not null default 'Phone' check (char_length(name) between 1 and 60),
  status text not null default 'pending' check (status in ('pending', 'active')),
  code_id uuid,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  last_seen_at timestamptz,
  check ((kind = 'child') = (profile_id is not null))
);
create index family_devices_family_idx on public.family_devices (family_id);

alter table public.family_devices enable row level security;
-- Only through the functions below.
revoke all on public.family_devices from anon, authenticated;

create table private.link_codes (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete cascade,
  code text not null check (code ~ '^[0-9]{6}$'),
  expires_at timestamptz not null default now() + interval '10 minutes',
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index link_codes_unused on private.link_codes (code) where used_at is null;

-- Wrong-code tries from the join-family function, to slow down guessing.
create table private.join_attempts (
  ip text not null,
  at timestamptz not null default now()
);
create index join_attempts_ip_at on private.join_attempts (ip, at);

-- A joined phone is an auth user too, but it belongs to an existing family:
-- the new-user trigger makes no family for it (join-family's alias emails).
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email like '%@devices.payhas.invalid' then
    return new;
  end if;
  insert into public.families (owner_id) values (new.id);
  return new;
end;
$$;

-- For the join-family edge function only (service role): counts wrong tries
-- per IP and claims a live code in one statement, so two phones can't share it.
-- Returns {state: ok|bad_code|too_many, code_id, family_id, profile_id}.
create function public.claim_link_code(p_code text, p_ip text)
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
  update private.link_codes set used_at = now()
   where code = p_code and used_at is null and expires_at > now()
  returning * into v;
  if not found then
    insert into private.join_attempts (ip) values (p_ip);
    delete from private.join_attempts where at < now() - interval '1 day';
    return jsonb_build_object('state', 'bad_code');
  end if;
  return jsonb_build_object('state', 'ok', 'code_id', v.id, 'family_id', v.family_id, 'profile_id', v.profile_id);
end;
$$;
revoke all on function public.claim_link_code(text, text) from public, anon, authenticated;
grant execute on function public.claim_link_code(text, text) to service_role;

-- ── who is asking ─────────────────────────────────────────────────────────────
create or replace function private.my_family_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select id from public.families where owner_id = (select auth.uid())),
    (select family_id from public.family_devices where user_id = (select auth.uid()) and status = 'active')
  );
$$;

-- The one profile a child's phone is locked to; null for the parent's own and shared phones.
create function private.my_device_profile()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select profile_id from public.family_devices
   where user_id = (select auth.uid()) and status = 'active' and kind = 'child';
$$;

grant execute on function private.my_family_id(), private.my_device_profile() to authenticated;

-- ── read policies: the family's own rows, from any of its phones ─────────────
drop policy "owner reads own family" on public.families;
create policy "family reads own family" on public.families
  for select to authenticated
  using (id = (select private.my_family_id()));

drop policy "family reads its profiles" on public.profiles;
create policy "family reads its profiles" on public.profiles
  for select to authenticated
  using (
    family_id = (select private.my_family_id())
    and ((select private.my_device_profile()) is null or id = (select private.my_device_profile()))
  );

drop policy "family reads its interests" on public.profile_interests;
create policy "family reads its interests" on public.profile_interests
  for select to authenticated
  using (profile_id in (select p.id from public.profiles p where p.family_id = (select private.my_family_id())));

drop policy "family adds lane-appropriate interests" on public.profile_interests;
create policy "family adds lane-appropriate interests" on public.profile_interests
  for insert to authenticated
  with check (exists (
    select 1 from public.profiles p
    join public.interests i on i.slug = interest_slug
    where p.id = profile_id
      and p.family_id = (select private.my_family_id())
      and ((select private.my_device_profile()) is null or p.id = (select private.my_device_profile()))
      and i.youngest_lane <= p.lane
  ));

drop policy "family removes its interests" on public.profile_interests;
create policy "family removes its interests" on public.profile_interests
  for delete to authenticated
  using (profile_id in (
    select p.id from public.profiles p
    where p.family_id = (select private.my_family_id())
      and ((select private.my_device_profile()) is null or p.id = (select private.my_device_profile()))
  ));

-- ── profile sessions: a child's phone opens only its own profile ─────────────
create or replace function public.start_profile_session(p_profile_id uuid, p_pin text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_token uuid;
  v_locked uuid := private.my_device_profile();
begin
  select * into v_profile from public.profiles
   where id = p_profile_id and family_id = private.my_family_id()
     and (v_locked is null or id = v_locked);
  if not found then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;

  if v_profile.pin_protected and (p_pin is null or not private.check_pin(p_pin)) then
    return null;
  end if;

  delete from private.profile_sessions where owner_id = (select auth.uid()) and expires_at < now();
  insert into private.profile_sessions (profile_id, owner_id)
  values (v_profile.id, (select auth.uid()))
  returning token into v_token;
  return v_token;
end;
$$;

-- ── parent side ──────────────────────────────────────────────────────────────
/** A fresh 6-digit code for one child's phone (p_profile) or a shared phone (null). */
create function public.create_link_code(p_parent uuid, p_profile uuid default null)
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
  if p_profile is not null and not exists (select 1 from public.profiles where id = p_profile and family_id = v_family) then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;
  -- One live code per phone being linked; old and expired ones go.
  delete from private.link_codes
   where used_at is null
     and (expires_at < now() or (family_id = v_family and profile_id is not distinct from p_profile));
  loop
    v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
    begin
      insert into private.link_codes (family_id, profile_id, code) values (v_family, p_profile, v_code) returning * into v_row;
      exit;
    exception when unique_violation then
      -- Another family holds this code right now; draw again.
    end;
  end loop;
  return jsonb_build_object('id', v_row.id, 'code', v_row.code, 'expires_at', v_row.expires_at);
end;
$$;

/** Has a phone used this code yet? waiting · joined (with the phone) · expired. */
create function public.link_code_status(p_parent uuid, p_code_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_family uuid := private.parent_family(p_parent);
  v_code private.link_codes;
  v_device public.family_devices;
begin
  select * into v_code from private.link_codes where id = p_code_id and family_id = v_family;
  if not found then
    return jsonb_build_object('state', 'expired');
  end if;
  if v_code.used_at is null then
    return jsonb_build_object('state', case when v_code.expires_at < now() then 'expired' else 'waiting' end);
  end if;
  select * into v_device from public.family_devices where code_id = v_code.id;
  if not found then
    return jsonb_build_object('state', 'expired');
  end if;
  return jsonb_build_object('state', case when v_device.status = 'active' then 'allowed' else 'joined' end,
    'device', jsonb_build_object('id', v_device.id, 'name', v_device.name));
end;
$$;

/** Allow a phone that joined, or turn it away (which deletes it). */
create function public.answer_device(p_parent uuid, p_device uuid, p_allow boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family uuid := private.parent_family(p_parent);
  v_user uuid;
begin
  if p_allow then
    update public.family_devices set status = 'active', approved_at = now()
     where id = p_device and family_id = v_family and status = 'pending';
    return found;
  end if;
  select user_id into v_user from public.family_devices where id = p_device and family_id = v_family;
  if v_user is null then
    return false;
  end if;
  delete from auth.users where id = v_user; -- cascades to the device row and its sessions
  return true;
end;
$$;

/** The family's linked phones, newest first. */
create function public.list_devices(p_parent uuid)
returns table (id uuid, name text, kind text, status text, profile_id uuid, profile_name text, last_seen_at timestamptz, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.name, d.kind, d.status, d.profile_id, p.display_name, d.last_seen_at, d.created_at
    from public.family_devices d
    left join public.profiles p on p.id = d.profile_id
   where d.family_id = private.parent_family(p_parent)
   order by d.created_at desc;
$$;

/** Remove a phone: it's signed out everywhere at once and needs a new code to come back. */
create function public.remove_device(p_parent uuid, p_device uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  select user_id into v_user from public.family_devices where id = p_device and family_id = private.parent_family(p_parent);
  if v_user is null then
    return false;
  end if;
  delete from private.profile_sessions where owner_id = v_user;
  delete from auth.users where id = v_user;
  return true;
end;
$$;

-- ── the linked phone itself ──────────────────────────────────────────────────
/** What this phone is in the family, if anything; also marks it as seen. Null on the parent's own phone. */
create function public.my_device()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.family_devices;
begin
  update public.family_devices set last_seen_at = now() where user_id = (select auth.uid()) returning * into v;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'id', v.id, 'kind', v.kind, 'status', v.status, 'profile_id', v.profile_id,
    'profile_name', (select display_name from public.profiles where id = v.profile_id),
    'parent_name', (select display_name from public.profiles where family_id = v.family_id and is_parent)
  );
end;
$$;

revoke all on function public.create_link_code(uuid, uuid), public.link_code_status(uuid, uuid), public.answer_device(uuid, uuid, boolean),
  public.list_devices(uuid), public.remove_device(uuid, uuid), public.my_device() from public, anon;
grant execute on function public.create_link_code(uuid, uuid), public.link_code_status(uuid, uuid), public.answer_device(uuid, uuid, boolean),
  public.list_devices(uuid), public.remove_device(uuid, uuid), public.my_device() to authenticated;
