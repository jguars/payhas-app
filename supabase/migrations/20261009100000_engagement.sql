-- Payhas: engagement — likes, emoji reactions, signals, not-interested,
-- reports, send-to-family, Following feed, creator pages, Saved.
-- Same pattern as before: new tables are closed to clients (RLS on, no
-- policies); every read and write goes through a session-token RPC.

-- ── counters on videos (maintained by triggers below) ──────────────────────
alter table public.videos
  add column view_count int not null default 0,
  add column like_count int not null default 0,
  add column save_count int not null default 0,
  add column share_count int not null default 0,
  add column reaction_counts jsonb not null default '{}'::jsonb;

-- Seed numbers so the three demo clips don't start at zero.
update public.videos set like_count = 24100, view_count = 1100000 where asset_key = 'eyes-rhyme';
update public.videos set like_count = 18700, view_count = 412000 where asset_key = 'playground';
update public.videos set like_count = 9300, view_count = 98000 where asset_key = 'bunny';

-- ── tables ──────────────────────────────────────────────────────────────────
create table public.likes (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, video_id)
);
create index likes_video_id_idx on public.likes (video_id);

-- Emoji only, from a fixed set: no free text anywhere a child can see.
create table public.reactions (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  emoji text not null check (emoji in ('😂', '❤️', '😮', '👏', '🤩', '😢')),
  created_at timestamptz not null default now(),
  primary key (profile_id, video_id, emoji)
);
create index reactions_video_id_idx on public.reactions (video_id);

-- Taste-engine signals (see algorithm/tasteEngine.ts: Signal).
create table public.video_events (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  kind text not null check (kind in ('impression', 'finish', 'rewatch', 'quick_skip', 'share', 'not_interested')),
  created_at timestamptz not null default now()
);
create index video_events_profile_created_idx on public.video_events (profile_id, created_at desc);
create index video_events_video_id_idx on public.video_events (video_id);

create table public.hidden_videos (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, video_id)
);
create index hidden_videos_video_id_idx on public.hidden_videos (video_id);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  video_id uuid not null references public.videos (id) on delete cascade,
  reason text not null check (reason in ('scary', 'not_my_age', 'mean', 'other')),
  status text not null default 'open' check (status in ('open', 'reviewed')),
  created_at timestamptz not null default now()
);
create index reports_video_id_idx on public.reports (video_id);
create index reports_profile_id_idx on public.reports (profile_id);

-- Send-to-family lands in the inbox.
alter table public.inbox_items drop constraint inbox_items_kind_check;
alter table public.inbox_items
  add constraint inbox_items_kind_check check (kind in ('welcome', 'new_video', 'family', 'shared')),
  add column from_profile_id uuid references public.profiles (id) on delete set null;
create index inbox_items_from_profile_id_idx on public.inbox_items (from_profile_id);

alter table public.likes enable row level security;
alter table public.reactions enable row level security;
alter table public.video_events enable row level security;
alter table public.hidden_videos enable row level security;
alter table public.reports enable row level security;
revoke all on public.likes, public.reactions, public.video_events, public.hidden_videos, public.reports from anon, authenticated;

-- ── counter triggers ────────────────────────────────────────────────────────
create function private.count_like()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.videos set like_count = greatest(0, like_count + case when tg_op = 'INSERT' then 1 else -1 end)
   where id = coalesce(new.video_id, old.video_id);
  return null;
end;
$$;
create trigger likes_count after insert or delete on public.likes for each row execute function private.count_like();

create function private.count_save()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.videos set save_count = greatest(0, save_count + case when tg_op = 'INSERT' then 1 else -1 end)
   where id = coalesce(new.video_id, old.video_id);
  return null;
end;
$$;
create trigger saves_count after insert or delete on public.saves for each row execute function private.count_save();

create function private.count_reaction()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_video uuid := case when tg_op = 'INSERT' then new.video_id else old.video_id end;
  v_emoji text := case when tg_op = 'INSERT' then new.emoji else old.emoji end;
  d int := case when tg_op = 'INSERT' then 1 else -1 end;
begin
  update public.videos
     set reaction_counts = jsonb_set(reaction_counts, array[v_emoji],
           to_jsonb(greatest(0, coalesce((reaction_counts ->> v_emoji)::int, 0) + d)))
   where id = v_video;
  return null;
end;
$$;
create trigger reactions_count after insert or delete on public.reactions for each row execute function private.count_reaction();

create function private.count_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'impression' then
    update public.videos set view_count = view_count + 1 where id = new.video_id;
  elsif new.kind = 'share' then
    update public.videos set share_count = share_count + 1 where id = new.video_id;
  end if;
  return null;
