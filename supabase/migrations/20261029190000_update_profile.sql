-- Payhas: a parent edits a profile — name, avatar and (for a child) birth
-- month — from an open parent session (the dashboard's PIN).
--
-- The lane still comes from the birth month, as in onboarding. If it changes:
-- interests the new lane doesn't allow are dropped, and the profile's open
-- sessions end (the next open picks up the new lane). The parent's own
-- profile has no birth month and stays in the Adult lane.

create function public.update_profile(
  p_parent uuid,
  p_profile_id uuid,
  p_name text,
  p_avatar text,
  p_birth_month date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family uuid := private.parent_family(p_parent);
  v_row public.profiles;
  v_lane public.lane;
begin
  select * into v_row from public.profiles where id = p_profile_id and family_id = v_family for update;
  if not found then
    raise exception 'profile not found' using errcode = 'P0002';
  end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 30 then
    raise exception 'name must be 1–30 characters' using errcode = '22023';
  end if;
  if p_avatar not in ('cat', 'bear', 'bunny', 'fox', 'owl', 'panda') then
    raise exception 'unknown avatar' using errcode = '22023';
  end if;

  v_lane := v_row.lane;
  if p_birth_month is not null and not v_row.is_parent then
    if p_birth_month > current_date or p_birth_month < current_date - interval '110 years' then
      raise exception 'invalid birth month' using errcode = '22023';
    end if;
    v_lane := private.lane_for_birth(date_trunc('month', p_birth_month)::date);
  end if;

  update public.profiles
     set display_name = trim(p_name),
         avatar = p_avatar,
         birth_month = case when p_birth_month is not null and not v_row.is_parent
                            then date_trunc('month', p_birth_month)::date else birth_month end,
         lane = v_lane,
         -- Leaving the Adult lane takes the adult-only bits with it.
         pin_protected = case when v_lane = 'adult' then pin_protected else false end
   where id = p_profile_id;

  if v_lane is distinct from v_row.lane then
    delete from public.profile_interests pi
     using public.interests i
     where pi.profile_id = p_profile_id and i.slug = pi.interest_slug and i.youngest_lane > v_lane;
    delete from private.profile_sessions where profile_id = p_profile_id;
  end if;

  return jsonb_build_object('lane', v_lane, 'lane_changed', v_lane is distinct from v_row.lane);
end;
$$;

revoke all on function public.update_profile(uuid, uuid, text, text, date) from public, anon;
grant execute on function public.update_profile(uuid, uuid, text, text, date) to authenticated;
