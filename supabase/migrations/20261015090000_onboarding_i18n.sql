-- Payhas: onboarding that shapes the feed, and four languages.
--
--   • Onboarding collects, per family: language, a parent profile and the PIN;
--     per child: birth month (→ lane, computed here, not picked), interests,
--     a learning-vs-fun mix, a daily limit and bedtime. One parent session
--     (start_parent_session) authorises the whole run.
--   • get_for_you(): the For You feed is ranked per profile — interest
--     matches, the learning mix, followed channels, freshness, and a push
--     down for what was watched recently — with a stable daily shuffle, paged
--     by excluding what the client already has.
--   • Languages: en, tk (Turkmen), tr (Turkish), ru (Russian). Captions carry
--     translations in videos.caption_i18n; new-video inbox notices copy them.

-- ── data ────────────────────────────────────────────────────────────────────
alter table public.families
  add column language text not null default 'en' check (language in ('en', 'tk', 'tr', 'ru')),
  add column onboarded_at timestamptz;

-- Families that already have profiles were set up before onboarding existed.
update public.families f set onboarded_at = now()
 where exists (select 1 from public.profiles p where p.family_id = f.id);

alter table public.profiles
  add column birth_month date check (birth_month is null or (birth_month >= date '1900-01-01' and extract(day from birth_month) = 1)),
  add column language text check (language is null or language in ('en', 'tk', 'tr', 'ru')),
  -- 0 = mostly fun, 1 = a bit of both, 2 = mostly learning
  add column learning_mix smallint not null default 1 check (learning_mix between 0 and 2);

alter table public.videos
  add column caption_i18n jsonb not null default '{}'::jsonb;

alter table public.inbox_items
  add column body_i18n jsonb;

-- ── helpers ─────────────────────────────────────────────────────────────────
-- Age on today's date from a birth month → the lane it belongs in.
create function private.lane_for_birth(p_birth date)
returns public.lane
language sql
stable
set search_path = ''
as $$
  select case
    when extract(year from age(current_date, p_birth)) < 7 then 'little'::public.lane
    when extract(year from age(current_date, p_birth)) < 13 then 'kids'::public.lane
    when extract(year from age(current_date, p_birth)) < 18 then 'teen'::public.lane
    else 'adult'::public.lane
  end;
$$;

revoke all on function private.lane_for_birth(date) from public, anon, authenticated;