end;
$$;
create trigger video_events_count after insert on public.video_events for each row execute function private.count_event();

revoke all on all functions in schema private from public, anon, authenticated;

-- ── feed reads ──────────────────────────────────────────────────────────────
-- For You now skips videos this profile marked "Not interested".
create or replace function public.get_feed(p_session uuid, p_limit int default 20, p_before timestamptz default null)
returns setof public.videos
language plpgsql stable security definer set search_path = '' as $$
declare
  v_profile public.profiles := private.session_profile(p_session);
begin
  return query
    select v.* from public.videos v
     where private.video_allowed(v_profile.lane, v)
       and not exists (select 1 from public.hidden_videos h where h.profile_id = v_profile.id and h.video_id = v.id)
       and (p_before is null or v.published_at < p_before)
     order by v.published_at desc
     limit least(greatest(p_limit, 1), 50);
end;
$$;

create function public.get_following_feed(p_session uuid, p_limit int default 20)
returns setof public.videos
language plpgsql stable security definer set search_path = '' as $$
declare
  v_profile public.profiles := private.session_profile(p_session);
begin
  return query
    select v.* from public.videos v
     join public.follows f on f.profile_id = v_profile.id and f.creator_name = v.creator_name
     where private.video_allowed(v_profile.lane, v)
       and not exists (select 1 from public.hidden_videos h where h.profile_id = v_profile.id and h.video_id = v.id)
     order by v.published_at desc
     limit least(greatest(p_limit, 1), 50);
end;
$$;

create function public.get_saved(p_session uuid)
returns setof public.videos
language plpgsql stable security definer set search_path = '' as $$
declare
  v_profile public.profiles := private.session_profile(p_session);
begin
  return query
    select v.* from public.saves s
      join public.videos v on v.id = s.video_id
     where s.profile_id = v_profile.id and private.video_allowed(v_profile.lane, v)
     order by s.created_at desc;
end;
$$;

-- Creators this profile may see (they have at least one allowed video), with
-- follower count across Payhas and whether this profile follows them.
create function public.get_creators(p_session uuid, p_only_following boolean default false)
returns table (creator_name text, verified boolean, video_count int, follower_count int, following boolean, latest_video_id uuid)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_profile public.profiles := private.session_profile(p_session);
begin
  return query
    with allowed as (
      select v.* from public.videos v where private.video_allowed(v_profile.lane, v)
    )
    select a.creator_name,
           bool_or(a.creator_verified),
           count(*)::int,
           (select count(*)::int from public.follows f where f.creator_name = a.creator_name),
           exists (select 1 from public.follows f where f.profile_id = v_profile.id and f.creator_name = a.creator_name),
           (array_agg(a.id order by a.published_at desc))[1]
      from allowed a
     group by a.creator_name
    having not p_only_following
        or exists (select 1 from public.follows f where f.profile_id = v_profile.id and f.creator_name = a.creator_name)
     order by 4 desc, 1;
end;
$$;

-- ── writes ──────────────────────────────────────────────────────────────────
create function public.toggle_like(p_session uuid, p_video_id uuid)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_profile public.profiles := private.session_profile(p_session);
begin
  delete from public.likes where profile_id = v_profile.id and video_id = p_video_id;
  if found then return false; end if;
  insert into public.likes (profile_id, video_id) values (v_profile.id, p_video_id);
  return true;
end;
$$;

