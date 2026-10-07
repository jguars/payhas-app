-- Payhas Phase 2: families, profiles, interests, videos, and the server-side lane gate.
--
-- Model: one Supabase auth user = one parent account = one family.
-- Everyone in the household uses the parent's session, so the database cannot
-- tell a child from a parent by auth.uid() alone. Two rules close that gap:
--   1. Profiles (and their lanes) can only be created/changed through RPCs
--      that require the parent PIN.
--   2. Videos are not selectable directly. The only read path is get_feed(),
--      which takes a profile session token; PIN-protected profiles need the
--      PIN to open a session. The lane gate mirrors passesLaneGate() in
--      algorithm/tasteEngine.ts.

create type public.lane as enum ('little', 'kids', 'teen', 'adult'); -- ordered youngest → oldest

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ── families ────────────────────────────────────────────────────────────────
create table public.families (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null default 'My family' check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now()
);

alter table public.families enable row level security;

create policy "owner reads own family" on public.families
  for select to authenticated using (owner_id = (select auth.uid()));

create policy "owner renames own family" on public.families
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

revoke insert, delete on public.families from anon, authenticated;
revoke all on public.families from anon;

-- Secrets live outside the exposed schema; no client role can read them.
create table private.family_pins (
  family_id uuid primary key references public.families (id) on delete cascade,
  pin_hash text not null,
  failed_attempts smallint not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

-- Every new auth user gets a family.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.families (owner_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ── profiles ────────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 30),
  avatar text not null default 'cat' check (char_length(avatar) <= 40),
  lane public.lane not null,
  pin_protected boolean not null default false,
  created_at timestamptz not null default now()
);

create index profiles_family_id_idx on public.profiles (family_id);

alter table public.profiles enable row level security;

create policy "family reads its profiles" on public.profiles
  for select to authenticated
  using (family_id in (select f.id from public.families f where f.owner_id = (select auth.uid())));

-- Writes go through the PIN-checked RPCs below.
revoke insert, update, delete on public.profiles from anon, authenticated;
revoke all on public.profiles from anon;

-- ── interests (cold start) ──────────────────────────────────────────────────
create table public.interests (
  slug text primary key,
  label text not null,
  emoji text not null,
  youngest_lane public.lane not null default 'little',
  sort smallint not null default 0
);

alter table public.interests enable row level security;

create policy "interests are public" on public.interests
  for select to anon, authenticated using (true);

revoke insert, update, delete on public.interests from anon, authenticated;

create table public.profile_interests (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  interest_slug text not null references public.interests (slug) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, interest_slug)
);

create index profile_interests_interest_slug_idx on public.profile_interests (interest_slug);

alter table public.profile_interests enable row level security;

create policy "family reads its interests" on public.profile_interests
  for select to authenticated
  using (profile_id in (
    select p.id from public.profiles p
    join public.families f on f.id = p.family_id
    where f.owner_id = (select auth.uid())
  ));

-- A profile can only pick interests rated for its lane.
create policy "family adds lane-appropriate interests" on public.profile_interests
  for insert to authenticated
  with check (exists (
    select 1 from public.profiles p
    join public.families f on f.id = p.family_id
    join public.interests i on i.slug = interest_slug
    where p.id = profile_id
      and f.owner_id = (select auth.uid())
      and i.youngest_lane <= p.lane
  ));

create policy "family removes its interests" on public.profile_interests
  for delete to authenticated
  using (profile_id in (
    select p.id from public.profiles p
    join public.families f on f.id = p.family_id
    where f.owner_id = (select auth.uid())
  ));

revoke update on public.profile_interests from anon, authenticated;
revoke all on public.profile_interests from anon;

-- ── videos ──────────────────────────────────────────────────────────────────
create table public.videos (
  id uuid primary key default gen_random_uuid(),
  asset_key text unique, -- local bundled asset until Phase 3 hosting exists
  creator_name text not null,
  creator_verified boolean not null default false,
  caption text not null default '',
  lane public.lane not null, -- youngest lane the video is rated for
  safety real not null check (safety between 0 and 1),
  human_reviewed boolean not null default false,
  topics text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'published', 'rejected')),
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create index videos_feed_idx on public.videos (lane, published_at desc) where status = 'published';

-- RLS on with no policies: clients cannot select videos directly.
alter table public.videos enable row level security;
revoke all on public.videos from anon, authenticated;

