-- Payhas: the parent's own profile is "Parent", not just another Adult.
--
-- Onboarding creates the parent's profile first, in the Adult lane. It stays
-- in that lane for what it may watch; is_parent only changes how the app names
-- it (Who's watching?, Me, the Family dashboard). Other adults in the household
-- stay "Adult".
--
-- A family's first adult profile becomes its parent profile, here for existing
-- families and by trigger from now on. If the parent profile is deleted, the
-- next adult profile added takes the role.

alter table public.profiles add column is_parent boolean not null default false;

create unique index profiles_one_parent_per_family on public.profiles (family_id) where is_parent;

update public.profiles p
   set is_parent = true
 where p.lane = 'adult'
   and p.id = (select q.id from public.profiles q
                where q.family_id = p.family_id and q.lane = 'adult'
                order by q.created_at, q.id limit 1);

create function private.mark_parent_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.is_parent := new.lane = 'adult'
    and not exists (select 1 from public.profiles where family_id = new.family_id and is_parent);
  return new;
end;
$$;

create trigger mark_parent_profile
  before insert on public.profiles
  for each row execute function private.mark_parent_profile();

revoke all on function private.mark_parent_profile() from public, anon, authenticated;
