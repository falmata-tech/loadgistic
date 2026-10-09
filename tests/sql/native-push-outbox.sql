begin;
create function pg_temp.push_denial(command text,expected text default 'FORBIDDEN') returns void language plpgsql as $$
begin begin execute command;exception when others then if sqlerrm=expected then return;end if;raise;end;raise exception 'EXPECTED_PUSH_DENIAL';end $$;
create function pg_temp.push_due_work() returns void language sql as $$ update public.native_push_outbox set next_attempt_at=now()-interval '1 second' where state='PENDING' $$;
-- Synthetic due-time advancement: this rollback-only DO block has a fixed now().
do $test$
<<fixture>>
declare customer uuid:=gen_random_uuid();agent uuid:=gen_random_uuid();broker uuid:=gen_random_uuid();other uuid:=gen_random_uuid();uid uuid;
 session uuid:=gen_random_uuid();installation uuid:=gen_random_uuid();visitor_installation uuid:=gen_random_uuid();guest_request uuid:=gen_random_uuid();chat uuid:=gen_random_uuid();
 worker uuid:=gen_random_uuid();worker_two uuid:=gen_random_uuid();delivery uuid;old_delivery uuid;items jsonb;value jsonb;seq bigint;version bigint;initial_count bigint;read_before jsonb;role_name text;row_name text;attempt integer;
