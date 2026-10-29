-- Payhas: For You v1 — the feed learns from what each profile does.
--
-- get_for_you used to rank on the interests picked at onboarding and only
-- read watch history to push seen clips down. It now also reads the signals
-- the app already logs, per profile, over the last 30 days (or since
-- "Reset taste" in Me, if that's more recent):
--
--   finish +1 · rewatch +2 · reaction +2 · like +3 · save +3 · share +4
--   quick skip −1 · "Not for me" −5
--
-- Each signal counts toward the video's topics, fading with a 10-day time
-- constant. The topic's learned score is bounded (±3) and blended with the
-- onboarding picks, which weigh 3 for a new profile and fade as signals
-- build up, so a fresh profile still starts from what it picked.
--
-- On top of that:
--   · quality: how often a clip is finished and how rarely it's skipped,
--     among profiles in the same lane, pulled toward the lane average until
--     it has enough viewers (anonymous counts, never another child's history;
--     refreshed hourly by pg_cron)
--   · exploration: every 5th slot is a clip from a topic this profile has
--     never shown a signal on, so the feed doesn't narrow
--   · variety: no two clips in a row from the same channel or lead topic
--   · why_this(): the main reason a clip was picked, for "Why this?"
--
-- Lane gating is unchanged: every candidate passes private.video_allowed and
-- hidden videos stay out. Signals from parent-hidden videos don't count as
-- the child's taste (parent_hide_video logs no event).

-- ── per-topic taste for one profile ─────────────────────────────────────────
create function private.topic_affinity(p_profile_id uuid)
returns table (topic text, score double precision, learned double precision, picked boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with since as (
    -- "Reset taste" in Me starts the 30 days over
    select greatest(now() - interval '30 days', coalesce(p.taste_reset_at, '-infinity')) as t
      from public.profiles p where p.id = p_profile_id
  ),
  sig as (
    select e.video_id, e.created_at,
           case e.kind when 'finish' then 1 when 'rewatch' then 2 when 'share' then 4
                       when 'quick_skip' then -1 when 'not_interested' then -5 end::float8 as w
      from public.video_events e
     where e.profile_id = p_profile_id and e.kind <> 'impression'
       and e.created_at > (select t from since)
    union all
    select l.video_id, l.created_at, 3 from public.likes l
     where l.profile_id = p_profile_id and l.created_at > (select t from since)
    union all
    select s.video_id, s.created_at, 3 from public.saves s
     where s.profile_id = p_profile_id and s.created_at > (select t from since)
    union all
    select r.video_id, min(r.created_at), 2 from public.reactions r
     where r.profile_id = p_profile_id and r.created_at > (select t from since)
     group by r.video_id
  ),
  per_topic as (
    select t.topic,
           sum(sig.w * exp(-extract(epoch from (now() - sig.created_at)) / 864000.0) / cardinality(v.topics)) as raw
      from sig
      join public.videos v on v.id = sig.video_id
     cross join lateral unnest(v.topics) as t(topic)
     group by t.topic
  ),
  picks as (
    select pi.interest_slug as topic from public.profile_interests pi where pi.profile_id = p_profile_id
  ),
  -- The picks weigh 3 with no signals and fade as signals build up (half at 30).
  prior as (select 3.0 * 30.0 / (30.0 + (select count(*) from sig)) as w)
  select coalesce(pt.topic, pk.topic),
         3.0 * tanh(coalesce(pt.raw, 0) / 4.0) + case when pk.topic is not null then prior.w else 0 end,
         3.0 * tanh(coalesce(pt.raw, 0) / 4.0),
         pk.topic is not null
    from per_topic pt
    full join picks pk on pk.topic = pt.topic
   cross join prior;
$$;

-- ── clip quality within a lane ──────────────────────────────────────────────
-- Per viewer, not per event: a child looping a clip counts once. Shrunk toward
-- the lane average with 10 pseudo-viewers; roughly −2 … +2. Lane-wide numbers
-- move slowly, so they're computed hourly into a small table rather than on
-- every page of every feed.
create table private.video_quality (
  lane public.lane not null,
  video_id uuid not null references public.videos (id) on delete cascade,
  quality double precision not null,
  primary key (lane, video_id)
);
create index video_quality_video_id_idx on private.video_quality (video_id);

create function private.refresh_video_quality()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.video_quality where true;
  with ev as (
    select p.lane, e.video_id,
           count(distinct e.profile_id) filter (where e.kind in ('impression', 'quick_skip'))::float8 as viewers,
           count(distinct e.profile_id) filter (where e.kind = 'finish')::float8 as finishers,
           count(distinct e.profile_id) filter (where e.kind = 'quick_skip')::float8 as skippers
      from public.video_events e
      join public.profiles p on p.id = e.profile_id
     where e.created_at > now() - interval '30 days'
     group by p.lane, e.video_id
  ),
  avg as (
    select lane,
           coalesce(sum(finishers) / nullif(sum(viewers), 0), 0.5) as fin,
           coalesce(sum(skippers) / nullif(sum(viewers), 0), 0.2) as skip
      from ev group by lane
  )
  insert into private.video_quality (lane, video_id, quality)
  select ev.lane, ev.video_id,
         2.0 * ((ev.finishers + 10 * avg.fin) / (ev.viewers + 10) - avg.fin)
       - 2.0 * ((ev.skippers + 10 * avg.skip) / (ev.viewers + 10) - avg.skip)
    from ev join avg using (lane)
   where ev.viewers > 0;
$$;

select private.refresh_video_quality();
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('payhas-video-quality', '23 * * * *', $cron$select private.refresh_video_quality()$cron$);

-- ── every allowed clip, scored for one profile ──────────────────────────────
create function private.for_you_candidates(p_profile public.profiles)
returns table (
  video_id uuid,
  score double precision,
  explore boolean,
  best_topic text,
  best_picked boolean,
  best_learned double precision,
  followed boolean,
  fresh double precision,
  quality double precision
)
language sql
stable
security definer
set search_path = ''
as $$
  with aff as (select * from private.topic_affinity(p_profile.id)),
  allowed as (
    select v.* from public.videos v
     where private.video_allowed(p_profile.lane, v)
       and not exists (select 1 from public.hidden_videos h where h.profile_id = p_profile.id and h.video_id = v.id)
  ),
  -- the clip's topics against this profile's taste: the best topic lifts it,
  -- a disliked topic drags it down
  taste as (
    select a.id,
           greatest(max(t.score), 0) + least(min(t.score), 0) as interest,
           (array_agg(t.topic order by t.score desc))[1] as best_topic,
           (array_agg(t.picked order by t.score desc))[1] as best_picked,
           (array_agg(t.learned order by t.score desc))[1] as best_learned
      from allowed a
     cross join lateral unnest(a.topics) as vt(topic)
      join aff t on t.topic = vt.topic
     group by a.id
  ),
  seen as (
    select distinct e.video_id from public.watch_events e
     where e.profile_id = p_profile.id and e.created_at > now() - interval '30 days'
  ),
  followed as (
    select f.creator_name from public.follows f where f.profile_id = p_profile.id
  ),
  base as (
    select a.id,
           coalesce(t.interest, 0) as interest,
           t.best_topic, t.best_picked, t.best_learned,
           t.id is null as untried,
           f.creator_name is not null as followed,
           -- fresh first, fading over about two weeks
           2.0 * exp(-extract(epoch from (now() - coalesce(a.published_at, a.created_at))) / 1209600.0) as fresh,
           coalesce(q.quality, 0) as quality,
           -- the learning mix: learning videos rise for "mostly learning", sink a little for "mostly fun"
           case when a.topics && array['learning', 'science'] then (p_profile.learning_mix - 1) * 1.5 else 0 end as learning,
           -- seen in the last month: further down
           case when s.video_id is not null then -4 else 0 end as seen,
           -- a shuffle that holds for the day, so paging stays stable
           (abs(hashtext(a.id::text || p_profile.id::text || current_date::text)) % 1000) / 1000.0 as shuffle
      from allowed a
      left join taste t on t.id = a.id
      left join followed f on f.creator_name = a.creator_name
      left join private.video_quality q on q.lane = p_profile.lane and q.video_id = a.id
      left join seen s on s.video_id = a.id
  )
  select b.id,
         b.interest + b.learning + case when b.followed then 2 else 0 end + b.fresh + b.quality + b.seen + b.shuffle,
         b.untried and not b.followed,
         b.best_topic,
         coalesce(b.best_picked, false),
         coalesce(b.best_learned, 0),
         b.followed,
         b.fresh,
         b.quality
    from base b;
$$;

-- ── For You ─────────────────────────────────────────────────────────────────
create or replace function public.get_for_you(p_session uuid, p_limit int default 15, p_exclude uuid[] default '{}')
returns setof public.videos
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles := private.session_profile(p_session);
  v_limit int := least(greatest(p_limit, 1), 50);
  v_ids uuid[];
  v_creators text[];
  v_leads text[];
  v_explore boolean[];
  v_used boolean[];
  v_out uuid[] := '{}';
  v_n int;
  v_pick int;
  v_want_explore boolean;
  v_last_creator text;
  v_last_lead text;
begin
  -- The pool: the best regular candidates plus the best untried ones.
  select array_agg(c.video_id order by c.score desc),
         array_agg(v.creator_name order by c.score desc),
         array_agg(coalesce(v.topics[1], '') order by c.score desc),
         array_agg(c.explore order by c.score desc)
    into v_ids, v_creators, v_leads, v_explore
    from (
      select x.*, row_number() over (partition by x.explore order by x.score desc) as rank
        from private.for_you_candidates(v_profile) x
       where not (x.video_id = any (coalesce(p_exclude, '{}')))
    ) c
    join public.videos v on v.id = c.video_id
   where c.rank <= case when c.explore then v_limit else v_limit * 4 end;

  v_n := coalesce(array_length(v_ids, 1), 0);
  v_used := array_fill(false, array[greatest(v_n, 1)]);

  -- Fill slot by slot: every 5th slot prefers an untried topic; no slot
  -- repeats the previous clip's channel or lead topic unless nothing else is left.
  while cardinality(v_out) < least(v_limit, v_n) loop
    v_want_explore := (cardinality(v_out) + 1) % 5 = 0;
    v_pick := null;
    for pass in 1..3 loop
      for i in 1..v_n loop
        continue when v_used[i];
        continue when pass = 1 and v_explore[i] <> v_want_explore;
        continue when pass < 3 and (v_creators[i] = v_last_creator or (v_leads[i] <> '' and v_leads[i] = v_last_lead));
        v_pick := i;
        exit;
      end loop;
      exit when v_pick is not null;
    end loop;
    v_used[v_pick] := true;
    v_out := v_out || v_ids[v_pick];
    v_last_creator := v_creators[v_pick];
    v_last_lead := v_leads[v_pick];
  end loop;

  return query
    select v.*
      from unnest(v_out) with ordinality as o(id, ord)
      join public.videos v on v.id = o.id
     order by o.ord;
end;
$$;

-- ── Why this? ───────────────────────────────────────────────────────────────
-- The main reason a clip is in this profile's For You, or null when the clip
-- isn't allowed for the profile:
--   following · picked (an onboarding interest) · liked (a topic it engages
--   with) · explore (a topic it hasn't tried) · new · popular (above its
--   lane's average) · for_you (none of these stands out)
create function public.why_this(p_session uuid, p_video_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles := private.session_profile(p_session);
  c record;
  v_reason text;
begin
  select * into c from private.for_you_candidates(v_profile) x where x.video_id = p_video_id;
  if not found then
    return null;
  end if;
  v_reason := case
    when c.followed then 'following'
    when c.best_topic is not null and c.best_learned >= 1 then 'liked'
    when c.best_topic is not null and c.best_picked then 'picked'
    when c.explore then 'explore'
    when c.fresh >= 1 then 'new'
    when c.quality > 0.2 then 'popular'
    else 'for_you'
  end;
  return jsonb_build_object('reason', v_reason, 'topic', case when v_reason in ('liked', 'picked') then c.best_topic end);
end;
$$;

revoke all on function private.topic_affinity(uuid) from public, anon, authenticated;
revoke all on function private.refresh_video_quality() from public, anon, authenticated;
revoke all on private.video_quality from anon, authenticated;
revoke all on function private.for_you_candidates(public.profiles) from public, anon, authenticated;
revoke all on function public.why_this(uuid, uuid) from public, anon;
grant execute on function public.why_this(uuid, uuid) to authenticated;
