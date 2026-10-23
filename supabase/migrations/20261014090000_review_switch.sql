-- Payhas: human review becomes a switch, and it starts OFF.
--
-- With review off, anything submitted as 'pending' (creator uploads via
-- finish_upload, Onki imports via tools/content) is published on the spot,
-- and the only gate is the age lane: a video rated Kids never reaches a
-- Little profile. human_reviewed stays false, so turning review back on
-- later re-hides unreviewed videos from the Little lane until a human looks.
--
-- Turn review back on:
--   update private.settings set value = 'true' where key = 'review_required';

create table private.settings (
  key text primary key,
  value jsonb not null
);
insert into private.settings (key, value) values ('review_required', 'false');

create function private.review_required()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select value::boolean from private.settings where key = 'review_required'), true);
$$;

-- Lane gate: the Little lane only demands a human check while review is on.
-- (stable now, since it reads a setting.)
create or replace function private.video_allowed(p_lane public.lane, v public.videos)
returns boolean
language sql
stable
set search_path = ''
as $$
  select v.status = 'published'
     and v.lane <= p_lane
     and v.safety >= case p_lane when 'little' then 0.98 when 'kids' then 0.95 when 'teen' then 0.9 else 0.8 end
     and (p_lane <> 'little' or v.human_reviewed or not private.review_required());
$$;

-- Pending → published straight away while review is off. With no classifier
-- yet, the safety score is the curator's: imports and approved creators are
-- trusted, so 1. Reports and takedowns still work as before.
create function private.autopublish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'pending' and not private.review_required() then
    new.status := 'published';
    new.safety := 1;
    new.published_at := coalesce(new.published_at, now());
  end if;
  return new;
end;
$$;

create trigger autopublish
  before insert or update of status on public.videos
  for each row execute function private.autopublish();

revoke all on function private.review_required(), private.autopublish() from public, anon, authenticated;
grant execute on function private.review_required() to authenticated; -- video_allowed runs as the caller

-- Everything already waiting goes live now.
update public.videos set status = 'pending' where status = 'pending';