-- ── onboarding ──────────────────────────────────────────────────────────────
-- Creates a profile with everything onboarding asked. Lane comes from the
-- birth month; interests are kept only where the lane allows them. Adults
-- (the parent's own profile) are PIN-protected and get no limits.
create function public.create_profile(
  p_parent uuid,
  p_name text,
  p_birth_month date,
  p_language text default null,
  p_learning_mix smallint default 1,
  p_interests text[] default '{}',
  p_daily_limit_minutes smallint default null,
  p_quiet_hours boolean default false,
  p_bedtime_hour smallint default 20,
  p_wake_hour smallint default 7,
  p_adult boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family uuid := private.parent_family(p_parent);
  v_lane public.lane;
  v_id uuid;
begin
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 30 then
    raise exception 'name must be 1–30 characters' using errcode = '22023';
  end if;
  if not coalesce(p_adult, false)
     and (p_birth_month is null or p_birth_month > current_date or p_birth_month < current_date - interval '110 years') then
    raise exception 'invalid birth month' using errcode = '22023';
  end if;
  if (select count(*) from public.profiles where family_id = v_family) >= 6 then
    raise exception 'a family can have up to 6 profiles' using errcode = '22023';
  end if;

  -- A parent's own profile needs no birth month; everyone else's lane comes from theirs.
  v_lane := case when coalesce(p_adult, false) then 'adult'::public.lane
                 else private.lane_for_birth(date_trunc('month', p_birth_month)::date) end;

  insert into public.profiles (family_id, display_name, lane, pin_protected, birth_month, language, learning_mix,
                               daily_limit_minutes, quiet_hours, bedtime_hour, wake_hour)
  values (v_family, trim(p_name), v_lane, v_lane = 'adult', date_trunc('month', p_birth_month)::date,
          case when p_language in ('en', 'tk', 'tr', 'ru') then p_language end,
          least(greatest(coalesce(p_learning_mix, 1), 0), 2),
          case when v_lane = 'adult' then null else p_daily_limit_minutes end,
          v_lane <> 'adult' and coalesce(p_quiet_hours, false),
          coalesce(p_bedtime_hour, 20), coalesce(p_wake_hour, 7))
  returning id into v_id;

  insert into public.profile_interests (profile_id, interest_slug)
  select v_id, i.slug
    from public.interests i
   where i.slug = any (coalesce(p_interests, '{}')) and i.youngest_lane <= v_lane
  on conflict do nothing;

  return v_id;
end;
$$;

create function public.finish_onboarding(p_parent uuid, p_language text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family uuid := private.parent_family(p_parent);
begin
  update public.families
     set onboarded_at = coalesce(onboarded_at, now()),
         language = case when p_language in ('en', 'tk', 'tr', 'ru') then p_language else language end
   where id = v_family;
end;
$$;

-- The app language can change any time (Me → Language); no PIN needed.
create function public.set_family_language(p_language text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.families set language = p_language
   where owner_id = (select auth.uid()) and p_language in ('en', 'tk', 'tr', 'ru');
$$;

-- ── the For You feed, ranked per profile ────────────────────────────────────
create function public.get_for_you(p_session uuid, p_limit int default 15, p_exclude uuid[] default '{}')
returns setof public.videos
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles := private.session_profile(p_session);
  v_interests text[] := array(select interest_slug from public.profile_interests where profile_id = v_profile.id);
  v_learning text[] := array['learning', 'science'];
  v_salt text := v_profile.id::text || current_date::text;
begin
  return query
    select v.*
      from public.videos v
     where private.video_allowed(v_profile.lane, v)
       and not exists (select 1 from public.hidden_videos h where h.profile_id = v_profile.id and h.video_id = v.id)
       and not (v.id = any (coalesce(p_exclude, '{}')))
     order by
       -- what they picked
       3.0 * cardinality(array(select unnest(v.topics) intersect select unnest(v_interests)))
       -- the learning mix: learning videos rise for "mostly learning", sink a little for "mostly fun"
       + case when v.topics && v_learning then (v_profile.learning_mix - 1) * 1.5 else 0 end
       -- channels they follow
       + case when exists (select 1 from public.follows f where f.profile_id = v_profile.id and f.creator_name = v.creator_name) then 2 else 0 end
       -- fresh first, fading over about two weeks
       + 2.0 * exp(-extract(epoch from (now() - coalesce(v.published_at, v.created_at))) / 1209600.0)
       -- seen in the last month: further down
       - case when exists (select 1 from public.watch_events e
                            where e.profile_id = v_profile.id and e.video_id = v.id
                              and e.created_at > now() - interval '30 days') then 4 else 0 end
       -- a shuffle that holds for the day, so paging stays stable
       + (abs(hashtext(v.id::text || v_salt)) % 1000) / 1000.0
       desc
     limit least(greatest(p_limit, 1), 50);
end;
$$;

-- ── captions travel into the inbox ──────────────────────────────────────────
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

  insert into public.inbox_items (profile_id, kind, title, body, body_i18n, video_id)
  select p.id,
         'new_video',
         case when f.profile_id is not null then 'New from ' || new.creator_name
              else 'New in ' || coalesce((select i.label from public.interests i
                                           join public.profile_interests pi on pi.interest_slug = i.slug
                                          where pi.profile_id = p.id and i.slug = any (new.topics)
                                          order by i.sort limit 1), 'your topics') end,
         new.caption,
         nullif(new.caption_i18n, '{}'::jsonb),
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

-- ── grants ──────────────────────────────────────────────────────────────────
revoke all on function public.create_profile(uuid, text, date, text, smallint, text[], smallint, boolean, smallint, smallint, boolean) from public, anon;
revoke all on function public.finish_onboarding(uuid, text) from public, anon;
revoke all on function public.set_family_language(text) from public, anon;
revoke all on function public.get_for_you(uuid, int, uuid[]) from public, anon;

grant execute on function public.create_profile(uuid, text, date, text, smallint, text[], smallint, boolean, smallint, smallint, boolean) to authenticated;
grant execute on function public.finish_onboarding(uuid, text) to authenticated;
grant execute on function public.set_family_language(text) to authenticated;
grant execute on function public.get_for_you(uuid, int, uuid[]) to authenticated;
