-- FEAT-ENT-001. Isolated customer Support alerts; no production records.
begin;
create function pg_temp.expect_business_alert_denied(actor uuid) returns void language plpgsql as $$
begin
 begin perform public.chat_alert_snapshot(actor);exception when others then if sqlerrm='FORBIDDEN' then return;end if;raise;end;
 raise exception 'BUSINESS_ALERT_EXPECTED_DENIAL';
end $$;
do $test$
declare owner_id uuid:=gen_random_uuid();staff_id uuid:=gen_random_uuid();other_id uuid:=gen_random_uuid();bare_id uuid:=gen_random_uuid();agent_id uuid:=gen_random_uuid();provider_id uuid:=gen_random_uuid();uid uuid;
 workspace uuid;invitation uuid;own_chat uuid:=gen_random_uuid();other_chat uuid:=gen_random_uuid();result jsonb;version_value bigint;
begin
 foreach uid in array array[owner_id,staff_id,other_id,bare_id,agent_id,provider_id] loop
  insert into auth.users(id,email,email_confirmed_at) values(uid,'synthetic-alert-'||uid||'@example.test',now());
 end loop;
 update public.profiles set active=true,role='SHIPPER' where id in(owner_id,bare_id);
 update public.profiles set active=true,role='SUPPORT' where id=agent_id;
 insert into public.support_agent_profiles(user_id,active,available,max_open_conversations,can_manage_support,can_manage_brokerage) values(agent_id,true,true,20,true,false);
 update public.profiles set active=true,role='DRIVER' where id=provider_id;
 workspace:=(public.business_workspace_create(owner_id,jsonb_build_object('name','Synthetic alerts business','handle','alerts-'||substr(owner_id::text,1,12),'kind','BROKER'))->>'id')::uuid;
 foreach uid in array array[staff_id,other_id] loop
  select version into version_value from public.business_workspaces where id=workspace;
  invitation:=(public.business_workspace_command(owner_id,workspace,jsonb_build_object('action','INVITE','expectedVersion',version_value,'email','synthetic-alert-'||uid||'@example.test','role','STAFF','capacity',false,'tracking',false))->>'invitationId')::uuid;
  perform public.business_workspace_accept_invitation(uid,invitation);
 end loop;
 insert into public.support_conversations(id,customer_user_id,assigned_agent_user_id,category,status,assigned_at)
 values(own_chat,staff_id,agent_id,'ACCOUNT','OPEN',clock_timestamp()),(other_chat,other_id,agent_id,'ACCOUNT','OPEN',clock_timestamp());
 insert into public.support_messages(conversation_id,sender_user_id,body) values(own_chat,agent_id,'Synthetic private reply'),(other_chat,agent_id,'Other private reply');
 result:=public.chat_alert_snapshot(staff_id);
 if (result->>'unreadCount')::integer<>1 or jsonb_array_length(result->'items')<>1 or result->'items'->0->>'id'<>own_chat::text or result->'items'->0->>'side'<>'CUSTOMER' or result::text like '%private reply%' then raise exception 'BUSINESS_SUPPORT_ALERT_PRIVACY_FAILED'; end if;
 if (public.chat_alert_snapshot(owner_id)->>'waitingCount')::integer<>0 then raise exception 'BUSINESS_OWNER_GAINED_PLATFORM_QUEUE'; end if;
 perform public.chat_alert_snapshot(provider_id);
 perform public.chat_alert_snapshot(agent_id);
 perform pg_temp.expect_business_alert_denied(bare_id);
 update public.business_workspace_members set active=false where workspace_id=workspace and user_id=staff_id;
 perform pg_temp.expect_business_alert_denied(staff_id);
 update public.business_workspace_members set active=true where workspace_id=workspace and user_id=staff_id;
 update public.profiles set active=false where id=staff_id;
 perform pg_temp.expect_business_alert_denied(staff_id);
 update public.profiles set active=true where id=staff_id;
 update auth.users set deleted_at=now() where id=staff_id;
 perform pg_temp.expect_business_alert_denied(staff_id);
 update auth.users set deleted_at=null where id=staff_id;
 update public.business_workspaces set active=false where id=workspace;
 perform pg_temp.expect_business_alert_denied(staff_id);
 if public.can_manage_brokerage(agent_id) or has_function_privilege('authenticated','public.chat_alert_snapshot(uuid,uuid,text)','execute') or has_function_privilege('anon','public.chat_alert_snapshot(uuid,uuid,text)','execute') then raise exception 'RETIRED_OR_BROWSER_ALERT_AUTHORITY_CHANGED'; end if;
 raise notice 'PASS: current business member own Support alerts, no colleague content/queue, role-only/revoked/suspended/erased/archived denial, provider/staff preserved, no browser RPC';
end $test$;
rollback;
