-- A child's phone asks to join (docs/FAMILY_LINKS_BACKLOG.md, item 8).
--
-- Until now only the parent could start a link (Link phone → code → Allow).
-- Now the child's phone can ask too: it types the parent's number and shows a
-- 2-digit match number; the parent's phone gets the request wherever they are
-- in the app (and a push on Android), checks the number, picks which child the
-- phone is for, and allows it with the PIN.
--
-- The asking phone has no login while it waits: the `ask-family` edge function
-- keeps a secret for the request and, once the parent allows it, makes the
-- phone its own user (an active child phone, like the code path makes).
--
-- Nobody can find out who uses Payhas: an unknown number, a full family or a
-- number with no family all look the same to the asking phone ("Asking…",
-- then "No answer" after 10 minutes). Limits: 3 asks an hour per phone and per
-- IP, 5 a day per parent number, and a phone turned away twice waits a day.

create table private.join_requests (
  id uuid primary key default gen_random_uuid(),
  -- Null when the number has no family (or the family has 3 open requests): it just expires.
  family_id uuid references public.families (id) on delete cascade,
  phone text not null check (phone ~ '^\+993[0-9]{8}$'),
  device_name text not null check (char_length(device_name) between 1 and 60),
  install_id text not null check (char_length(install_id) between 8 and 64),
  ip text not null,
  secret_hash bytea not null,
  match text not null check (match ~ '^[1-9][0-9]$'),
  status text not null default 'pending' check (status in ('pending', 'allowed', 'declined')),
  profile_id uuid references public.profiles (id) on delete cascade,
  device_user uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes',
  answered_at timestamptz
);
create index join_requests_family_idx on private.join_requests (family_id, status, expires_at);
create index join_requests_install_idx on private.join_requests (install_id, created_at desc);
create index join_requests_ip_idx on private.join_requests (ip, created_at desc);
create index join_requests_phone_idx on private.join_requests (phone, created_at desc);

-- Alerts: a phone asking to join.
alter table public.push_events drop constraint push_events_kind_check;
alter table public.push_events add constraint push_events_kind_check check (kind in ('limit', 'flag', 'more_time', 'join_request'));

create or replace function private.queue_push(p_family uuid, p_profile uuid, p_kind text, p_title text, p_body text, p_data jsonb default '{}')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
  v_lang text;
  v_title text;
  v_body text;
begin
  -- No opted-in phone, nothing to send.
  if not exists (select 1 from public.push_devices where family_id = p_family) then
    return;
  end if;
  select language into v_lang from public.families where id = p_family;
  select t.title, t.body into v_title, v_body
    from (values
      ('en', 'limit',        'Screen time is up',            'One of your children reached today’s limit. Open Payhas to see who.'),
      ('en', 'flag',         'A video was flagged',          'One of your children flagged a video. It’s hidden and with our moderators.'),
      ('en', 'more_time',    'More time requested',          'One of your children is asking for more time. Open Payhas to answer.'),
      ('en', 'join_request', 'A phone wants to join',        'Open Payhas to check it and choose who it’s for.'),
      ('tk', 'limit',        'Ekran wagty gutardy',          'Çagalaryňyzyň biri şu günki çägine ýetdi. Kimdigini görmek üçin Payhas-y açyň.'),
      ('tk', 'flag',         'Wideo bellendi',               'Çagalaryňyzyň biri bir wideony belledi. Ol gizlendi we moderatorlarymyza iberildi.'),
      ('tk', 'more_time',    'Goşmaça wagt soralýar',        'Çagalaryňyzyň biri goşmaça wagt soraýar. Jogap bermek üçin Payhas-y açyň.'),
      ('tk', 'join_request', 'Bir telefon goşulmak isleýär', 'Barlamak we kimiňkidigini saýlamak üçin Payhas-y açyň.'),
      ('tr', 'limit',        'Ekran süresi doldu',           'Çocuklarınızdan biri bugünkü sınırına ulaştı. Kim olduğunu görmek için Payhas’ı açın.'),
      ('tr', 'flag',         'Bir video işaretlendi',        'Çocuklarınızdan biri bir videoyu işaretledi. Video gizlendi ve moderatörlerimize iletildi.'),
      ('tr', 'more_time',    'Ek süre isteniyor',            'Çocuklarınızdan biri ek süre istiyor. Yanıtlamak için Payhas’ı açın.'),
      ('tr', 'join_request', 'Bir telefon katılmak istiyor', 'Kontrol etmek ve kimin olduğunu seçmek için Payhas’ı açın.'),
      ('ru', 'limit',        'Время экрана вышло',           'Один из ваших детей исчерпал лимит на сегодня. Откройте Payhas, чтобы узнать, кто.'),
      ('ru', 'flag',         'Отмечено видео',               'Один из ваших детей отметил видео. Оно скрыто и передано нашим модераторам.'),
      ('ru', 'more_time',    'Просят ещё времени',           'Один из ваших детей просит ещё времени. Откройте Payhas, чтобы ответить.'),
      ('ru', 'join_request', 'Телефон просит подключения',   'Откройте Payhas, чтобы проверить его и выбрать, чей он.')
    ) as t(lang, kind, title, body)
   where t.lang = coalesce(v_lang, 'en') and t.kind = p_kind;
  insert into public.push_events (family_id, profile_id, kind, title, body, data)
  values (p_family, p_profile, p_kind, coalesce(v_title, 'Payhas'), coalesce(v_body, ''), p_data)
  returning id into v_id;
  -- pg_net sends after this transaction commits, so the row is there to read.
  perform net.http_post(
    url := 'https://qlaqljpwcwyunffyrfdt.supabase.co/functions/v1/push',
    body := jsonb_build_object('event_id', v_id),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
end;
$$;

-- ── the asking phone (ask-family edge function, service role) ───────────────
/**
 * A new request. Returns {state: ok, id, match, expires_at} — the same for a
 * number with or without a family — or {state: too_many | blocked}.
 */
create function public.create_join_request(p_phone text, p_name text, p_install text, p_ip text, p_secret_hash bytea)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family uuid;
  v_row private.join_requests;
begin
  if (select count(*) from private.join_requests where install_id = p_install and status = 'declined' and answered_at > now() - interval '1 day') >= 2 then
    return jsonb_build_object('state', 'blocked');
  end if;
  if (select count(*) from private.join_requests where install_id = p_install and created_at > now() - interval '1 hour') >= 3
     or (select count(*) from private.join_requests where ip = p_ip and created_at > now() - interval '1 hour') >= 3
     or (select count(*) from private.join_requests where phone = p_phone and created_at > now() - interval '1 day') >= 5 then
    return jsonb_build_object('state', 'too_many');
  end if;

  -- The parent with this number: the family's owner (phone sign-in) or an allowed co-parent.
  select private.parent_family_of(u.id) into v_family
    from auth.users u
   where u.email = substr(p_phone, 2) || '@phone.payhas.invalid';
  -- At most 3 open requests per family; more just expire unseen.
  if v_family is not null and (select count(*) from private.join_requests
       where family_id = v_family and status = 'pending' and expires_at > now()) >= 3 then
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

/** Where a request stands: pending · allowed (not yet claimed) · claimed · declined · expired. */
create function public.join_request_status(p_id uuid, p_secret_hash bytea)
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
         else 'pending'
       end,
       'family_id', r.family_id, 'profile_id', r.profile_id)
       from private.join_requests r where r.id = p_id and r.secret_hash = p_secret_hash),
    jsonb_build_object('state', 'expired'));
