-- Payhas Phase 6b: push notifications for parents (Firebase Cloud Messaging, direct).
--
-- Only parents get pushes, and only on phones they opt in from the dashboard
-- (behind the PIN). Children never receive notifications.
--   • push_devices: FCM tokens of opted-in parent phones, per family.
--   • push_events: an outbox. Triggers insert a row and ping the `push` Edge
--     Function through pg_net with just the event id; the function reads the
--     row with the service role, sends it to every device and marks it sent.
--     A forged call can only re-trigger a real, unsent event — harmless.
--   • Events: a child reached today's limit, a child flagged a video, and a
--     child asked for more time (new: "Ask for more time" on the stop screen,
--     answered from the dashboard).

create extension if not exists pg_net with schema extensions;

-- "Today" for the limit trigger needs the household's time zone.
alter table public.families add column time_zone text not null default 'UTC';

-- ── tables ──────────────────────────────────────────────────────────────────
create table public.push_devices (
  token text primary key check (char_length(token) between 20 and 4096),
  family_id uuid not null references public.families (id) on delete cascade,
  device_name text not null default 'Parent phone' check (char_length(device_name) between 1 and 60),
  created_at timestamptz not null default now()
);
create index push_devices_family_id_idx on public.push_devices (family_id);

create table public.time_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'granted', 'declined')),
  minutes smallint,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index time_requests_profile_created_idx on public.time_requests (profile_id, created_at desc);

create table public.push_events (
  id bigint generated always as identity primary key,
  family_id uuid not null references public.families (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('limit', 'flag', 'more_time')),
  title text not null,
  body text not null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  error text
);
create index push_events_family_id_idx on public.push_events (family_id);
create index push_events_profile_kind_idx on public.push_events (profile_id, kind, created_at desc);

alter table public.push_devices enable row level security;
alter table public.time_requests enable row level security;
alter table public.push_events enable row level security;
revoke all on public.push_devices, public.time_requests, public.push_events from anon, authenticated;

