-- Payhas: parent alerts carry no child's name or video caption, and the
-- parent's phone name isn't kept (privacy review items 5 and 9).
--
-- Alert text travels through Google (FCM) and Apple (APNs) and shows on the
-- lock screen, so it now says only what happened, in the family's language;
-- the dashboard shows who after the PIN. The callers (push_on_limit,
-- push_on_flag, request_more_time) still pass their old text; queue_push
-- ignores it.

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
      ('en', 'limit',     'Screen time is up',      'One of your children reached today’s limit. Open Payhas to see who.'),
      ('en', 'flag',      'A video was flagged',    'One of your children flagged a video. It’s hidden and with our moderators.'),
      ('en', 'more_time', 'More time requested',    'One of your children is asking for more time. Open Payhas to answer.'),
      ('tk', 'limit',     'Ekran wagty gutardy',    'Çagalaryňyzyň biri şu günki çägine ýetdi. Kimdigini görmek üçin Payhas-y açyň.'),
      ('tk', 'flag',      'Wideo bellendi',         'Çagalaryňyzyň biri bir wideony belledi. Ol gizlendi we moderatorlarymyza iberildi.'),
      ('tk', 'more_time', 'Goşmaça wagt soralýar',  'Çagalaryňyzyň biri goşmaça wagt soraýar. Jogap bermek üçin Payhas-y açyň.'),
      ('tr', 'limit',     'Ekran süresi doldu',     'Çocuklarınızdan biri bugünkü sınırına ulaştı. Kim olduğunu görmek için Payhas’ı açın.'),
      ('tr', 'flag',      'Bir video işaretlendi',  'Çocuklarınızdan biri bir videoyu işaretledi. Video gizlendi ve moderatörlerimize iletildi.'),
      ('tr', 'more_time', 'Ek süre isteniyor',      'Çocuklarınızdan biri ek süre istiyor. Yanıtlamak için Payhas’ı açın.'),
      ('ru', 'limit',     'Время экрана вышло',     'Один из ваших детей исчерпал лимит на сегодня. Откройте Payhas, чтобы узнать, кто.'),
      ('ru', 'flag',      'Отмечено видео',         'Один из ваших детей отметил видео. Оно скрыто и передано нашим модераторам.'),
      ('ru', 'more_time', 'Просят ещё времени',     'Один из ваших детей просит ещё времени. Откройте Payhas, чтобы ответить.')
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

-- Alerts already sent kept the child's name; keep only what happened.
update public.push_events set title = 'Payhas', body = '' where sent_at is not null;

-- The phone's name (often its owner's name) was never shown anywhere. Older
-- builds still send it, so the server stores the default whatever arrives.
create or replace function public.register_push_device(p_parent uuid, p_token text, p_name text, p_tz text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_family uuid := private.parent_family(p_parent);
begin
  insert into public.push_devices (token, family_id)
  values (p_token, v_family)
  on conflict (token) do update set family_id = excluded.family_id;
  if p_tz is not null and exists (select 1 from pg_catalog.pg_timezone_names where name = p_tz) then
    update public.families set time_zone = p_tz where id = v_family;
  end if;
end;
$$;

update public.push_devices set device_name = 'Parent phone';