$$;

/**
 * The phone's new user, made by ask-family after an Allow: records it as an
 * allowed child phone. False if another call got there first (that call's
 * user is the phone's; the caller deletes its own).
 */
create function public.claim_join_request(p_id uuid, p_secret_hash bytea, p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v private.join_requests;
begin
  select * into v from private.join_requests
   where id = p_id and secret_hash = p_secret_hash and status = 'allowed' and device_user is null
   for update;
  if not found then
    return false;
  end if;
  update private.join_requests set device_user = p_user where id = v.id;
  insert into public.family_devices (family_id, user_id, profile_id, kind, name, status, approved_at)
  values (v.family_id, p_user, v.profile_id, 'child', v.device_name, 'active', now());
  return true;
end;
$$;

revoke all on function public.create_join_request(text, text, text, text, bytea), public.join_request_status(uuid, bytea),
  public.claim_join_request(uuid, bytea, uuid) from public, anon, authenticated;
grant execute on function public.create_join_request(text, text, text, text, bytea), public.join_request_status(uuid, bytea),
  public.claim_join_request(uuid, bytea, uuid) to service_role;

-- ── the parent's phone ───────────────────────────────────────────────────────
/** Open requests for my family, oldest first. Parents only; no PIN needed to see them. */
create function public.pending_join_requests()
returns table (id uuid, device_name text, match text, created_at timestamptz, expires_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.id, r.device_name, r.match, r.created_at, r.expires_at
    from private.join_requests r
   where r.family_id = private.parent_family_of((select auth.uid()))
     and r.status = 'pending' and r.expires_at > now()
   order by r.created_at;
$$;

/**
 * Allow (with the PIN, for one child) or decline a request.
 * Returns 'ok' · 'bad_pin' · 'gone' (expired or already answered) · 'bad_profile'.
 */
create function public.answer_join_request(p_request uuid, p_allow boolean, p_profile uuid default null, p_pin text default null)
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
                  where id = p_request and family_id = v_family and status = 'pending' and expires_at > now()) then
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
         -- Time for the phone to pick up its login.
         expires_at = greatest(expires_at, now() + interval '10 minutes')
   where id = p_request;
  return 'ok';
end;
$$;

revoke all on function public.pending_join_requests(), public.answer_join_request(uuid, boolean, uuid, text) from public, anon;
grant execute on function public.pending_join_requests(), public.answer_join_request(uuid, boolean, uuid, text) to authenticated;
