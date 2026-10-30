-- Payhas Plus: the parent and up to 3 children (4 profiles). Free stays at 2:
-- the parent and 1 child. The parent's own profile counts toward the limit.

create or replace function private.profile_limit(p_family uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select case when private.is_plus(p_family) then 4 else 2 end;
$$;

create or replace function private.enforce_profile_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.profiles where family_id = new.family_id) >= private.profile_limit(new.family_id) then
    raise exception 'plan_profile_limit' using errcode = 'P0001',
      hint = 'Free families have 2 profiles (the parent and 1 child); Payhas Plus has 4 (the parent and 3 children).';
  end if;
  return new;
end;
$$;

revoke all on function private.profile_limit(uuid), private.enforce_profile_limit() from public, anon, authenticated;
