-- Payhas Phase 6a: parent dashboard + remote control.
--
-- Every device in a household signs in with the parent's account, so "remote"
-- means the parent's phone changing what the child's tablet allows, live:
--   • A parent session: one PIN entry opens 15 minutes of dashboard access,
--     instead of a PIN per change.
--   • New controls on profiles: pause now, extra time today, custom bedtime,
--     games on/off. Children's devices hear changes over Realtime (profiles is
--     already readable by the family, so postgres_changes respects RLS).
--   • Presence: child devices ping their session; the dashboard shows who is
--     watching or playing right now.
--   • get_family_dashboard(): today, the last 7 days, top topics, recent videos
--     and anything the child flagged, for every child profile.

-- ── controls ────────────────────────────────────────────────────────────────
alter table public.profiles
  add column paused boolean not null default false,
  add column bedtime_hour smallint not null default 20 check (bedtime_hour between 0 and 23),
  add column wake_hour smallint not null default 7 check (wake_hour between 0 and 23),
  add column games_enabled boolean not null default true,
  add column extra_minutes smallint not null default 0 check (extra_minutes between 0 and 240),
  add column extra_until timestamptz;

-- ── presence ────────────────────────────────────────────────────────────────
alter table private.profile_sessions
  add column last_seen_at timestamptz,
  add column last_activity text check (last_activity in ('watching', 'playing', 'browsing'));

create function public.ping_session(p_session uuid, p_activity text default 'browsing')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.profile_sessions
     set last_seen_at = now(),
         last_activity = case when p_activity in ('watching', 'playing', 'browsing') then p_activity else 'browsing' end
   where token = p_session and owner_id = (select auth.uid()) and expires_at > now();
end;
$$;

-- ── parent sessions ─────────────────────────────────────────────────────────
create table private.parent_sessions (
  token uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '15 minutes'
);
create index parent_sessions_owner_id_idx on private.parent_sessions (owner_id);

