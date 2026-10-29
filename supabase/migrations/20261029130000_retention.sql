-- Payhas: nothing about a child is kept longer than the app needs it
-- (COPPA §312.10, GDPR Art. 5(1)(e)). A nightly job deletes:
--
--   watch time (watch_events)            after 90 days  (longest use: 30-day taste and ranking)
--   impressions, skips, finishes, shares
--     (video_events)                     after 90 days  (ranking reads 30 days)
--   inbox notices (inbox_items)          after 90 days
--   parent alert records (push_events)   after 30 days  (dedupe reads today)
--   requests for more time
--     (time_requests)                    after 30 days  (rate limits read 24 hours)
--   reviewed video reports (reports)     after 180 days (open reports stay until reviewed)
--   expired profile and parent sessions  once expired
--
-- What a child or parent chose to keep (likes, reactions, saves, follows,
-- hidden videos, limits) stays until the profile or account is deleted.
-- Change a period here and in the privacy policy together.

create extension if not exists pg_cron with schema pg_catalog;

create function private.purge_old_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.watch_events where created_at < now() - interval '90 days';
  delete from public.video_events where created_at < now() - interval '90 days';
  delete from public.inbox_items where created_at < now() - interval '90 days';
  delete from public.push_events where created_at < now() - interval '30 days';
  delete from public.time_requests where created_at < now() - interval '30 days';
  delete from public.reports where status = 'reviewed' and created_at < now() - interval '180 days';
  delete from private.profile_sessions where expires_at < now();
  delete from private.parent_sessions where expires_at < now();
end;
$$;

revoke all on function private.purge_old_data() from public, anon, authenticated;

-- 21:10 UTC daily: 02:10 in Turkmenistan (UTC+5), when nobody should be watching.
select cron.schedule('payhas-purge-old-data', '10 21 * * *', $$select private.purge_old_data()$$);
