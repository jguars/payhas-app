-- Payhas: imported content (Pixabay first; NASA, Wikimedia and originals later).
--
-- An importer on the team's Mac (tools/content) downloads licensed clips,
-- reframes them to 9:16 and inserts them as *pending* with the service role.
-- Nothing is visible to anyone until a moderator approves it, one by one or
-- in bulk. Every row remembers where it came from and under what licence.

-- ── provenance ──────────────────────────────────────────────────────────────
alter table public.videos
  add column source text not null default 'upload'
    check (source in ('seed', 'upload', 'pixabay', 'nasa', 'wikimedia', 'original')),
  add column source_id text,
  add column source_url text,
  add column license text,
  -- Shown under the caption, e.g. "Video: Jane Doe · Pixabay". Null = no credit line.
  add column attribution text check (attribution is null or char_length(attribution) <= 80),
  add constraint videos_source_unique unique (source, source_id);

update public.videos set source = 'seed' where asset_key is not null;

-- Stock footage is mostly nature and space; give children a way to pick them.
insert into public.interests (slug, label, emoji, youngest_lane, sort) values
  ('nature', 'Nature', '🌿', 'little', 7),
  ('space',  'Space',  '🚀', 'little', 8)
on conflict (slug) do nothing;

-- ── bulk approve ────────────────────────────────────────────────────────────
-- Publishes pending videos as suggested (lane + topics from the importer or
-- creator). For a batch the moderator has already watched in the queue.
-- Imports are Onki's own, so no creator notice is sent.
create function public.approve_videos(p_ids uuid[])
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n int;
begin
  if not private.is_moderator() then
    raise exception 'moderators only' using errcode = '42501';
  end if;
  update public.videos
     set status = 'published',
         safety = 1,
         human_reviewed = true,
         published_at = now(),
         reviewed_by = (select auth.uid()),
         reviewed_at = now()
   where id = any (p_ids) and status = 'pending';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.approve_videos(uuid[]) from public, anon;
grant execute on function public.approve_videos(uuid[]) to authenticated;

-- ── calmer inbox ────────────────────────────────────────────────────────────
-- Publishing a batch must not flood children's inboxes. Followed channels
-- still notify every time; topic matches notify at most once per 6 hours.
create or replace function private.inbox_new_video()
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
          or (exists (select 1 from public.profile_interests pi
                       where pi.profile_id = p.id and pi.interest_slug = any (new.topics))
              and not exists (select 1 from public.inbox_items ii
                               where ii.profile_id = p.id and ii.kind = 'new_video'
                                 and ii.created_at > now() - interval '6 hours')));
  return new;
end;
$$;

revoke all on function private.inbox_new_video() from public, anon, authenticated;