-- The family a live parent session belongs to; raises when it has expired.
create function private.parent_family(p_parent uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v uuid;
begin
  select f.id into v
    from private.parent_sessions s
    join public.families f on f.owner_id = s.owner_id
   where s.token = p_parent and s.owner_id = (select auth.uid()) and s.expires_at > now();
  if v is null then
    raise exception 'parent session expired' using errcode = '42501';
  end if;
  return v;
end;
$$;

-- A child profile of this parent session's family, or raise.
create function private.parent_child(p_parent uuid, p_profile_id uuid)
returns public.profiles
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.profiles;
begin
  select * into v from public.profiles where id = p_profile_id and family_id = private.parent_family(p_parent);
  if not found then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;
  return v;
end;
$$;

-- Only the storage helpers in private stay callable (pipeline migration).
revoke all on function private.parent_family(uuid), private.parent_child(uuid, uuid) from public, anon, authenticated;

-- Wrong PIN → null (never raises, so the lockout count sticks).
create function public.start_parent_session(p_pin text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v uuid;
begin
  if not private.check_pin(p_pin) then
    return null;
  end if;
  delete from private.parent_sessions where owner_id = (select auth.uid()) and expires_at < now();
  insert into private.parent_sessions (owner_id) values ((select auth.uid())) returning token into v;
  return v;
end;
$$;

create function public.end_parent_session(p_parent uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.parent_sessions where token = p_parent and owner_id = (select auth.uid());
$$;

-- ── remote controls ─────────────────────────────────────────────────────────
create function public.set_profile_controls(
  p_parent uuid,
  p_profile_id uuid,
  p_daily_limit_minutes smallint,
  p_quiet_hours boolean,
  p_bedtime_hour smallint,
  p_wake_hour smallint,
  p_games_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.profiles := private.parent_child(p_parent, p_profile_id);
  v_fmt text;
begin
  update public.profiles
     set daily_limit_minutes = p_daily_limit_minutes,
         quiet_hours = p_quiet_hours,
         bedtime_hour = p_bedtime_hour,
         wake_hour = p_wake_hour,
         games_enabled = p_games_enabled
   where id = p_profile_id;

  if v_old.daily_limit_minutes is distinct from p_daily_limit_minutes then
    insert into public.inbox_items (profile_id, kind, title, body)
    values (p_profile_id, 'family',
            case when p_daily_limit_minutes is null then 'Daily limit turned off'
                 else 'Daily limit set to ' || p_daily_limit_minutes || ' min' end,
            'Set by a parent.');
  end if;
  if v_old.quiet_hours is distinct from p_quiet_hours
     or (p_quiet_hours and (v_old.bedtime_hour, v_old.wake_hour) is distinct from (p_bedtime_hour, p_wake_hour)) then
    v_fmt := to_char(make_time(p_bedtime_hour, 0, 0), 'FMHH12am') || ' to ' || to_char(make_time(p_wake_hour, 0, 0), 'FMHH12am');
    insert into public.inbox_items (profile_id, kind, title, body)
    values (p_profile_id, 'family',
            case when p_quiet_hours then 'Quiet hours: ' || v_fmt else 'Quiet hours off' end,
            case when p_quiet_hours then 'No videos or games overnight.' else 'Set by a parent.' end);
  end if;
  if v_old.games_enabled is distinct from p_games_enabled then
    insert into public.inbox_items (profile_id, kind, title, body)
    values (p_profile_id, 'family', case when p_games_enabled then 'Games are on' else 'Games are off for now' end, 'Set by a parent.');
  end if;
end;
$$;

create function public.set_profile_paused(p_parent uuid, p_profile_id uuid, p_paused boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.profiles := private.parent_child(p_parent, p_profile_id);
begin
  if v_old.paused = p_paused then return; end if;
  update public.profiles set paused = p_paused where id = p_profile_id;
  insert into public.inbox_items (profile_id, kind, title, body)
  values (p_profile_id, 'family',
          case when p_paused then 'Paused by a parent' else 'You''re back on' end,
          case when p_paused then 'Time for something else.' else 'A parent un-paused Payhas.' end);
end;
$$;

-- Adds minutes on top of today's limit. p_until is the end of the child's day
-- (the parent's device passes local midnight; a household shares a time zone).
create function public.grant_extra_time(p_parent uuid, p_profile_id uuid, p_minutes smallint, p_until timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.profiles := private.parent_child(p_parent, p_profile_id);
begin
  if p_minutes not between 5 and 120 or p_until <= now() or p_until > now() + interval '25 hours' then
    raise exception 'invalid extra time' using errcode = '22023';
  end if;
  update public.profiles
     set extra_minutes = least(240, case when extra_until > now() then extra_minutes else 0 end + p_minutes),
         extra_until = p_until
   where id = p_profile_id;
  insert into public.inbox_items (profile_id, kind, title, body)
  values (p_profile_id, 'family', p_minutes || ' more minutes today', 'A gift from a parent.');
end;
$$;

-- Hides one video from one child (same table the child's own "Not for me" uses).
create function public.parent_hide_video(p_parent uuid, p_profile_id uuid, p_video_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_child public.profiles := private.parent_child(p_parent, p_profile_id);
begin
  insert into public.hidden_videos (profile_id, video_id) values (v_child.id, p_video_id) on conflict do nothing;
end;
$$;

-- ── dashboard ───────────────────────────────────────────────────────────────
create function public.get_family_dashboard(p_parent uuid, p_tz text default 'UTC')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_family uuid := private.parent_family(p_parent);
  v_tz text := case when exists (select 1 from pg_catalog.pg_timezone_names where name = p_tz) then p_tz else 'UTC' end;
  v_today date := (now() at time zone v_tz)::date;
  v_week_start timestamptz := (v_today - 6)::timestamp at time zone v_tz;
begin
  return jsonb_build_object(
    'expires_at', (select expires_at from private.parent_sessions where token = p_parent),
    'profiles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'display_name', p.display_name,
        'lane', p.lane,
        'daily_limit_minutes', p.daily_limit_minutes,
        'quiet_hours', p.quiet_hours,
        'bedtime_hour', p.bedtime_hour,
        'wake_hour', p.wake_hour,
        'games_enabled', p.games_enabled,
        'paused', p.paused,
        'extra_minutes', case when p.extra_until > now() then p.extra_minutes else 0 end,
        'last_seen_at', ps.last_seen_at,
        'last_activity', ps.last_activity,
        'week', (
          select jsonb_agg(jsonb_build_object('day', d.day, 'video_s', coalesce(w.video_s, 0), 'game_s', coalesce(w.game_s, 0)) order by d.day)
            from (select v_today - g.i as day from generate_series(0, 6) as g(i)) d
            left join (
              select (e.created_at at time zone v_tz)::date as day,
                     sum(e.seconds) filter (where e.video_id is not null) as video_s,
                     sum(e.seconds) filter (where e.game is not null) as game_s
                from public.watch_events e
               where e.profile_id = p.id and e.created_at >= v_week_start
               group by 1
            ) w on w.day = d.day
        ),
        'topics', coalesce((
          select jsonb_agg(t order by t.seconds desc)
            from (
              select i.slug, i.label, i.emoji, sum(e.seconds)::int as seconds
                from public.watch_events e
                join public.videos v on v.id = e.video_id
                cross join lateral unnest(v.topics) as tp(topic)
                join public.interests i on i.slug = tp.topic
               where e.profile_id = p.id and e.created_at >= v_week_start
               group by i.slug, i.label, i.emoji
               order by 4 desc
               limit 4
            ) t
        ), '[]'::jsonb),
        'recent', coalesce((
          select jsonb_agg(r order by r.last_at desc)
            from (
              select v.id, v.caption, v.creator_name, v.lane, v.asset_key, v.storage_path, v.thumb_path,
                     sum(e.seconds)::int as seconds, max(e.created_at) as last_at,
                     exists (select 1 from public.hidden_videos h where h.profile_id = p.id and h.video_id = v.id) as hidden
                from public.watch_events e
                join public.videos v on v.id = e.video_id
               where e.profile_id = p.id and e.created_at >= v_week_start
               group by v.id
               order by max(e.created_at) desc
               limit 12
            ) r
        ), '[]'::jsonb),
        'flags', coalesce((
          select jsonb_agg(jsonb_build_object('video_id', r.video_id, 'caption', v.caption, 'reason', r.reason, 'at', r.created_at)
                           order by r.created_at desc)
            from public.reports r
            join public.videos v on v.id = r.video_id
           where r.profile_id = p.id and r.created_at >= v_week_start
        ), '[]'::jsonb)
      ) order by p.created_at)
        from public.profiles p
        left join lateral (
          select s.last_seen_at, s.last_activity
            from private.profile_sessions s
           where s.profile_id = p.id and s.last_seen_at is not null
           order by s.last_seen_at desc
           limit 1
        ) ps on true
       where p.family_id = v_family and p.lane <> 'adult'
    ), '[]'::jsonb)
  );
end;
$$;

-- ── Realtime: children's devices hear control changes ──────────────────────
alter publication supabase_realtime add table public.profiles;

-- ── grants ──────────────────────────────────────────────────────────────────
revoke all on function public.ping_session(uuid, text) from public, anon;
revoke all on function public.start_parent_session(text) from public, anon;
revoke all on function public.end_parent_session(uuid) from public, anon;
revoke all on function public.set_profile_controls(uuid, uuid, smallint, boolean, smallint, smallint, boolean) from public, anon;
revoke all on function public.set_profile_paused(uuid, uuid, boolean) from public, anon;
revoke all on function public.grant_extra_time(uuid, uuid, smallint, timestamptz) from public, anon;
revoke all on function public.parent_hide_video(uuid, uuid, uuid) from public, anon;
revoke all on function public.get_family_dashboard(uuid, text) from public, anon;

grant execute on function public.ping_session(uuid, text) to authenticated;
grant execute on function public.start_parent_session(text) to authenticated;
grant execute on function public.end_parent_session(uuid) to authenticated;
grant execute on function public.set_profile_controls(uuid, uuid, smallint, boolean, smallint, smallint, boolean) to authenticated;
grant execute on function public.set_profile_paused(uuid, uuid, boolean) to authenticated;
grant execute on function public.grant_extra_time(uuid, uuid, smallint, timestamptz) to authenticated;
grant execute on function public.parent_hide_video(uuid, uuid, uuid) to authenticated;
grant execute on function public.get_family_dashboard(uuid, text) to authenticated;
