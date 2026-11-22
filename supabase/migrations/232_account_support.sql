begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
-- Account holders own their conversations. Staff keep their historical records.
-- Preserve existing assignments, conversation history, queue limits and RPC ACLs.
do $account_support$
declare change record; definition text;
begin
 for change in select * from (values
  ('chat_alert_snapshot(uuid,uuid,text)','a7153528024b0d91670cf5580e00b73d',
   'member_actor:=actor.role in (''DRIVER'',''TRANSPORTER'')',
   'member_actor:=actor.role in (''DRIVER'',''TRANSPORTER'') or (actor.role in (''SHIPPER'',''RECEIVER'') and public.business_customer_identity(actor.id,false))'),
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

-- New personal chats stay available to their owner. A workspace chat continues
-- to require that workspace. Existing records keep their previous access rules.
alter table public.support_conversations
 add column personal_request boolean not null default false,
 add column member_workspace_id uuid references public.business_workspaces(id),
 add constraint support_personal_request_scope check(not personal_request or member_workspace_id is null);
create unique index support_open_customer_scope_idx on public.support_conversations
 (customer_user_id,personal_request,coalesce(member_workspace_id,'00000000-0000-0000-0000-000000000000'::uuid))
 where status in ('WAITING','OPEN');
drop index public.support_one_open_per_customer_idx;

create or replace function public.support_actor_can_read(actor_user_id uuid,conversation_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public,auth,pg_temp as $$
 select exists(select from public.support_conversations c join public.profiles a on a.id=actor_user_id and a.active
  where c.id=conversation_id and (a.role='ADMIN' or
   (a.role='SUPPORT' and c.assigned_agent_user_id=a.id and public.managed_actor_has_permission(a.id,'SUPPORT')) or
   (c.customer_user_id=a.id and case
    when c.member_workspace_id is not null then public.business_workspace_permission(a.id,c.member_workspace_id,'ACCESS')
    when c.personal_request then public.business_customer_identity(a.id,false)
    else a.role in ('DRIVER','TRANSPORTER') or exists(select from public.business_workspace_members m
      where m.user_id=a.id and public.business_workspace_permission(a.id,m.workspace_id,'ACCESS'))
   end)));
$$;

do $scope$
declare item record; definition text; current_signature text;
begin
 for item in select * from(values
  (1,'create_managed_support_conversation(uuid,jsonb)','where id=actor_user_id and active for share','where id=actor_user_id and active for update'),
  (2,'create_managed_support_conversation(uuid,jsonb)','actor:=public.support_member_actor(actor_user_id);',
   'actor:=public.support_member_actor(actor_user_id); select s.workspace_id into selected_workspace from public.business_workspace_selections s where s.actor_user_id=actor.id and public.business_workspace_permission(actor.id,s.workspace_id,''ACCESS'');'),
  (3,'create_managed_support_conversation(uuid,jsonb)','declare actor public.profiles','declare selected_workspace uuid; actor public.profiles'),
  (4,'create_managed_support_conversation(uuid,jsonb)','conversation.customer_user_id=actor.id and conversation.status','conversation.customer_user_id=actor.id and public.support_actor_can_read(actor.id,conversation.id) and conversation.status'),
  (5,'create_managed_support_conversation(uuid,jsonb)','id,customer_user_id,category,status','id,customer_user_id,member_workspace_id,personal_request,category,status'),
  (6,'create_managed_support_conversation(uuid,jsonb)','values(conversation_id,actor.id,category_value','values(conversation_id,actor.id,selected_workspace,selected_workspace is null and actor.role in (''SHIPPER'',''RECEIVER''),category_value'),
  (7,'managed_member_support_page(uuid,integer,integer)','conversation.customer_user_id=actor.id and conversation.status','conversation.customer_user_id=actor.id and public.support_actor_can_read(actor.id,conversation.id) and conversation.status'),
  (8,'managed_open_member_support(uuid)','conversation.customer_user_id=actor.id and conversation.status','conversation.customer_user_id=actor.id and public.support_actor_can_read(actor.id,conversation.id) and conversation.status'),
  (9,'chat_alert_snapshot(uuid,uuid,text)','member_actor and c.customer_user_id=actor_user_id or support_allowed','member_actor and c.customer_user_id=actor_user_id and public.support_actor_can_read(actor_user_id,c.id) or support_allowed')
 ) as replacements(step,signature,old_text,new_text) order by step
 loop
  if current_signature is distinct from item.signature then
   if current_signature is not null then execute definition;end if;
   current_signature:=item.signature;
   definition:=pg_get_functiondef(('public.'||item.signature)::regprocedure);
  end if;
  if array_length(string_to_array(definition,item.old_text),1)<>2 then raise exception 'SUPPORT_SCOPE_SOURCE_CHANGED: %',item.signature;end if;
  definition:=replace(definition,item.old_text,item.new_text);
 end loop;
 execute definition;
end $scope$;

-- Show the workspace attached to this request in the staff queue and thread.
do $summary$
declare definition text; anchor constant text:='''customer_workspace_name'',coalesce(';
begin
 select pg_get_functiondef(oid) into strict definition from pg_proc
 where oid='public.support_conversation_summary(uuid)'::regprocedure and md5(prosrc)='bd1a926603ccaa03f565e7bd69239f07';
 if array_length(string_to_array(definition,anchor),1)<>2 then raise exception 'SUPPORT_SUMMARY_SOURCE_CHANGED';end if;
 execute replace(definition,anchor,anchor||'(select w.name from public.business_workspaces w where w.id=conversation.member_workspace_id),');
end $summary$;

commit;
