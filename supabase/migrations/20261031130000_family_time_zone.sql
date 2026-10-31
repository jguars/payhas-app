-- The family's time zone decides when "today" starts on the server (the
-- 30-video cap, today's watch time). It was only ever set when a parent
-- switched on alerts, so most families stayed on UTC — in Ashgabat (UTC+5)
-- their day reset at 05:00. The parent's (or a co-parent's) phone now sends
-- its zone at launch; linked children's phones don't.
create function public.sync_family_time_zone(p_tz text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.families
     set time_zone = p_tz
   where id = private.parent_family_of((select auth.uid()))
     and time_zone is distinct from p_tz
     and exists (select 1 from pg_catalog.pg_timezone_names where name = p_tz);
$$;

revoke all on function public.sync_family_time_zone(text) from public, anon;
grant execute on function public.sync_family_time_zone(text) to authenticated;
