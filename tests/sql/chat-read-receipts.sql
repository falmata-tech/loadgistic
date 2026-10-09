begin;
create function pg_temp.expect_read_denial(command text,expected text default 'FORBIDDEN') returns void language plpgsql as $$
begin begin execute command;exception when others then if sqlerrm=expected then return;end if;raise;end;raise exception 'EXPECTED_CHAT_READ_DENIAL';end $$;
do $test$
<<chat_read_receipts>>
declare customer uuid:=gen_random_uuid();outsider uuid:=gen_random_uuid();agent uuid:=gen_random_uuid();replacement uuid:=gen_random_uuid();
 broker uuid:=gen_random_uuid();new_broker uuid:=gen_random_uuid();uid uuid;admin_id uuid;chat uuid:=gen_random_uuid();request_id uuid:=gen_random_uuid();other_request uuid:=gen_random_uuid();
 first_sequence bigint;reply_sequence bigint;latest_sequence bigint;state jsonb;before_state jsonb;revision text;row_count bigint;version_value integer;role_name text;
begin
 select id into strict admin_id from public.profiles where role='ADMIN' and active limit 1;
 foreach uid in array array[customer,outsider,agent,replacement,broker,new_broker] loop
  insert into auth.users(id,email,email_confirmed_at) values(uid,uid||'@example.test',now());
  update public.profiles set active=true,role=case when uid in(customer,outsider) then 'DRIVER'::public.user_role else 'SUPPORT'::public.user_role end where id=uid;
  if uid not in(customer,outsider) then insert into public.support_agent_profiles(user_id,active,available,max_open_conversations,can_manage_support,can_manage_brokerage)
   values(uid,true,true,20,uid in(agent,replacement),uid in(broker,new_broker));end if;
 end loop;
 -- Closed test container permits adding messages without another live customer slot.
 insert into public.support_conversations(id,customer_user_id,assigned_agent_user_id,category,status,assigned_at)
 values(chat,customer,agent,'ACCOUNT','OPEN',clock_timestamp());
 perform public.send_managed_support_message(customer,chat,'Synthetic customer question');
 select sequence into first_sequence from public.support_messages where conversation_id=chat;
 state:=public.chat_read_state('SUPPORT',chat,agent);
 if (state->>'unreadCount')::integer<>1 or (state->>'teamJoined')::boolean then raise exception 'INITIAL_SUPPORT_READ_INVENTED';end if;
 -- Legacy GET mark_read timestamp cannot create the new Seen cursor or join.
 perform public.managed_support_conversation(agent,chat,50,true);
 state:=public.chat_read_state('SUPPORT',chat,agent);
 if (state->>'teamSeen')::bigint<>0 or (state->>'teamJoined')::boolean or (state->>'unreadCount')::integer<>1 then raise exception 'FETCH_MARKED_VISIBLE_READ';end if;
 perform pg_temp.expect_read_denial(format('select public.chat_read_state(''SUPPORT'',%L,%L)',chat,outsider));
 perform pg_temp.expect_read_denial(format('select public.acknowledge_chat_read(''SUPPORT'',%L,%L,null,1)',chat,broker));
 perform pg_temp.expect_read_denial(format('select public.acknowledge_chat_read(''SUPPORT'',%L,%L,null,999999)',chat,agent),'INVALID_CHAT_READ');
 revision:=public.support_conversation_revision(customer,chat,false);
 state:=public.acknowledge_chat_read('SUPPORT',chat,agent,null,first_sequence);
 if (state->>'teamSeen')::bigint<>first_sequence or not (state->>'teamJoined')::boolean or (state->>'unreadCount')::integer<>0 then raise exception 'SUPPORT_ACK_NOT_SAVED';end if;
 if revision is distinct from public.support_conversation_revision(customer,chat,false) then raise exception 'RECEIPT_FORCED_TRANSCRIPT_REFRESH';end if;
 before_state:=state;
 state:=public.acknowledge_chat_read('SUPPORT',chat,agent,null,0);
 if state<>before_state then raise exception 'REORDERED_ACK_NOT_IDEMPOTENT';end if;
 perform public.send_managed_support_message(agent,chat,'Synthetic team reply');
 select max(sequence) into reply_sequence from public.support_messages where conversation_id=chat;
 state:=public.chat_read_state('SUPPORT',chat,customer);
 if (state->>'unreadCount')::integer<>1 then raise exception 'CUSTOMER_UNREAD_MISSING';end if;
 state:=public.chat_alert_snapshot(customer);
 if (state->>'unreadCount')::integer<>1 or state::text like '%Synthetic team reply%' then raise exception 'SUPPORT_ALERT_PRIVATE_PROJECTION';end if;
 -- Sending alone cannot pretend the customer saw the team reply.
 perform public.send_managed_support_message(customer,chat,'Synthetic second question');
 state:=public.chat_read_state('SUPPORT',chat,customer);
 if (state->>'unreadCount')::integer<>1 or (state->>'customerSeen')::bigint<>0 then raise exception 'REPLY_INVENTED_READ';end if;
 state:=public.acknowledge_chat_read('SUPPORT',chat,customer,null,reply_sequence);
 if (state->>'customerSeen')::bigint<>reply_sequence or (state->>'unreadCount')::integer<>0 then raise exception 'CUSTOMER_ACK_NOT_SAVED';end if;
 update public.support_conversations set assigned_agent_user_id=replacement where id=chat;
 if (public.chat_read_state('SUPPORT',chat,customer)->>'teamJoined')::boolean then raise exception 'HANDOFF_KEPT_OLD_JOIN';end if;
 state:=public.chat_read_state('SUPPORT',chat,replacement);
 if (state->>'ownSeen')::bigint<>0 or (state->>'unreadCount')::integer<>2 or (state->>'teamSeen')::bigint<>first_sequence then raise exception 'SUPPORT_HANDOFF_UNREAD_INHERITED';end if;
 perform pg_temp.expect_read_denial(format('select public.acknowledge_chat_read(''SUPPORT'',%L,%L,null,1)',chat,agent));
 select max(sequence) into latest_sequence from public.support_messages where conversation_id=chat;
 state:=public.acknowledge_chat_read('SUPPORT',chat,replacement,null,latest_sequence);
 if not (state->>'teamJoined')::boolean then raise exception 'REPLACEMENT_JOIN_MISSING';end if;
 update public.support_conversations set assigned_agent_user_id=agent where id=chat;
 if (public.chat_read_state('SUPPORT',chat,customer)->>'teamJoined')::boolean then raise exception 'RETURNING_AGENT_JOIN_REUSED';end if;
 perform pg_temp.expect_read_denial(format('select public.acknowledge_visible_chat_read(''SUPPORT'',%L,%L,null,%L,0)',chat,agent,latest_sequence),'CHAT_ASSIGNMENT_CHANGED');
 state:=public.acknowledge_visible_chat_read('SUPPORT',chat,agent,null,latest_sequence,(public.chat_read_state('SUPPORT',chat,agent)->>'assignmentVersion')::bigint);
 if not (state->>'teamJoined')::boolean then raise exception 'CURRENT_FRAME_JOIN_MISSING';end if;
 update public.profiles set active=false where id=customer;
 perform pg_temp.expect_read_denial(format('select public.chat_read_state(''SUPPORT'',%L,%L)',chat,customer));
 update public.profiles set active=true where id=customer;
 if (public.managed_support_conversation(customer,chat,50,false)->'messages'->0->>'sequence')::bigint<>first_sequence then raise exception 'SUPPORT_SEQUENCE_PROJECTION_MISSING';end if;

 perform public.create_transport_chat_request(request_id,'{"name":"Receipt audit","phone":"+251900000007","origin":"Adama","destination":"Dire Dawa"}',repeat('a',64));
 perform public.create_transport_chat_request(other_request,'{"name":"Other receipt audit","phone":"+251900000008","origin":"Adama","destination":"Dire Dawa"}',repeat('b',64));
 perform public.send_transport_chat_message(request_id,repeat('a',64),null,gen_random_uuid(),'Synthetic visitor question');
 select max(m.sequence) into first_sequence from public.transport_chat_messages m where m.request_id=chat_read_receipts.request_id;
 state:=public.chat_alert_snapshot(broker);
 if not exists(select 1 from jsonb_array_elements(state->'items') i where i->>'id'=request_id::text and (i->>'queued')::boolean) then raise exception 'BROKER_WAITING_ALERT_MISSING';end if;
 state:=public.chat_alert_snapshot(agent);
 if exists(select 1 from jsonb_array_elements(state->'items') i where i->>'kind'='BROKERAGE') then raise exception 'CROSS_TEAM_ALERT';end if;
 perform public.assign_transport_service_request(broker,request_id,1,null,true);
 state:=public.chat_read_state('BROKERAGE',request_id,null,repeat('a',64));
 if (state->>'teamJoined')::boolean or (state->>'teamSeen')::bigint<>0 then raise exception 'ASSIGNMENT_INVENTED_JOIN';end if;
 perform pg_temp.expect_read_denial(format('select public.chat_read_state(''BROKERAGE'',%L,null,%L)',other_request,repeat('a',64)));
 perform pg_temp.expect_read_denial(format('select public.acknowledge_chat_read(''BROKERAGE'',%L,%L,null,0)',request_id,agent));
 perform public.transport_chat_snapshot(request_id,null,broker);
 if (public.chat_read_state('BROKERAGE',request_id,null,repeat('a',64))->>'teamSeen')::bigint<>0 then raise exception 'BROKERAGE_FETCH_READ';end if;
 state:=public.acknowledge_chat_read('BROKERAGE',request_id,broker,null,first_sequence);
 if not (state->>'teamJoined')::boolean or (state->>'unreadCount')::integer<>0 then raise exception 'BROKERAGE_JOIN_ACK_MISSING';end if;
 perform public.send_transport_chat_message(request_id,null,broker,gen_random_uuid(),'Synthetic brokerage reply');
 select max(m.sequence) into reply_sequence from public.transport_chat_messages m where m.request_id=chat_read_receipts.request_id;
 state:=public.chat_read_state('BROKERAGE',request_id,null,repeat('a',64));
 if (state->>'unreadCount')::integer<>1 then raise exception 'VISITOR_UNREAD_MISSING';end if;
 state:=public.chat_alert_snapshot(null,request_id,repeat('a',64));
 if (state->>'unreadCount')::integer<>1 or jsonb_array_length(state->'items')<>1 or state::text ~ 'Receipt audit|Synthetic|credential_digest|900000007|origin|destination|phone' then raise exception 'VISITOR_ALERT_PRIVATE_PROJECTION';end if;
 state:=public.acknowledge_chat_read('BROKERAGE',request_id,null,repeat('a',64),reply_sequence);
 if (state->>'unreadCount')::integer<>0 or (state->>'customerSeen')::bigint<>reply_sequence then raise exception 'VISITOR_ACK_MISSING';end if;
 select version into version_value from public.transport_service_requests where id=request_id;
 perform public.assign_transport_service_request(admin_id,request_id,version_value,new_broker,false);
 if (public.chat_read_state('BROKERAGE',request_id,null,repeat('a',64))->>'teamJoined')::boolean then raise exception 'BROKER_HANDOFF_JOIN_REUSED';end if;
 state:=public.chat_read_state('BROKERAGE',request_id,new_broker);
 if (state->>'ownSeen')::bigint<>0 or (state->>'unreadCount')::integer<>1 or (state->>'teamSeen')::bigint<>first_sequence then raise exception 'BROKER_HANDOFF_UNREAD_INHERITED';end if;
 perform pg_temp.expect_read_denial(format('select public.acknowledge_chat_read(''BROKERAGE'',%L,%L,null,0)',request_id,broker));
 state:=public.acknowledge_chat_read('BROKERAGE',request_id,new_broker,null,reply_sequence);
 if not (state->>'teamJoined')::boolean then raise exception 'NEW_BROKER_JOIN_MISSING';end if;
 select count(*) into row_count from public.transport_chat_messages m where m.request_id=chat_read_receipts.request_id;
 if row_count<>2 then raise exception 'RECEIPT_CHANGED_HISTORY';end if;
 update public.transport_chat_access set expires_at=now()-interval '1 second' where transport_chat_access.request_id=chat_read_receipts.request_id;
 perform pg_temp.expect_read_denial(format('select public.chat_read_state(''BROKERAGE'',%L,null,%L)',request_id,repeat('a',64)));
 update public.support_agent_profiles set can_manage_brokerage=false where user_id=new_broker;
 perform pg_temp.expect_read_denial(format('select public.chat_read_state(''BROKERAGE'',%L,%L)',request_id,new_broker));
 foreach role_name in array array['anon','authenticated'] loop
  if has_table_privilege(role_name,'public.support_chat_read_cursors','SELECT,INSERT,UPDATE,DELETE') or
   has_table_privilege(role_name,'public.transport_chat_read_cursors','SELECT,INSERT,UPDATE,DELETE') or
   has_function_privilege(role_name,'public.chat_read_state(text,uuid,uuid,text)','EXECUTE') or
   has_function_privilege(role_name,'public.acknowledge_chat_read(text,uuid,uuid,text,bigint)','EXECUTE') or
   has_function_privilege(role_name,'public.acknowledge_visible_chat_read(text,uuid,uuid,text,bigint,bigint)','EXECUTE') or
   has_function_privilege(role_name,'public.chat_alert_snapshot(uuid,uuid,text)','EXECUTE') or
   has_function_privilege(role_name,'public.sequence_support_message()','EXECUTE') then raise exception 'DIRECT_CHAT_READ_ACCESS';end if;
 end loop;
 raise notice 'PASS: explicit visible reads, no fetch/reply inference, monotonic sequence, join/handoff, scope/expiry/role denial and retained history';
