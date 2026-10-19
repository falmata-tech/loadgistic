-- Isolated rehearsal only. Root composes BEGIN + this setup + the EXACT 152
-- migration body (outer transaction controls removed), twice + assertions +
-- ROLLBACK. This file deliberately cannot commit or grant a maintenance RPC.
create temporary table retirement_fixture(ids jsonb) on commit drop;
create temporary table retirement_snapshots(name text primary key,records jsonb) on commit drop;
create function pg_temp.retirement_rows(table_name text) returns jsonb language plpgsql as $$
declare records jsonb;
begin execute format('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),''[]''::jsonb) from public.%I t',table_name) into records;return records;end$$;
do $setup$
declare agent uuid:=gen_random_uuid();other_agent uuid:=gen_random_uuid();member uuid:=gen_random_uuid();other_member uuid:=gen_random_uuid();
 opened uuid:=gen_random_uuid();waiting uuid:=gen_random_uuid();closed uuid:=gen_random_uuid();provider_waiting uuid:=gen_random_uuid();provider_open uuid:=gen_random_uuid();
 request_id uuid:=gen_random_uuid();message_id uuid:=gen_random_uuid();actor_id uuid;table_name text;first_time timestamptz;state jsonb;
begin
 foreach actor_id in array array[agent,other_agent,member,other_member] loop
  insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
  values(actor_id,'retire-guest-'||actor_id||'@example.test',now(),'{}');
  insert into public.profiles(id,email,full_name,role,active)
  values(actor_id,'retire-guest-'||actor_id||'@example.test','Synthetic retirement fixture',
   case when actor_id in(agent,other_agent) then 'SUPPORT'::public.user_role else 'DRIVER'::public.user_role end,true)
  on conflict(id) do update set role=excluded.role,active=true;
 end loop;
 insert into public.support_agent_profiles(user_id,active,available,max_open_conversations,can_manage_support,can_manage_brokerage)
 values(agent,true,true,1,true,false),(other_agent,true,false,3,true,true);
 insert into public.guest_support_conversations(id,email,email_digest,phone,status,assigned_agent_user_id,closed_at,closed_by_user_id)
 values(opened,'retired-open@example.test',md5(opened::text)||md5(agent::text),'+251900000152','OPEN',agent,null,null),
 (waiting,'retired-waiting@example.test',md5(waiting::text)||md5(agent::text),'+251900000153','WAITING',null,null,null),
 (closed,'already-closed@example.test',md5(closed::text)||md5(agent::text),'+251900000154','CLOSED',other_agent,now()-interval '1 day',other_agent);
 insert into public.guest_support_messages(id,conversation_id,sender_kind,body) values(message_id,opened,'GUEST','Synthetic retained private transcript');
 insert into public.guest_support_attachments(conversation_id,message_id,file_path,original_name,mime_type,size_bytes)
 values(opened,message_id,'supabase://support-attachment/synthetic-retirement/no-upload.pdf','fictional.pdf','application/pdf',1);
 select coalesce(min(created_at),now())-interval '1 day' into first_time from public.support_conversations where status='WAITING';
 insert into public.support_conversations(id,customer_user_id,category,status,created_at)
 values(provider_waiting,member,'ACCOUNT','WAITING',first_time);
 insert into public.support_conversations(id,customer_user_id,category,status,assigned_agent_user_id)
 values(provider_open,other_member,'ACCOUNT','OPEN',other_agent);
 insert into public.transport_service_requests(id,requester_name,phone,origin,destination,status,follow_up_note)
 values(request_id,'Synthetic transport request','+251900000155','Adama','Dire Dawa','NEW','Retain this separate Brokerage request');
 begin perform public.claim_managed_support_conversation(agent,provider_waiting);raise exception 'RETIRED_GUEST_DID_NOT_CONSUME_REAL_CAPACITY';
 exception when others then if sqlerrm<>'SUPPORT_AGENT_AT_CAPACITY' then raise;end if;end;
 state:=public.managed_support_inbox(agent,'WAITING',0,50);
 if (state->'agent'->>'open_count')::integer<>1 or exists(select 1 from jsonb_array_elements(state->'items') item where item->>'id'=provider_waiting::text and item->>'can_claim'='true')
 then raise exception 'PRE_RETIREMENT_CAPACITY_OR_CLAIM_MISMATCH';end if;
 insert into retirement_fixture values(jsonb_build_object('agent',agent,'otherAgent',other_agent,'providerWaiting',provider_waiting,'providerOpen',provider_open,'openedGuest',opened,'waitingGuest',waiting,'closedGuest',closed));
 foreach table_name in array array['support_conversations','support_messages','support_events','support_agent_profiles','transport_service_requests','transport_chat_access','transport_chat_messages','transport_request_events','guest_support_messages','guest_support_attachments'] loop
  insert into retirement_snapshots values(table_name,pg_temp.retirement_rows(table_name));
 end loop;
 insert into retirement_snapshots values('guest_before',pg_temp.retirement_rows('guest_support_conversations')),
  ('guest_events_before',pg_temp.retirement_rows('guest_support_events')),('audit_before',pg_temp.retirement_rows('audit_logs'));
end $setup$;