-- Double-tap only ever likes (never unlikes), like every short-video app.
create function public.set_like(p_session uuid, p_video_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_profile public.profiles := private.session_profile(p_session);
begin
  insert into public.likes (profile_id, video_id) values (v_profile.id, p_video_id) on conflict do nothing;
end;
$$;

create function public.toggle_reaction(p_session uuid, p_video_id uuid, p_emoji text)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_profile public.profiles := private.session_profile(p_session);
begin
  delete from public.reactions where profile_id = v_profile.id and video_id = p_video_id and emoji = p_emoji;
  if found then return false; end if;
  insert into public.reactions (profile_id, video_id, emoji) values (v_profile.id, p_video_id, p_emoji);
  return true;
end;
$$;

create function public.log_event(p_session uuid, p_video_id uuid, p_kind text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_profile public.profiles := private.session_profile(p_session);
begin
  insert into public.video_events (profile_id, video_id, kind) values (v_profile.id, p_video_id, p_kind);
end;
$$;

create function public.hide_video(p_session uuid, p_video_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_profile public.profiles := private.session_profile(p_session);
begin
  insert into public.hidden_videos (profile_id, video_id) values (v_profile.id, p_video_id) on conflict do nothing;
  insert into public.video_events (profile_id, video_id, kind) values (v_profile.id, p_video_id, 'not_interested');
end;
$$;

-- Reporting also hides the video for this profile straight away.
create function public.report_video(p_session uuid, p_video_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_profile public.profiles := private.session_profile(p_session);
begin
  insert into public.reports (profile_id, video_id, reason) values (v_profile.id, p_video_id, p_reason);
  insert into public.hidden_videos (profile_id, video_id) values (v_profile.id, p_video_id) on conflict do nothing;
end;
$$;

-- Send a video to another profile in the same family. Refused (false) when the
-- video isn't allowed in the recipient's lane — the lane gate holds for gifts too.
create function public.send_to_family(p_session uuid, p_video_id uuid, p_to_profile_id uuid)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_from public.profiles := private.session_profile(p_session);
  v_to public.profiles;
  v_video public.videos;
begin
  select * into v_to from public.profiles where id = p_to_profile_id and family_id = v_from.family_id and id <> v_from.id;
  if not found then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;
  select * into v_video from public.videos where id = p_video_id;
  if not found or not private.video_allowed(v_to.lane, v_video) then
    return false;
  end if;
  insert into public.inbox_items (profile_id, kind, title, body, video_id, from_profile_id)
  values (v_to.id, 'shared', v_from.display_name || ' sent you a video', v_video.caption, v_video.id, v_from.id);
  insert into public.video_events (profile_id, video_id, kind) values (v_from.id, v_video.id, 'share');
  return true;
end;
$$;

-- Records an outside share (copy link / system sheet). Teen and Adult only.
create function public.log_external_share(p_session uuid, p_video_id uuid)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_profile public.profiles := private.session_profile(p_session);
begin
  if v_profile.lane not in ('teen', 'adult') then
    return false;
  end if;
  insert into public.video_events (profile_id, video_id, kind) values (v_profile.id, p_video_id, 'share');
  return true;
end;
$$;

-- get_library also returns likes and this profile's reactions.
create or replace function public.get_library(p_session uuid)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_profile public.profiles := private.session_profile(p_session);
begin
  return jsonb_build_object(
    'saved', coalesce((select jsonb_agg(video_id) from public.saves where profile_id = v_profile.id), '[]'::jsonb),
    'following', coalesce((select jsonb_agg(creator_name) from public.follows where profile_id = v_profile.id), '[]'::jsonb),
    'liked', coalesce((select jsonb_agg(video_id) from public.likes where profile_id = v_profile.id), '[]'::jsonb),
    'reactions', coalesce((select jsonb_agg(jsonb_build_object('video_id', video_id, 'emoji', emoji)) from public.reactions where profile_id = v_profile.id), '[]'::jsonb)
  );
end;
$$;

-- ── grants ──────────────────────────────────────────────────────────────────
revoke all on function public.get_following_feed(uuid, int) from public, anon;
revoke all on function public.get_saved(uuid) from public, anon;
revoke all on function public.get_creators(uuid, boolean) from public, anon;
revoke all on function public.toggle_like(uuid, uuid) from public, anon;
revoke all on function public.set_like(uuid, uuid) from public, anon;
revoke all on function public.toggle_reaction(uuid, uuid, text) from public, anon;
revoke all on function public.log_event(uuid, uuid, text) from public, anon;
revoke all on function public.hide_video(uuid, uuid) from public, anon;
revoke all on function public.report_video(uuid, uuid, text) from public, anon;
revoke all on function public.send_to_family(uuid, uuid, uuid) from public, anon;
revoke all on function public.log_external_share(uuid, uuid) from public, anon;

grant execute on function public.get_following_feed(uuid, int) to authenticated;
grant execute on function public.get_saved(uuid) to authenticated;
grant execute on function public.get_creators(uuid, boolean) to authenticated;
grant execute on function public.toggle_like(uuid, uuid) to authenticated;
grant execute on function public.set_like(uuid, uuid) to authenticated;
grant execute on function public.toggle_reaction(uuid, uuid, text) to authenticated;
grant execute on function public.log_event(uuid, uuid, text) to authenticated;
grant execute on function public.hide_video(uuid, uuid) to authenticated;
grant execute on function public.report_video(uuid, uuid, text) to authenticated;
grant execute on function public.send_to_family(uuid, uuid, uuid) to authenticated;
grant execute on function public.log_external_share(uuid, uuid) to authenticated;
