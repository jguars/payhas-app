-- Payhas: channels for Discover's hub layout.
--
-- get_channels: every channel (creator) this profile may see, with how many of
-- its videos pass the lane gate, whether the profile follows it, its three
-- most common topics and its three newest videos (for the hub card's posters).
-- get_channel_videos: one channel's videos, newest first, paged, for its page.
-- Both use the same gate as the feeds: video_allowed() and the profile's
-- hidden videos.

create or replace function public.get_channels(p_session uuid)
returns table (
  creator_name text,
  verified boolean,
  video_count int,
  follower_count int,
  following boolean,
  topics text[],
  recent jsonb
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_profile public.profiles := private.session_profile(p_session);
begin
  return query
    with allowed as (
      select v.* from public.videos v
       where private.video_allowed(v_profile.lane, v)
         and not exists (select 1 from public.hidden_videos h where h.profile_id = v_profile.id and h.video_id = v.id)
    ),
    ranked as (
      select a.*, row_number() over (partition by a.creator_name order by a.published_at desc nulls last, a.id) as rn
        from allowed a
    )
    select a.creator_name,
           bool_or(a.creator_verified),
           count(*)::int,
           (select count(*)::int from public.follows f where f.creator_name = a.creator_name),
           exists (select 1 from public.follows f where f.profile_id = v_profile.id and f.creator_name = a.creator_name),
           array(
             select t.slug from allowed b, unnest(b.topics) as t(slug)
              where b.creator_name = a.creator_name
              group by t.slug order by count(*) desc, t.slug limit 3
           ),
           coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', r.id, 'storage_path', r.storage_path, 'thumb_path', r.thumb_path,
                      'asset_key', r.asset_key, 'caption', r.caption, 'caption_i18n', r.caption_i18n
                    ) order by r.rn)
               from ranked r where r.creator_name = a.creator_name and r.rn <= 3
           ), '[]'::jsonb)
      from allowed a
     group by a.creator_name
     order by 3 desc, 1;
end;
$$;

create or replace function public.get_channel_videos(p_session uuid, p_creator text, p_limit int default 30, p_offset int default 0)
returns setof public.videos
language plpgsql stable security definer set search_path = '' as $$
declare
  v_profile public.profiles := private.session_profile(p_session);
begin
  return query
    select v.* from public.videos v
     where v.creator_name = p_creator
       and private.video_allowed(v_profile.lane, v)
       and not exists (select 1 from public.hidden_videos h where h.profile_id = v_profile.id and h.video_id = v.id)
     order by v.published_at desc nulls last, v.id
     limit least(greatest(p_limit, 1), 60) offset greatest(p_offset, 0);
end;
$$;

revoke all on function public.get_channels(uuid) from public, anon;
revoke all on function public.get_channel_videos(uuid, text, int, int) from public, anon;
grant execute on function public.get_channels(uuid) to authenticated;
grant execute on function public.get_channel_videos(uuid, text, int, int) to authenticated;
