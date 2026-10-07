-- Payhas: games in the Play tab count toward screen time.
-- A watch event is now either a video watched or a game played. get_me's
-- today_seconds already sums every event for the profile, so the daily limit
-- covers games with no further change; taste still joins videos only.

alter table public.watch_events
  alter column video_id drop not null,
  add column game text check (game in ('bubbles', 'memory')),
  add constraint watch_events_video_or_game check ((video_id is null) <> (game is null));

create function public.log_play(p_session uuid, p_game text, p_seconds int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles := private.session_profile(p_session);
begin
  if p_seconds < 1 then return; end if;
  insert into public.watch_events (profile_id, game, seconds)
  values (v_profile.id, p_game, least(p_seconds, 3600));
end;
$$;

revoke all on function public.log_play(uuid, text, int) from public, anon;
grant execute on function public.log_play(uuid, text, int) to authenticated;