-- ── profile sessions ────────────────────────────────────────────────────────
create table private.profile_sessions (
  token uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '30 days'
);

create index profile_sessions_profile_id_idx on private.profile_sessions (profile_id);
create index profile_sessions_owner_id_idx on private.profile_sessions (owner_id);

-- ── helpers (private, not callable by clients) ──────────────────────────────
create function private.my_family_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.families where owner_id = (select auth.uid());
$$;

-- Checks the PIN with a lockout: 5 wrong tries → 15 minutes.
-- Callers must return (not raise) on a wrong PIN, or the attempt count rolls back.
create function private.check_pin(p_pin text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family uuid := private.my_family_id();
  v_row private.family_pins;
begin
  if v_family is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  select * into v_row from private.family_pins where family_id = v_family for update;
  if not found then
    raise exception 'parent PIN not set' using errcode = 'P0001';
  end if;
  if v_row.locked_until is not null and v_row.locked_until > now() then
    raise exception 'PIN locked, try again later' using errcode = 'P0001';
  end if;

  if v_row.pin_hash = extensions.crypt(p_pin, v_row.pin_hash) then
    update private.family_pins set failed_attempts = 0, locked_until = null where family_id = v_family;
    return true;
  end if;

  update private.family_pins
     set failed_attempts = failed_attempts + 1,
         locked_until = case when failed_attempts + 1 >= 5 then now() + interval '15 minutes' end
   where family_id = v_family;
  return false;
end;
$$;

revoke all on all functions in schema private from public, anon, authenticated;

-- ── client RPCs ─────────────────────────────────────────────────────────────
-- First call sets the PIN. Changing it requires the current one.
create function public.set_parent_pin(p_new_pin text, p_current_pin text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family uuid := private.my_family_id();
begin
  if v_family is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_new_pin !~ '^[0-9]{4}$' then
    raise exception 'PIN must be 4 digits' using errcode = '22023';
  end if;
  if exists (select 1 from private.family_pins where family_id = v_family) then
    if p_current_pin is null or not private.check_pin(p_current_pin) then
      return false;
    end if;
  end if;

  insert into private.family_pins (family_id, pin_hash)
  values (v_family, extensions.crypt(p_new_pin, extensions.gen_salt('bf')))
  on conflict (family_id) do update
    set pin_hash = excluded.pin_hash, failed_attempts = 0, locked_until = null, updated_at = now();
  return true;
end;
$$;

create function public.has_parent_pin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from private.family_pins where family_id = private.my_family_id());
$$;

create function public.verify_parent_pin(p_pin text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select private.check_pin(p_pin);
$$;

-- Create (p_profile_id null) or update a profile. Always needs the PIN; returns null if wrong.
create function public.save_profile(
  p_pin text,
  p_display_name text,
  p_lane public.lane,
  p_avatar text default 'cat',
  p_pin_protected boolean default null,
  p_profile_id uuid default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family uuid := private.my_family_id();
  v_row public.profiles;
begin
  if not private.check_pin(p_pin) then
    return null;
  end if;

  if p_profile_id is null then
    if (select count(*) from public.profiles where family_id = v_family) >= 6 then
      raise exception 'a family can have at most 6 profiles' using errcode = 'P0001';
    end if;
    insert into public.profiles (family_id, display_name, avatar, lane, pin_protected)
    values (v_family, p_display_name, p_avatar, p_lane, coalesce(p_pin_protected, p_lane = 'adult'))
    returning * into v_row;
  else
    update public.profiles
       set display_name = p_display_name,
           avatar = p_avatar,
           lane = p_lane,
           pin_protected = coalesce(p_pin_protected, pin_protected)
     where id = p_profile_id and family_id = v_family
    returning * into v_row;
    if not found then
      raise exception 'profile not found' using errcode = 'P0002';
    end if;
    -- A lane change invalidates open sessions for that profile.
    delete from private.profile_sessions where profile_id = p_profile_id;
  end if;

  return v_row;
end;
$$;

create function public.delete_profile(p_pin text, p_profile_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.check_pin(p_pin) then
    return false;
  end if;
  delete from public.profiles where id = p_profile_id and family_id = private.my_family_id();
  return true;
end;
$$;

-- "Who's watching?" → returns a session token for get_feed(), or null on a wrong PIN.
create function public.start_profile_session(p_profile_id uuid, p_pin text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_token uuid;
begin
  select * into v_profile from public.profiles
   where id = p_profile_id and family_id = private.my_family_id();
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

-- The only way to read videos. Mirrors passesLaneGate() in tasteEngine.ts:
-- the lane gate is a rule, never a weight.
create function public.get_feed(p_session uuid, p_limit int default 20, p_before timestamptz default null)
returns setof public.videos
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_lane public.lane;
  v_min_safety real;
begin
  select p.lane into v_lane
    from private.profile_sessions s
    join public.profiles p on p.id = s.profile_id
   where s.token = p_session
     and s.owner_id = (select auth.uid())
     and s.expires_at > now();
  if v_lane is null then
    raise exception 'profile session expired' using errcode = '42501';
  end if;

  v_min_safety := case v_lane
    when 'little' then 0.98
    when 'kids' then 0.95
    when 'teen' then 0.9
    else 0.8
  end;

  return query
    select v.* from public.videos v
     where v.status = 'published'
       and v.lane <= v_lane
       and v.safety >= v_min_safety
       and (v_lane <> 'little' or v.human_reviewed)
       and (p_before is null or v.published_at < p_before)
     order by v.published_at desc
     limit least(greatest(p_limit, 1), 50);
end;
$$;

revoke all on function public.set_parent_pin(text, text) from public, anon;
revoke all on function public.has_parent_pin() from public, anon;
revoke all on function public.verify_parent_pin(text) from public, anon;
revoke all on function public.save_profile(text, text, public.lane, text, boolean, uuid) from public, anon;
revoke all on function public.delete_profile(text, uuid) from public, anon;
revoke all on function public.start_profile_session(uuid, text) from public, anon;
revoke all on function public.get_feed(uuid, int, timestamptz) from public, anon;

grant execute on function public.set_parent_pin(text, text) to authenticated;
grant execute on function public.has_parent_pin() to authenticated;
grant execute on function public.verify_parent_pin(text) to authenticated;
grant execute on function public.save_profile(text, text, public.lane, text, boolean, uuid) to authenticated;
grant execute on function public.delete_profile(text, uuid) to authenticated;
grant execute on function public.start_profile_session(uuid, text) to authenticated;
grant execute on function public.get_feed(uuid, int, timestamptz) to authenticated;

-- ── seed ────────────────────────────────────────────────────────────────────
insert into public.interests (slug, label, emoji, youngest_lane, sort) values
  ('animals',  'Animals',  '🐾', 'little', 1),
  ('rhymes',   'Rhymes',   '🎵', 'little', 2),
  ('stories',  'Stories',  '📖', 'little', 3),
  ('play',     'Play',     '🧸', 'little', 4),
  ('puppets',  'Puppets',  '🧦', 'little', 5),
  ('learning', 'Learning', '🔤', 'little', 6),
  ('drawing',  'Drawing',  '🖍️', 'kids',   7),
  ('science',  'Science',  '🔬', 'kids',   8),
  ('sports',   'Sports',   '⚽', 'kids',   9),
  ('building', 'Building', '🧱', 'kids',  10),
  ('gaming',   'Gaming',   '🎮', 'kids',  11),
  ('music',    'Music',    '🎸', 'teen',  12),
  ('fashion',  'Fashion',  '👟', 'teen',  13),
  ('comedy',   'Comedy',   '😂', 'teen',  14),
  ('cooking',  'Cooking',  '🍳', 'teen',  15),
  ('news',     'News',     '📰', 'adult', 16);

insert into public.videos (asset_key, creator_name, creator_verified, caption, lane, safety, human_reviewed, topics, status, published_at) values
  ('eyes-rhyme', 'Children Rhymes',  true,  'Where are your eyes? Point along and sing!',        'little', 0.99, true, '{rhymes,learning}', 'published', now() - interval '3 hours'),
  ('playground', 'Chubby Playhouse', true,  'Water-balloon day — who''s going to giggle first?', 'little', 0.99, true, '{play,stories}',    'published', now() - interval '2 hours'),
  ('bunny',      'Benny the Bunny',  false, 'Benny says hi from the card shop!',                 'little', 0.99, true, '{animals,puppets}', 'published', now() - interval '1 hour');
