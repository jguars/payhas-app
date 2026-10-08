-- Payhas Phase 3: uploads from approved creators, human review, takedowns.
--
-- Roles are per account (auth user), granted by an admin in SQL:
--   insert into public.staff (owner_id, is_creator, creator_name) values ('<uid>', true, 'Studio name');
--   update public.staff set is_moderator = true where owner_id = '<uid>';
-- Files live in the private `videos` bucket at <uid>/<video id>.mp4 / .jpg.
-- Nothing an upload contains is visible to a child until a moderator approves it.

-- ── roles ───────────────────────────────────────────────────────────────────
create table public.staff (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  is_creator boolean not null default false,
  is_moderator boolean not null default false,
  creator_name text unique check (creator_name is null or char_length(creator_name) between 2 and 40),
  creator_verified boolean not null default false,
  created_at timestamptz not null default now(),
  check (not is_creator or creator_name is not null)
);
alter table public.staff enable row level security;
revoke all on public.staff from anon, authenticated;

create function private.is_moderator()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select is_moderator from public.staff where owner_id = (select auth.uid())), false);
$$;

-- ── videos: uploaded files + review trail ───────────────────────────────────
alter table public.videos drop constraint videos_status_check;
alter table public.videos
  add constraint videos_status_check check (status in ('uploading', 'pending', 'published', 'rejected', 'removed')),
  add column storage_path text unique,
  add column thumb_path text unique,
  add column duration_s real check (duration_s is null or duration_s between 1 and 60),
  add column uploaded_by uuid references auth.users (id) on delete set null,
  add column review_reason text,
  add column reviewed_by uuid references auth.users (id) on delete set null,
  add column reviewed_at timestamptz;
create index videos_uploaded_by_idx on public.videos (uploaded_by);
create index videos_reviewed_by_idx on public.videos (reviewed_by);
create index videos_pending_idx on public.videos (created_at) where status = 'pending';

-- The inbox gains creator notices.
alter table public.inbox_items drop constraint inbox_items_kind_check;
alter table public.inbox_items
  add constraint inbox_items_kind_check check (kind in ('welcome', 'new_video', 'family', 'shared', 'creator'));

-- ── storage ─────────────────────────────────────────────────────────────────
-- Storage policies run as the signed-in user, who can't read public.videos, so
-- the row checks go through these definer helpers.
create function private.upload_slot(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.videos v
     where v.uploaded_by = (select auth.uid()) and v.status = 'uploading'
       and (v.storage_path = p_name or v.thumb_path = p_name)
  );
$$;

create function private.file_published(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.videos v where v.status = 'published' and (v.storage_path = p_name or v.thumb_path = p_name));
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', false, 52428800, array['video/mp4', 'video/quicktime', 'image/jpeg'])
on conflict (id) do nothing;

-- Creators write only into their own folder, and only for a video row they own that is still uploading.
create policy "creators upload own files" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and private.upload_slot(name)
  );

-- Readable: your own uploads; anything for moderators; published videos for everyone signed in.
-- (Which videos a profile is *shown* is still decided by the lane gate in get_feed.)
create policy "read own, reviewed or published files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'videos'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select private.is_moderator())
      or private.file_published(name)
    )
  );

create policy "creators delete own unpublished files" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not private.file_published(name)
  );

-- ── helper: tell a creator account what happened ────────────────────────────
create function private.notify_account(p_owner uuid, p_title text, p_body text, p_video uuid)
returns void language sql security definer set search_path = '' as $$
  insert into public.inbox_items (profile_id, kind, title, body, video_id)
  select p.id, 'creator', p_title, p_body, p_video
    from public.profiles p
    join public.families f on f.id = p.family_id
   where f.owner_id = p_owner and p.lane = 'adult';
$$;

revoke all on all functions in schema private from public, anon, authenticated;
-- Storage policies call these as the signed-in user. Schema usage alone exposes
-- nothing: the private tables have no grants and every other function is revoked.
grant usage on schema private to authenticated;
grant execute on function private.is_moderator() to authenticated;
grant execute on function private.upload_slot(text) to authenticated;
grant execute on function private.file_published(text) to authenticated;

-- ── client RPCs ─────────────────────────────────────────────────────────────
create function public.get_my_roles()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select jsonb_build_object('is_creator', is_creator, 'is_moderator', is_moderator, 'creator_name', creator_name)
       from public.staff where owner_id = (select auth.uid())),
    jsonb_build_object('is_creator', false, 'is_moderator', false, 'creator_name', null)
  );
$$;

-- Step 1 of an upload: reserve the row and the file paths.
create function public.create_upload(p_caption text, p_topics text[], p_lane public.lane, p_duration real)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_staff public.staff;
  v_id uuid := gen_random_uuid();
  v_dir text := (select auth.uid())::text;
begin
  select * into v_staff from public.staff where owner_id = (select auth.uid()) and is_creator;
  if not found then
    raise exception 'only approved creators can upload' using errcode = '42501';
  end if;
  if char_length(coalesce(p_caption, '')) not between 1 and 150 then
    raise exception 'caption must be 1–150 characters' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(p_topics) t where t not in (select slug from public.interests)) then
    raise exception 'unknown topic' using errcode = '22023';
  end if;
  insert into public.videos (id, creator_name, creator_verified, caption, lane, safety, human_reviewed, topics, status,
                             storage_path, thumb_path, duration_s, uploaded_by)
  values (v_id, v_staff.creator_name, v_staff.creator_verified, p_caption, p_lane, 0, false, p_topics, 'uploading',
          v_dir || '/' || v_id || '.mp4', v_dir || '/' || v_id || '.jpg', p_duration, (select auth.uid()));
  return jsonb_build_object('video_id', v_id, 'storage_path', v_dir || '/' || v_id || '.mp4', 'thumb_path', v_dir || '/' || v_id || '.jpg');
