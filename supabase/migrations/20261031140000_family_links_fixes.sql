-- Family links backlog (docs/FAMILY_LINKS_BACKLOG.md), fixes 1 and 5.
--
-- 1. "Sign out of this phone" on a child's phone now needs the parent PIN.
--    Without it a child could unlink their phone and sign up a family of
--    their own, with no limits.
-- 5. A linked phone's login goes whenever its family_devices row goes: when
--    the parent deletes the child, deletes the family, or removes the phone.
--    Before, deleting a child or the family left the phone's auth user behind.
--    Logins already left behind are removed at the end.

-- ── 1 ────────────────────────────────────────────────────────────────────────
drop function public.leave_family_phone();
/** "Sign out of this phone": with the parent PIN, the phone leaves the family; a new code links it again. */
create function public.leave_family_phone(p_pin text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.family_devices where user_id = (select auth.uid()) and kind in ('child', 'shared')) then
    raise exception 'not a linked phone' using errcode = '42501';
  end if;
  if not private.check_pin(p_pin) then
    return false;
  end if;
  delete from private.profile_sessions where owner_id = (select auth.uid());
  delete from auth.users where id = (select auth.uid());
  return true;
end;
$$;
revoke all on function public.leave_family_phone(text) from public, anon;
grant execute on function public.leave_family_phone(text) to authenticated;

-- ── 5 ────────────────────────────────────────────────────────────────────────
-- Runs after the row is gone, however it went (cascade from the profile, the
-- family or the user). When the user itself was being deleted, this finds
-- nothing and does nothing.
create function private.drop_device_login()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from auth.users where id = old.user_id;
  return null;
end;
$$;
revoke all on function private.drop_device_login() from public, anon, authenticated;

create trigger family_devices_drop_login
  after delete on public.family_devices
  for each row execute function private.drop_device_login();

-- Logins already left behind: linked phones (and co-parents) with no family_devices row.
delete from auth.users u
 where (u.email like '%@devices.payhas.invalid' or u.raw_user_meta_data ->> 'joins_family' = 'true')
   and not exists (select 1 from public.family_devices d where d.user_id = u.id);
