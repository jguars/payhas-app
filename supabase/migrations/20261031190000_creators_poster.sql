-- Following with nobody followed shows a card per creator with their latest
-- video as the poster (approved Following grid). get_creators only returned
-- the video's id, and the app can't read videos directly, so most cards had
-- no picture. It now returns that video's media paths too.
drop function public.get_creators(uuid, boolean);
create function public.get_creators(p_session uuid, p_only_following boolean default false)
returns table (creator_name text, verified boolean, video_count int, follower_count int, following boolean, latest_video_id uuid,
               latest_asset_key text, latest_storage_path text, latest_thumb_path text)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_profile public.profiles := private.session_profile(p_session);
begin
  return query
    with allowed as (
      select v.* from public.videos v where private.video_allowed(v_profile.lane, v)
    ),
    ranked as (
      select a.creator_name,
             bool_or(a.creator_verified) as verified,
             count(*)::int as video_count,
             (array_agg(a.id order by a.published_at desc))[1] as latest_id
        from allowed a
       group by a.creator_name
    )
    select r.creator_name,
           r.verified,
           r.video_count,
           (select count(*)::int from public.follows f where f.creator_name = r.creator_name),
           exists (select 1 from public.follows f where f.profile_id = v_profile.id and f.creator_name = r.creator_name),
           r.latest_id,
           v.asset_key,
           v.storage_path,
           v.thumb_path
      from ranked r
      join public.videos v on v.id = r.latest_id
     where not p_only_following
        or exists (select 1 from public.follows f where f.profile_id = v_profile.id and f.creator_name = r.creator_name)
     order by 4 desc, 1;
end;
$$;
revoke all on function public.get_creators(uuid, boolean) from public, anon;
grant execute on function public.get_creators(uuid, boolean) to authenticated;