-- ── outbox ──────────────────────────────────────────────────────────────────
create function private.queue_push(p_family uuid, p_profile uuid, p_kind text, p_title text, p_body text, p_data jsonb default '{}')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  -- No opted-in phone, nothing to send.
  if not exists (select 1 from public.push_devices where family_id = p_family) then
    return;
  end if;
  insert into public.push_events (family_id, profile_id, kind, title, body, data)
  values (p_family, p_profile, p_kind, p_title, p_body, p_data)
  returning id into v_id;
  -- pg_net sends after this transaction commits, so the row is there to read.
  perform net.http_post(
    url := 'https://qlaqljpwcwyunffyrfdt.supabase.co/functions/v1/push',
    body := jsonb_build_object('event_id', v_id),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
end;
$$;

-- A child crossed today's limit (videos + games). Once per child per day.
create function private.push_on_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.profiles;
  v_tz text;
  v_day_start timestamptz;
  v_limit int;
  v_total int;
begin
  select * into v_p from public.profiles where id = new.profile_id;
  if v_p.lane = 'adult' or v_p.daily_limit_minutes is null then
    return null;
  end if;
  select time_zone into v_tz from public.families where id = v_p.family_id;
  v_day_start := (date_trunc('day', now() at time zone v_tz)) at time zone v_tz;
  v_limit := (v_p.daily_limit_minutes + case when v_p.extra_until > now() then v_p.extra_minutes else 0 end) * 60;
  select coalesce(sum(seconds), 0) into v_total from public.watch_events
   where profile_id = v_p.id and created_at >= v_day_start;
  if v_total >= v_limit and v_total - new.seconds < v_limit
     and not exists (select 1 from public.push_events
                      where profile_id = v_p.id and kind = 'limit' and created_at >= v_day_start) then
    perform private.queue_push(v_p.family_id, v_p.id, 'limit',
      v_p.display_name || ' reached today''s limit',
      v_limit / 60 || ' minutes used. Payhas has stopped for today.',
      jsonb_build_object('profile_id', v_p.id));
  end if;
  return null;
end;
$$;

create trigger push_on_limit
  after insert on public.watch_events
  for each row execute function private.push_on_limit();

-- A child flagged a video (it's already hidden for them and queued for moderators).
create function private.push_on_flag()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.profiles;
  v_caption text;
begin
  select * into v_p from public.profiles where id = new.profile_id;
  if v_p.lane = 'adult' then
    return null;
  end if;
  select caption into v_caption from public.videos where id = new.video_id;
  perform private.queue_push(v_p.family_id, v_p.id, 'flag',
    v_p.display_name || ' flagged a video',
    '“' || left(v_caption, 60) || '” — ' || case new.reason when 'scary' then 'scary' when 'not_my_age' then 'not for their age'
                                                            when 'mean' then 'mean' else 'something else' end
      || '. It''s hidden and with our moderators.',
    jsonb_build_object('profile_id', v_p.id, 'video_id', new.video_id));
  return null;
end;
$$;

create trigger push_on_flag
  after insert on public.reports
  for each row execute function private.push_on_flag();

revoke all on function private.queue_push(uuid, uuid, text, text, text, jsonb), private.push_on_limit(), private.push_on_flag()
  from public, anon, authenticated;

-- ── parent phones ───────────────────────────────────────────────────────────
-- Opting in needs a parent session; p_tz also records the household time zone.
create function public.register_push_device(p_parent uuid, p_token text, p_name text, p_tz text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family uuid := private.parent_family(p_parent);
begin
  insert into public.push_devices (token, family_id, device_name)
  values (p_token, v_family, coalesce(nullif(left(p_name, 60), ''), 'Parent phone'))
  on conflict (token) do update set family_id = excluded.family_id, device_name = excluded.device_name;
  if p_tz is not null and exists (select 1 from pg_catalog.pg_timezone_names where name = p_tz) then
    update public.families set time_zone = p_tz where id = v_family;
  end if;
end;
$$;

-- Opting out never needs the PIN.
create function public.unregister_push_device(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_devices where token = p_token and family_id = private.my_family_id();
$$;

-- FCM rotates tokens; the app swaps the old one for the new one on launch.
-- Only a phone that already holds a registered token can do this.
create function public.refresh_push_device(p_old text, p_new text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  update public.push_devices set token = p_new
   where token = p_old and family_id = private.my_family_id()
     and not exists (select 1 from public.push_devices where token = p_new)
  returning true;
$$;

-- ── ask for more time ───────────────────────────────────────────────────────
-- 'sent', or 'waiting' (one is already open), or 'too_many' (3 a day).
create function public.request_more_time(p_session uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.profiles := private.session_profile(p_session);
  v_id uuid;
begin
  if exists (select 1 from public.time_requests
              where profile_id = v_p.id and status = 'pending' and created_at > now() - interval '12 hours') then
    return 'waiting';
  end if;
  if (select count(*) from public.time_requests where profile_id = v_p.id and created_at > now() - interval '24 hours') >= 3 then
    return 'too_many';
  end if;
  insert into public.time_requests (profile_id) values (v_p.id) returning id into v_id;
  perform private.queue_push(v_p.family_id, v_p.id, 'more_time',
    v_p.display_name || ' is asking for more time',
    'Tap to give 15 or 30 more minutes today, or say not today.',
    jsonb_build_object('profile_id', v_p.id, 'request_id', v_id));
  return 'sent';
end;
$$;

-- The child's latest request in the last 12 hours, for the stop screen.
create function public.get_time_request(p_session uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('id', id, 'status', status, 'minutes', minutes)
    from public.time_requests
   where profile_id = (private.session_profile(p_session)).id and created_at > now() - interval '12 hours'
   order by created_at desc
   limit 1;
$$;

-- p_minutes null = "Not today".
create function public.answer_time_request(p_parent uuid, p_request_id uuid, p_minutes smallint, p_until timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.time_requests;
begin
  select * into v_req from public.time_requests where id = p_request_id;
  if not found then
    raise exception 'request not found' using errcode = 'P0002';
  end if;
  perform private.parent_child(p_parent, v_req.profile_id); -- same family, or raise
  if v_req.status <> 'pending' then
    return;
  end if;
  update public.time_requests
     set status = case when p_minutes is null then 'declined' else 'granted' end, minutes = p_minutes, decided_at = now()
   where id = p_request_id;
  if p_minutes is null then
    insert into public.inbox_items (profile_id, kind, title, body)
    values (v_req.profile_id, 'family', 'Not today', 'A parent said no to more time.');
  else
    perform public.grant_extra_time(p_parent, v_req.profile_id, p_minutes, p_until);
  end if;
end;
$$;

-- ── dashboard: now with the open request per child ──────────────────────────
create or replace function public.get_family_dashboard(p_parent uuid, p_tz text default 'UTC')
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
        'request', (
          select jsonb_build_object('id', tr.id, 'created_at', tr.created_at)
            from public.time_requests tr
           where tr.profile_id = p.id and tr.status = 'pending' and tr.created_at > now() - interval '12 hours'
           order by tr.created_at desc
           limit 1
        ),
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

-- ── grants ──────────────────────────────────────────────────────────────────
revoke all on function public.register_push_device(uuid, text, text, text) from public, anon;
revoke all on function public.unregister_push_device(text) from public, anon;
revoke all on function public.refresh_push_device(text, text) from public, anon;
revoke all on function public.request_more_time(uuid) from public, anon;
revoke all on function public.get_time_request(uuid) from public, anon;
revoke all on function public.answer_time_request(uuid, uuid, smallint, timestamptz) from public, anon;

grant execute on function public.register_push_device(uuid, text, text, text) to authenticated;
grant execute on function public.unregister_push_device(text) to authenticated;
grant execute on function public.refresh_push_device(text, text) to authenticated;
grant execute on function public.request_more_time(uuid) to authenticated;
grant execute on function public.get_time_request(uuid) to authenticated;
grant execute on function public.answer_time_request(uuid, uuid, smallint, timestamptz) to authenticated;
