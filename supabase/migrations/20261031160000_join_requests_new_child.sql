-- A child's phone can ask before the parent has added that child
-- (docs/FAMILY_LINKS_BACKLOG.md, item 8).
--
-- On the request sheet the parent picks "New child": the request is held
-- (30 minutes) while they set the child up, and the new profile is then given
-- the phone. The asking phone shows "Your parent is setting you up…" meanwhile.
-- Allowing still needs the PIN: set-up asks for it, and assign_join_request
-- takes the parent session that proves it.

alter table private.join_requests drop constraint join_requests_status_check;
alter table private.join_requests add constraint join_requests_status_check check (status in ('pending', 'held', 'allowed', 'declined'));

-- The asking phone sees 'held' too.
create or replace function public.join_request_status(p_id uuid, p_secret_hash bytea)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select jsonb_build_object('state',
       case
         when r.status = 'allowed' and r.device_user is not null then 'claimed'
         when r.status = 'allowed' then 'allowed'
         when r.status = 'declined' then 'declined'
         when r.expires_at < now() then 'expired'
         else r.status
       end,
       'family_id', r.family_id, 'profile_id', r.profile_id)
       from private.join_requests r where r.id = p_id and r.secret_hash = p_secret_hash),
    jsonb_build_object('state', 'expired'));
$$;

-- Open requests, held ones included (set-up was left halfway: the sheet offers it again).
drop function public.pending_join_requests();
create function public.pending_join_requests()
returns table (id uuid, device_name text, match text, held boolean, created_at timestamptz, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.device_name, r.match, r.status = 'held', r.created_at, r.expires_at
    from private.join_requests r
   where r.family_id = private.parent_family_of((select auth.uid()))
     and r.status in ('pending', 'held') and r.expires_at > now()
   order by r.created_at;
$$;

-- Declining works on a held request too.
create or replace function public.answer_join_request(p_request uuid, p_allow boolean, p_profile uuid default null, p_pin text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family uuid := private.parent_family_of((select auth.uid()));
begin
  if v_family is null then
    raise exception 'not a parent' using errcode = '42501';
  end if;
  if not exists (select 1 from private.join_requests
                  where id = p_request and family_id = v_family and status in ('pending', 'held') and expires_at > now()) then
    return 'gone';
  end if;
  if not p_allow then
    update private.join_requests set status = 'declined', answered_at = now() where id = p_request;
    return 'ok';
  end if;
  if not exists (select 1 from public.profiles where id = p_profile and family_id = v_family and not is_parent) then
    return 'bad_profile';
  end if;
  if not private.check_pin(p_pin) then
    return 'bad_pin';
  end if;
  update private.join_requests
     set status = 'allowed', profile_id = p_profile, answered_at = now(),
         expires_at = greatest(expires_at, now() + interval '10 minutes')
   where id = p_request;
  return 'ok';
end;
$$;

/** "New child": hold the request while the parent sets the child up. Grants nothing yet, so no PIN here. */
create function public.hold_join_request(p_request uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.join_requests set status = 'held', expires_at = greatest(expires_at, now() + interval '30 minutes')
   where id = p_request and family_id = private.parent_family_of((select auth.uid()))
     and status in ('pending', 'held') and expires_at > now();
  return case when found then 'ok' else 'gone' end;
end;
$$;

/** Set-up done: the new child gets the phone. The parent session (opened with the PIN) is the permission. */
create function public.assign_join_request(p_parent uuid, p_request uuid, p_profile uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family uuid := private.parent_family(p_parent);
begin
  if not exists (select 1 from public.profiles where id = p_profile and family_id = v_family and not is_parent) then
    return 'bad_profile';
  end if;
  update private.join_requests
     set status = 'allowed', profile_id = p_profile, answered_at = now(),
         expires_at = greatest(expires_at, now() + interval '10 minutes')
   where id = p_request and family_id = v_family and status in ('pending', 'held') and expires_at > now();
  return case when found then 'ok' else 'gone' end;
end;
$$;

revoke all on function public.pending_join_requests(), public.hold_join_request(uuid), public.assign_join_request(uuid, uuid, uuid) from public, anon;
grant execute on function public.pending_join_requests(), public.hold_join_request(uuid), public.assign_join_request(uuid, uuid, uuid) to authenticated;
