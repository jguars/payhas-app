-- Phone sign-in (the main way in; email stays as the second option).
--
-- The family's phone number lives on the family, next to the owner: one
-- number, one family. Only Turkmenistan numbers for now: +993 and 8 digits.
-- The `phone-auth` edge function writes it with the service role; parents
-- can read their own through the existing "owner reads own family" policy
-- and can't change it from the app (no update grant on the column).

alter table public.families
  add column phone text unique
  check (phone ~ '^\+993[0-9]{8}$');

comment on column public.families.phone is
  'The parent''s sign-in number, E.164 (+993 and 8 digits). Set by the phone-auth edge function; null for email-only families.';

-- The rename policy lets owners update their family row; keep the number out of it.
-- A column revoke can't undercut a table-wide grant, so narrow the grant to the name.
revoke update on public.families from authenticated;
grant update (name) on public.families to authenticated;
