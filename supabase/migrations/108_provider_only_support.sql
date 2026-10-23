-- FEAT-SUP-001 / FEAT-GST-001 / FEAT-TRQ-001: public assistance is request-only.
-- Preserve transcripts, attachments, assignments and existing browser-role denial.
create or replace function public.create_managed_guest_support(command jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin raise exception 'PUBLIC_SUPPORT_CLOSED';end $$;

do $patch$
declare definition text;signature text;before_text text;after_text text;
begin
 for signature,before_text,after_text in select * from (values
 ('public.support_member_actor(uuid)','(''SHIPPER'',''RECEIVER'',''TRANSPORTER'',''DRIVER'')','(''TRANSPORTER'',''DRIVER'')'),
 ('public.create_managed_support_conversation(uuid,jsonb)','actor:=public.support_member_actor(actor_user_id);',
  'perform 1 from public.profiles where id=actor_user_id and active and role::text in (''TRANSPORTER'',''DRIVER'') for share; if not found then raise exception ''FORBIDDEN'';end if; actor:=public.support_member_actor(actor_user_id);'),
 ('public.send_managed_support_message(uuid,uuid,text)','where profile.id=actor_user_id and profile.active;',
  'where profile.id=actor_user_id and profile.active and profile.role::text in (''TRANSPORTER'',''DRIVER'',''SUPPORT'',''ADMIN'') for share;'),
 ('public.support_attachment_reply_scope(uuid,uuid)','where id=actor_user_id and active for update;',
  'where id=actor_user_id and active and role::text in (''TRANSPORTER'',''DRIVER'',''SUPPORT'',''ADMIN'') for update;'),
 ('public.send_managed_guest_support_message(uuid,uuid,text,text,jsonb)',
  'if char_length(body_value) not between 1 and 2000 then',
  'if actor_user_id is null or nullif(trim(requested_email_digest),'''') is not null then raise exception ''PUBLIC_SUPPORT_CLOSED'';end if; if char_length(body_value) not between 1 and 2000 then')
 ) patches(signature,before_text,after_text) loop
  definition:=pg_get_functiondef(signature::regprocedure);
  if strpos(definition,before_text)=0 or strpos(substr(definition,strpos(definition,before_text)+length(before_text)),before_text)>0 then
   raise exception 'PROVIDER_SUPPORT_PATCH_PRECONDITION: %',signature;
  end if;
  execute replace(definition,before_text,after_text);
 end loop;
end $patch$;
-- Existing grants are preserved by CREATE OR REPLACE; explicitly retain the retired command's boundary.
revoke all on function public.create_managed_guest_support(jsonb) from public,anon,authenticated;
grant execute on function public.create_managed_guest_support(jsonb) to service_role;