end $test$;
do $backlog$
declare customer uuid:=gen_random_uuid();agent uuid:=gen_random_uuid();chat uuid:=gen_random_uuid();waiting uuid;requester uuid;state jsonb;index integer;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values(customer,'backlog-reader@example.test',now(),'{}','{}'),(agent,'backlog-agent@example.test',now(),'{}','{}');
 update public.profiles set active=true,role='DRIVER' where id=customer;
 update public.profiles set active=true,role='SUPPORT' where id=agent;
 insert into public.support_agent_profiles(user_id,active,available,max_open_conversations,can_manage_support,can_manage_brokerage) values(agent,true,false,20,true,false);
 insert into public.support_conversations(id,customer_user_id,assigned_agent_user_id,category,status,updated_at) values(chat,customer,agent,'ACCOUNT','OPEN',now()-interval '5 days');
 insert into public.support_messages(conversation_id,sender_user_id,body) values(chat,customer,'Unread behind waiting backlog');
 for index in 1..45 loop
  waiting:=gen_random_uuid();requester:=gen_random_uuid();
  insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data) values(requester,'backlog-'||requester||'@example.test',now(),'{}','{}');
  update public.profiles set active=true,role='DRIVER' where id=requester;
  insert into public.support_conversations(id,customer_user_id,category,status,updated_at) values(waiting,requester,'ACCOUNT','WAITING',now());
 end loop;
 state:=public.chat_alert_snapshot(agent);
 if jsonb_array_length(state->'items')<>40 or not exists(select 1 from jsonb_array_elements(state->'items') i where i->>'id'=chat::text and (i->>'unreadCount')::integer=1) then raise exception 'WAITING_BACKLOG_HID_ASSIGNED_REPLY';end if;
 if (state->>'waitingCount')::integer<>45 or (state->>'unreadCount')::integer<>1 then raise exception 'BACKLOG_COUNTS_TRUNCATED';end if;
 if (state->'items'->0->>'updatedAt')::timestamptz<now()-interval '1 day' then raise exception 'NEW_MESSAGE_EVENT_TIME_MISSING';end if;
 perform public.acknowledge_visible_chat_read('SUPPORT',chat,agent,null,1,0);
 state:=public.chat_alert_snapshot(agent);
 if not exists(select 1 from jsonb_array_elements(state->'items') i where i->>'id'=chat::text) then raise exception 'WAITING_BACKLOG_HID_OWN_ASSIGNMENT';end if;
 raise notice 'PASS: large waiting backlog cannot hide own assigned/unread work; full totals and actual message event time retained';
end $backlog$;
rollback;