end;
$$;

-- Step 2: files are up; join the review queue.
create function public.finish_upload(p_video_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.videos set status = 'pending'
   where id = p_video_id and uploaded_by = (select auth.uid()) and status = 'uploading';
  if not found then
    raise exception 'upload not found' using errcode = 'P0002';
  end if;
end;
$$;

create function public.get_my_uploads()
returns setof public.videos language sql stable security definer set search_path = '' as $$
  select * from public.videos where uploaded_by = (select auth.uid()) and status <> 'uploading' order by created_at desc;
$$;

create function public.get_review_queue()
returns setof public.videos language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_moderator() then
    raise exception 'moderators only' using errcode = '42501';
  end if;
  return query select * from public.videos where status = 'pending' order by created_at;
end;
$$;

-- Published videos with open reports, most-reported first.
create function public.get_report_queue()
returns table (video_id uuid, caption text, creator_name text, storage_path text, thumb_path text, asset_key text, lane public.lane,
               report_count int, reasons jsonb, latest timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_moderator() then
    raise exception 'moderators only' using errcode = '42501';
  end if;
  return query
    select v.id, v.caption, v.creator_name, v.storage_path, v.thumb_path, v.asset_key, v.lane,
           count(r.*)::int,
           (select jsonb_object_agg(x.reason, x.n)
              from (select r2.reason, count(*) as n from public.reports r2
                     where r2.video_id = v.id and r2.status = 'open' group by r2.reason) x),
           max(r.created_at)
      from public.reports r
      join public.videos v on v.id = r.video_id
     where r.status = 'open'
     group by v.id
     order by 8 desc, 10 desc;
end;
$$;

create function public.review_video(p_video_id uuid, p_approve boolean, p_lane public.lane, p_topics text[], p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.videos;
begin
  if not private.is_moderator() then
    raise exception 'moderators only' using errcode = '42501';
  end if;
  select * into v from public.videos where id = p_video_id and status = 'pending' for update;
  if not found then
    raise exception 'nothing to review' using errcode = 'P0002';
  end if;
  if not p_approve and coalesce(p_reason, '') = '' then
    raise exception 'a reason is needed to reject' using errcode = '22023';
  end if;

  update public.videos
     set status = case when p_approve then 'published' else 'rejected' end,
         lane = p_lane,
         topics = coalesce(p_topics, topics),
         -- A human looked at it: it passes the safety threshold of every lane up to the one chosen.
         safety = case when p_approve then 1 else safety end,
         human_reviewed = p_approve,
         published_at = case when p_approve then now() else null end,
         review_reason = p_reason,
         reviewed_by = (select auth.uid()),
         reviewed_at = now()
   where id = p_video_id;

  perform private.notify_account(v.uploaded_by,
    case when p_approve then 'Your video is live' else 'Your video wasn’t approved' end,
    case when p_approve then v.caption else p_reason end,
    case when p_approve then p_video_id else null end);
end;
$$;

-- Keep (reports dismissed) or remove (taken down everywhere).
create function public.resolve_reports(p_video_id uuid, p_remove boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v public.videos;
begin
  if not private.is_moderator() then
    raise exception 'moderators only' using errcode = '42501';
  end if;
  update public.reports set status = 'reviewed' where video_id = p_video_id and status = 'open';
  if p_remove then
    update public.videos
       set status = 'removed', review_reason = coalesce(p_reason, 'Removed after reports'), reviewed_by = (select auth.uid()), reviewed_at = now()
     where id = p_video_id
    returning * into v;
    if v.uploaded_by is not null then
      perform private.notify_account(v.uploaded_by, 'A video was taken down', coalesce(p_reason, 'It broke the Payhas guidelines.'), null);
    end if;
  end if;
end;
$$;

revoke all on function public.get_my_roles() from public, anon;
revoke all on function public.create_upload(text, text[], public.lane, real) from public, anon;
revoke all on function public.finish_upload(uuid) from public, anon;
revoke all on function public.get_my_uploads() from public, anon;
revoke all on function public.get_review_queue() from public, anon;
revoke all on function public.get_report_queue() from public, anon;
revoke all on function public.review_video(uuid, boolean, public.lane, text[], text) from public, anon;
revoke all on function public.resolve_reports(uuid, boolean, text) from public, anon;

grant execute on function public.get_my_roles() to authenticated;
grant execute on function public.create_upload(text, text[], public.lane, real) to authenticated;
grant execute on function public.finish_upload(uuid) to authenticated;
grant execute on function public.get_my_uploads() to authenticated;
grant execute on function public.get_review_queue() to authenticated;
grant execute on function public.get_report_queue() to authenticated;
grant execute on function public.review_video(uuid, boolean, public.lane, text[], text) to authenticated;
grant execute on function public.resolve_reports(uuid, boolean, text) to authenticated;
