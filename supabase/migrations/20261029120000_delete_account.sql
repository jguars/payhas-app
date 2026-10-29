-- Payhas: a parent can delete the whole family account from the app, as the
-- App Store (5.1.1(v)) and Google Play require. Needs the parent PIN, like
-- deleting a single profile.
--
-- Deleting the auth user cascades: families → profiles → every child's watch
-- history, likes, saves, reports, sessions, time requests, inbox, push devices
-- and alerts. Videos a creator uploaded stay (uploaded_by is set null);
-- creators are separate, admin-granted accounts.

create function public.delete_account(p_pin text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.check_pin(p_pin) then
    return false;
  end if;
  delete from auth.users where id = (select auth.uid());
  return true;
end;
$$;

revoke all on function public.delete_account(text) from public, anon;
grant execute on function public.delete_account(text) to authenticated;