begin
 foreach uid in array array[customer,agent,broker,other] loop
  insert into auth.users(id,email,email_confirmed_at) values(uid,uid||'@example.test',now());
  update profiles set role=case when uid in (customer,other) then 'DRIVER'::user_role else 'SUPPORT'::user_role end,active=true where id=uid;
  if uid in(agent,broker) then insert into support_agent_profiles(user_id,active,available,max_open_conversations,can_manage_support,can_manage_brokerage)
   values(uid,true,true,20,uid=agent,uid=broker);end if;
 end loop;
 insert into auth.sessions(id,user_id,created_at,updated_at) values(session,customer,now(),now());
 insert into support_conversations(id,customer_user_id,assigned_agent_user_id,category,status,assigned_at) values(chat,customer,agent,'ACCOUNT','OPEN',now());
 perform send_managed_support_message(agent,chat,'Synthetic old unread reply');
 perform register_native_push_binding(installation,repeat('a',64),'ExpoPushToken[synthetic-member-token]','en',customer,session,null,null);
 if exists(select 1 from native_push_outbox) then raise exception 'REGISTRATION_REPLAYED_HISTORY';end if;
 perform pg_temp.push_denial(format('select register_native_push_binding(%L,%L,%L,''en'',%L,%L,null,null)',gen_random_uuid(),repeat('a',64),'ExpoPushToken[synthetic-staff-token]',agent,session));
 perform pg_temp.push_denial(format('select register_native_push_binding(%L,%L,%L,''en'',%L,%L,null,null)',gen_random_uuid(),repeat('a',64),'ExpoPushToken[synthetic-foreign-session]',other,session));
 perform pg_temp.push_denial(format('select register_native_push_binding(%L,%L,%L,''en'',%L,%L,null,null)',installation,repeat('b',64),'ExpoPushToken[synthetic-stolen-install]',customer,session));
 perform send_managed_support_message(customer,chat,'Synthetic own message');
 if exists(select 1 from native_push_outbox) then raise exception 'OWN_MESSAGE_NOTIFIED';end if;
 perform send_managed_support_message(agent,chat,'Synthetic new reply');
 select max(sequence) into seq from support_messages where conversation_id=chat;
 select id into strict delivery from native_push_outbox where source_id=chat and event='MESSAGE';
 read_before:=chat_read_state('SUPPORT',chat,customer);
 perform pg_temp.push_due_work();items:=claim_native_push_batch(worker,40);if jsonb_array_length(items)<>1 then raise exception 'CLAIM_NOT_BOUNDED';end if;
 if jsonb_array_length(claim_native_push_batch(worker_two,40))<>0 then raise exception 'LIVE_LEASE_RECLAIMED';end if;
 if finish_native_push_delivery(delivery,worker_two,'{"code":"DELIVERED"}') then raise exception 'FOREIGN_LEASE_FINISHED';end if;
 value:=native_push_delivery_context(delivery,worker);if value->>'event'<>'MESSAGE' or value::text like '%Synthetic%' or value::text like '%@example%' then raise exception 'PUSH_CONTEXT_PRIVATE_LEAK';end if;
 if read_before<>chat_read_state('SUPPORT',chat,customer) then raise exception 'CLAIM_CREATED_SEEN';end if;
 perform acknowledge_visible_chat_read('SUPPORT',chat,customer,null,seq,(read_before->>'assignmentVersion')::bigint);
 if native_push_delivery_context(delivery,worker) is not null then raise exception 'ALREADY_READ_PUSH_SENT';end if;
 -- Explicit real team opening creates join once; ordinary fetch does not.
 initial_count:=(select count(*) from native_push_outbox);perform managed_support_conversation(agent,chat,50,true);
 if initial_count<>(select count(*) from native_push_outbox) then raise exception 'FETCH_CREATED_JOIN_PUSH';end if;
 version:=(chat_read_state('SUPPORT',chat,agent)->>'assignmentVersion')::bigint;
 perform acknowledge_visible_chat_read('SUPPORT',chat,agent,null,0,version);
 if not exists(select 1 from native_push_outbox where source_id=chat and event='JOINED') then raise exception 'REAL_JOIN_NOT_NOTIFIED';end if;
 initial_count:=(select count(*) from native_push_outbox);perform acknowledge_visible_chat_read('SUPPORT',chat,agent,null,0,version);
 if initial_count<>(select count(*) from native_push_outbox) then raise exception 'JOIN_REPLAY_DUPLICATED';end if;
 -- Current authority is checked again after the lease is acquired.
 perform send_managed_support_message(agent,chat,'Synthetic before disabling');
 perform pg_temp.push_due_work();items:=claim_native_push_batch(worker,40);update profiles set active=false where id=customer;
 for delivery in select id from native_push_outbox where lease_id=worker loop if native_push_delivery_context(delivery,worker) is not null then raise exception 'DISABLED_ACTOR_PUSH';end if;end loop;
 update profiles set active=true where id=customer;
 -- Outage and crashed-worker retries are bounded, without changing source Seen.
 perform send_managed_support_message(agent,chat,'Synthetic retry exhaustion');
 select id into strict delivery from native_push_outbox where source_id=chat and event='MESSAGE' and state='PENDING' order by sequence desc limit 1;
 for attempt in 1..5 loop
  update native_push_outbox set next_attempt_at=now()-interval '1 second' where id=delivery;
  perform claim_native_push_batch(worker,40);perform native_push_delivery_context(delivery,worker);
  perform finish_native_push_delivery(delivery,worker,'{"code":"RETRY"}');
  if (select attempts from native_push_outbox where id=delivery)<>attempt then raise exception 'SEND_RETRY_COUNT';end if;
 end loop;
 if (select state from native_push_outbox where id=delivery)<>'FAILED' then raise exception 'UNBOUNDED_SEND_RETRY';end if;
 perform send_managed_support_message(agent,chat,'Synthetic abandoned lease');perform pg_temp.push_due_work();perform claim_native_push_batch(worker,40);
 select id into strict delivery from native_push_outbox where source_id=chat and event='MESSAGE' and lease_id=worker order by sequence desc limit 1;
 update native_push_outbox set leased_until=now()-interval '1 second',attempts=5 where id=delivery;
 if finish_native_push_delivery(delivery,worker,'{"code":"ACCEPTED","ticketId":"late-ticket"}') then raise exception 'STALE_LEASE_FINISHED';end if;
 perform claim_native_push_batch(worker_two,40);
 if (select state from native_push_outbox where id=delivery)<>'FAILED' then raise exception 'CRASHED_LEASE_UNBOUNDED';end if;
 perform create_transport_chat_request(guest_request,'{"name":"Synthetic push visitor","phone":"+251900000007","origin":"Adama","destination":"Dire Dawa"}',repeat('c',64));
 perform register_native_push_binding(visitor_installation,repeat('d',64),'ExpoPushToken[synthetic-guest-token]','am',null,null,guest_request,repeat('c',64));
 perform pg_temp.push_denial(format('select register_native_push_binding(%L,%L,%L,''en'',null,null,%L,%L)',gen_random_uuid(),repeat('e',64),'ExpoPushToken[synthetic-wrong-guest]',guest_request,repeat('f',64)));
 perform assign_transport_service_request(broker,guest_request,1,null,true);
 if not exists(select 1 from native_push_outbox where source_id=guest_request and event='ASSIGNED') then raise exception 'GUEST_ASSIGNMENT_NOT_NOTIFIED';end if;
 perform send_transport_chat_message(guest_request,null,broker,gen_random_uuid(),'Synthetic broker reply');
 perform pg_temp.push_due_work();items:=claim_native_push_batch(worker,40);
 select id into strict delivery from native_push_outbox where source_id=guest_request and event='MESSAGE' and lease_id=worker order by created_at desc limit 1;
 value:=native_push_delivery_context(delivery,worker);if value is null or value->>'kind'<>'BROKERAGE' then raise exception 'GUEST_REPLY_NOT_AUTHORIZED';end if;
 perform finish_native_push_delivery(delivery,worker,'{"code":"ACCEPTED","ticketId":"synthetic-ticket"}');
 if (select state from native_push_outbox where id=delivery)<>'SUBMITTED' or (select next_attempt_at from native_push_outbox where id=delivery)<now()+interval '14 minutes' then raise exception 'RECEIPT_NOT_DEFERRED';end if;
 -- Old invalid-token receipt cannot disable a rotated token.
 perform register_native_push_binding(visitor_installation,repeat('d',64),'ExpoPushToken[synthetic-rotated-token]','am',null,null,guest_request,repeat('c',64));
 update native_push_outbox set next_attempt_at=now()-interval '1 second' where id=delivery;
 perform pg_temp.push_due_work();items:=claim_native_push_batch(worker_two,40);perform native_push_delivery_context(delivery,worker_two);
 perform finish_native_push_delivery(delivery,worker_two,'{"code":"DeviceNotRegistered"}');
 if not (select enabled from native_push_installations where id=visitor_installation) then raise exception 'OLD_RECEIPT_DISABLED_NEW_TOKEN';end if;
 -- Current invalid token disables that device, not another installation.
 perform send_transport_chat_message(guest_request,null,broker,gen_random_uuid(),'Synthetic current token reply');perform pg_temp.push_due_work();items:=claim_native_push_batch(worker,40);
 select id into strict delivery from native_push_outbox where source_id=guest_request and event='MESSAGE' and lease_id=worker order by created_at desc limit 1;
 perform native_push_delivery_context(delivery,worker);perform finish_native_push_delivery(delivery,worker,'{"code":"DeviceNotRegistered"}');
 if (select enabled from native_push_installations where id=visitor_installation) or not (select enabled from native_push_installations where id=installation) then raise exception 'TOKEN_REJECTION_SCOPE_WRONG';end if;
 perform register_native_push_binding(visitor_installation,repeat('d',64),'ExpoPushToken[synthetic-new-guest-token]','am',null,null,guest_request,repeat('c',64));
 perform send_transport_chat_message(guest_request,null,broker,gen_random_uuid(),'Synthetic before expiry');perform pg_temp.push_due_work();items:=claim_native_push_batch(worker,40);
 update transport_chat_access set expires_at=now()-interval '1 second' where request_id=guest_request;
 for delivery in select id from native_push_outbox where source_id=guest_request and lease_id=worker loop if native_push_delivery_context(delivery,worker) is not null then raise exception 'EXPIRED_GUEST_PUSH';end if;end loop;
 perform send_managed_support_message(agent,chat,'Synthetic before logout');perform pg_temp.push_due_work();items:=claim_native_push_batch(worker,40);
 delete from auth.sessions where id=session;
 for delivery in select id from native_push_outbox where source_id=chat and lease_id=worker loop if native_push_delivery_context(delivery,worker) is not null then raise exception 'LOGGED_OUT_SESSION_PUSH';end if;end loop;
 perform pg_temp.push_denial(format('select remove_native_push_binding(%L,%L,''ALL'')',installation,repeat('f',64)));
 perform remove_native_push_binding(installation,repeat('a',64),'MEMBER');
 if exists(select 1 from native_push_bindings where installation_id=installation) then raise exception 'UNBIND_KEPT_AUTHORITY';end if;
 foreach role_name in array array['anon','authenticated'] loop
  foreach row_name in array array['native_push_installations','native_push_bindings','native_push_outbox'] loop
   if has_table_privilege(role_name,'public.'||row_name,'select') or not (select relrowsecurity from pg_class where oid=('public.'||row_name)::regclass) then raise exception 'PUSH_BROWSER_TABLE_ACCESS';end if;
  end loop;
  if has_function_privilege(role_name,'register_native_push_binding(uuid,text,text,text,uuid,uuid,uuid,text)','execute')
   or has_function_privilege(role_name,'claim_native_push_batch(uuid,integer)','execute') then raise exception 'PUSH_BROWSER_COMMAND_ACCESS';end if;
 end loop;
 perform pg_temp.push_denial(format('select claim_native_push_batch(%L,41)',worker),'INVALID_PUSH_INPUT');
 perform pg_temp.push_denial(format('select claim_native_push_batch(%L,null)',worker),'INVALID_PUSH_INPUT');
 raise notice 'PASS: push registration/current scope, no replay/own-message/read fabrication, real join, leases, guest expiry, logout, token rotation/rejection and browser ACL/RLS.';
end $test$;
rollback;
