-- Join requests without limits, for testing (docs/FAMILY_LINKS_BACKLOG.md, item 8).
--
-- While private.settings.join_request_limits is false, a child's phone can ask
-- as often as it likes: no per-phone, per-IP or per-number caps, no day-long
-- wait after two declines, and no cap on open requests per family.
--
-- Before launch, turn the limits back on:
--   update private.settings set value = 'true' where key = 'join_request_limits';

insert into private.settings (key, value) values ('join_request_limits', 'false')
on conflict (key) do update set value = excluded.value;

create or replace function public.create_join_request(p_phone text, p_name text, p_install text, p_ip text, p_secret_hash bytea)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limits boolean := coalesce((select value::boolean from private.settings where key = 'join_request_limits'), true);
  v_family uuid;
  v_row private.join_requests;
begin
  if v_limits then
    if (select count(*) from private.join_requests where install_id = p_install and status = 'declined' and answered_at > now() - interval '1 day') >= 2 then
      return jsonb_build_object('state', 'blocked');
    end if;
    if (select count(*) from private.join_requests where install_id = p_install and created_at > now() - interval '1 hour') >= 3
       or (select count(*) from private.join_requests where ip = p_ip and created_at > now() - interval '1 hour') >= 3
       or (select count(*) from private.join_requests where phone = p_phone and created_at > now() - interval '1 day') >= 5 then
      return jsonb_build_object('state', 'too_many');
    end if;
  end if;

  -- The parent with this number: the family's owner (phone sign-in) or an allowed co-parent.
  select private.parent_family_of(u.id) into v_family
    from auth.users u
   where u.email = substr(p_phone, 2) || '@phone.payhas.invalid';
  -- At most 3 open requests per family; more just expire unseen.
  if v_limits and v_family is not null and (select count(*) from private.join_requests
       where family_id = v_family and status in ('pending', 'held') and expires_at > now()) >= 3 then
    v_family := null;
  end if;

  -- This phone's older open request is replaced by the new one.
  update private.join_requests set expires_at = now()
   where install_id = p_install and status = 'pending' and expires_at > now();

  insert into private.join_requests (family_id, phone, device_name, install_id, ip, secret_hash, match)
  values (v_family, p_phone, left(coalesce(nullif(trim(p_name), ''), 'Phone'), 60), p_install, p_ip, p_secret_hash,
          (10 + floor(random() * 90))::int::text)
  returning * into v_row;
  delete from private.join_requests where created_at < now() - interval '7 days';

  if v_family is not null then
    perform private.queue_push(v_family, null, 'join_request', '', '', jsonb_build_object('request_id', v_row.id));
  end if;
  return jsonb_build_object('state', 'ok', 'id', v_row.id, 'match', v_row.match, 'expires_at', v_row.expires_at);
end;
$$;
