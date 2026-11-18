-- Account holders own their conversations. Staff keep their historical records.
-- Preserve existing assignments, conversation history, queue limits and RPC ACLs.
do $account_support$
declare change record; definition text;
begin
 for change in select * from (values
  ('create_managed_support_conversation(uuid,jsonb)','adfddd91b030a2e30314191cd143d932',
   ' and role::text in (''TRANSPORTER'',''DRIVER'')',''),
  ('support_member_actor(uuid)','af36bcc6ddbd9e7cfdfe22c10bc9e196',
   'p.role::text in(''TRANSPORTER'',''DRIVER'')',
   'p.role::text in(''TRANSPORTER'',''DRIVER'') or (p.role::text in(''SHIPPER'',''RECEIVER'') and public.business_customer_identity(p.id,false))'),
  ('support_actor_can_read(uuid,uuid)','545f04fea35bd06aa8b82552c1697226',
   'actor.role::text in(''TRANSPORTER'',''DRIVER'')',
   'actor.role::text in(''TRANSPORTER'',''DRIVER'') or (actor.role::text in(''SHIPPER'',''RECEIVER'') and public.business_customer_identity(actor.id,false))'),
  -- Both commands lock the active profile, then check support_actor_can_read
  -- for ownership or current staff access before acting on the conversation.
  ('send_managed_support_message(uuid,uuid,text)','2a9cd634ee556e36dc21363148e35385',
   ' and profile.role::text in (''TRANSPORTER'',''DRIVER'',''SUPPORT'',''ADMIN'')',''),
  ('support_attachment_reply_scope(uuid,uuid)','b8db1fcd46fcb0038b9f3df7e1c256fd',
   ' and role::text in (''TRANSPORTER'',''DRIVER'',''SUPPORT'',''ADMIN'')',''),
  ('managed_guest_support_conversation(uuid,uuid,text,integer,boolean)','b0ddbc8424cc51830a8959423a95d0d7',
   E'\nbegin\n',E'\nbegin\n  if actor_user_id is null or requested_email_digest is not null then raise exception ''NOT_FOUND''; end if;\n'),
  ('managed_guest_support_attachment_file(uuid,uuid,uuid,text)','654b00ef406429c3c539231a13a27206',
   E'\nbegin\n',E'\nbegin\n  if actor_user_id is null or requested_email_digest is not null then raise exception ''NOT_FOUND''; end if;\n'),
  ('close_managed_guest_support(uuid,uuid,text)','ecc94744efe023a61da9c243c64cad75',
   E'\nbegin\n',E'\nbegin\n  if actor_user_id is null or requested_email_digest is not null then raise exception ''NOT_FOUND''; end if;\n'),
  ('support_conversation_revision(uuid,uuid,boolean,text,boolean)','8ad465fbc3c6d70aca15349ff842502f',
   E'\nbegin\n',E'\nbegin\n  if actor_user_id is null or requested_digest is not null then raise exception ''NOT_FOUND''; end if;\n')
 ) as changes(signature,expected_md5,old_source,new_source)
 loop
  select pg_get_functiondef(oid) into strict definition from pg_proc
   where oid=('public.'||change.signature)::regprocedure and md5(prosrc)=change.expected_md5;
  if array_length(string_to_array(definition,change.old_source),1)<>2 then raise exception 'SUPPORT_SOURCE_CHANGED'; end if;
  execute replace(definition,change.old_source,change.new_source);
 end loop;
end $account_support$;
revoke execute on function public.managed_guest_support_access_candidates(text) from public,anon,authenticated,service_role;
