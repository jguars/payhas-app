-- Payhas Plus: test mode, until a bank is connected.
--
-- While private.settings.plus_test_mode is true:
--   · simulate_card_payment(): "Pay by card" on the Plus page goes through
--     Halkbank, Senagat Bank or Rysgal Bank as a simulation — no money moves
--     and the card details never leave the phone. Each payment adds a month.
--   · simulate_plus(): a secret test key turns Plus on (a month) or off for
--     the family, to test both plans quickly.
-- Only the key's SHA-256 hash is stored. Wrong keys count toward the same
-- 5-an-hour lockout as activation codes.
--
-- Before launch, turn test mode off (both functions then refuse):
--   update private.settings set value = 'false' where key = 'plus_test_mode';

insert into private.settings (key, value) values
  ('plus_test_mode', 'true'),
  ('plus_test_key_sha256', '"7dfc2508a803f21062566a0432cec0768ca5ac7790b445cee120d9b44bec5e22"');

create function private.plus_test_mode()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select value::boolean from private.settings where key = 'plus_test_mode'), false);
$$;

-- A new paid period, starting when the current one ends.
create function private.add_plus_month(p_family uuid, p_source text, p_ref text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from timestamptz := greatest(now(), coalesce(private.plus_until(p_family), now()));
begin
  insert into private.plus_periods (family_id, starts_at, ends_at, source, ref)
  values (p_family, v_from, v_from + interval '1 month', p_source, p_ref);
  return private.plus_until(p_family);
end;
$$;

-- 'ok' (with plus_until), 'unavailable' (test mode off) or 'invalid' (unknown bank).
create function public.simulate_card_payment(p_parent uuid, p_bank text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family uuid := private.parent_family(p_parent);
begin
  if not private.plus_test_mode() then
    return jsonb_build_object('result', 'unavailable');
  end if;
  if p_bank not in ('halkbank', 'senagat', 'rysgal') then
    return jsonb_build_object('result', 'invalid');
  end if;
  return jsonb_build_object('result', 'ok', 'plus_until', private.add_plus_month(v_family, 'card', 'test:' || p_bank));
end;
$$;

-- p_on true: Plus for a month; false: back to Free now (ends every current
-- period, codes and cards included — it's for testing). 'ok', 'invalid',
-- 'too_many' or 'unavailable'. Never raises on a bad key, so the try counts.
create function public.simulate_plus(p_parent uuid, p_key text, p_on boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family uuid := private.parent_family(p_parent);
begin
  if not private.plus_test_mode() then
    return jsonb_build_object('result', 'unavailable');
  end if;
  if (select count(*) from private.code_attempts
       where family_id = v_family and created_at > now() - interval '1 hour') >= 5 then
    return jsonb_build_object('result', 'too_many');
  end if;
  if encode(extensions.digest(upper(btrim(coalesce(p_key, ''))), 'sha256'), 'hex')
     is distinct from (select value #>> '{}' from private.settings where key = 'plus_test_key_sha256') then
    insert into private.code_attempts (family_id) values (v_family);
    return jsonb_build_object('result', 'invalid');
  end if;

  if p_on then
    perform private.add_plus_month(v_family, 'gift', 'test-key');
  else
    update private.plus_periods
       set starts_at = least(starts_at, now() - interval '1 second'), ends_at = now()
     where family_id = v_family and ends_at > now();
  end if;
  return jsonb_build_object('result', 'ok', 'plus', private.is_plus(v_family), 'plus_until', private.plus_until(v_family));
end;
$$;

-- The plan now says whether card payment (simulated, for now) is open.
create or replace function public.get_family_plan()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_family uuid := private.my_family_id();
begin
  if v_family is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'plus', private.is_plus(v_family),
    'plus_until', private.plus_until(v_family),
    'profile_limit', private.profile_limit(v_family),
    'profiles', (select count(*) from public.profiles where family_id = v_family),
    'price_tmt', 20,
    'card_payments', private.plus_test_mode(),
    'test_mode', private.plus_test_mode()
  );
end;
$$;

revoke all on function private.plus_test_mode(), private.add_plus_month(uuid, text, text) from public, anon, authenticated;
revoke all on function public.simulate_card_payment(uuid, text) from public, anon;
revoke all on function public.simulate_plus(uuid, text, boolean) from public, anon;
grant execute on function public.simulate_card_payment(uuid, text) to authenticated;
grant execute on function public.simulate_plus(uuid, text, boolean) to authenticated;
