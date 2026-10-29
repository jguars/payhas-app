-- Payhas: a parent agrees to the privacy notice before adding a child
-- (COPPA §312.5, GDPR Art. 8, Turkmenistan Art. 7; privacy review item 2).
--
-- The app shows the notice and calls give_parental_consent() from an open
-- parent session (PIN), on an account whose email is already confirmed. The
-- record keeps which policy version and language were shown, and when. A
-- trigger refuses any new child profile until the family has consented, so
-- no path into create_profile can skip it. Children added before this
-- migration keep their profiles; the next child needs consent first.
-- Withdrawing consent = deleting the account (delete_account), which cascades.

create table private.parental_consents (
  id bigint generated always as identity primary key,
  family_id uuid not null references public.families (id) on delete cascade,
  policy_version text not null check (char_length(policy_version) between 1 and 40),
  language text not null check (language in ('en', 'tk', 'tr', 'ru')),
  consented_at timestamptz not null default now()
);
create index parental_consents_family_id_idx on private.parental_consents (family_id);

create function public.give_parental_consent(p_parent uuid, p_version text, p_language text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.parental_consents (family_id, policy_version, language)
  values (private.parent_family(p_parent), p_version, p_language);
end;
$$;

-- Has this family agreed to this version of the notice?
create function public.has_parental_consent(p_version text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.parental_consents c
     where c.family_id = private.my_family_id() and c.policy_version = p_version
  );
$$;

create function private.require_parental_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.lane <> 'adult' and not exists (select 1 from private.parental_consents where family_id = new.family_id) then
    raise exception 'parental consent required' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_require_parental_consent
  before insert on public.profiles
  for each row execute function private.require_parental_consent();

revoke all on function public.give_parental_consent(uuid, text, text), public.has_parental_consent(text) from public, anon;
revoke all on function private.require_parental_consent() from public, anon, authenticated;
grant execute on function public.give_parental_consent(uuid, text, text), public.has_parental_consent(text) to authenticated;
