-- Local only; preserve every existing profile/request/chat by rollback.
begin;
create function pg_temp.expect_brokerage_denied(command text,expected text default 'FORBIDDEN') returns void language plpgsql as $$
begin
 begin execute command;exception when others then if sqlerrm=expected then return;end if;raise;end;
 raise exception 'EXPECTED_DENIAL: %',expected;
end $$;
do $test$
declare admin_id uuid;member_id uuid;broker_id uuid:=gen_random_uuid();other_id uuid:=gen_random_uuid();support_id uuid:=gen_random_uuid();
 req uuid:=gen_random_uuid();chat uuid:=gen_random_uuid();capacity_chat uuid:=gen_random_uuid();fifo_first uuid:=gen_random_uuid();fifo_next uuid:=gen_random_uuid();result jsonb;v integer;uid uuid;command jsonb;
begin
 select id into strict admin_id from profiles where active and role='ADMIN' limit 1;
 select id into strict member_id from profiles where active and role='TRANSPORTER' limit 1;
 foreach uid in array array[broker_id,other_id,support_id] loop
   insert into auth.users(id,email) values(uid,uid::text||'@example.test');
   insert into profiles(id,email,full_name,role,active) values(uid,uid::text||'@example.test','Synthetic workflow staff','SUPPORT',true)
   on conflict(id) do update set role='SUPPORT',active=true,full_name=excluded.full_name;
   insert into support_agent_profiles(user_id,active,available,max_open_conversations,can_manage_support,can_manage_brokerage)
   values(uid,true,true,20,uid=support_id,uid<>support_id);
 end loop;
 command:='{"name":"Private caller","phone":"+251900000008","origin":"Adama","destination":"Dire Dawa"}';
 perform create_transport_service_request(req,command);
 foreach uid in array array[member_id,support_id,null::uuid] loop
   perform pg_temp.expect_brokerage_denied(format('select brokerage_request_inbox(%L,''UNASSIGNED'',''ALL'',1)',uid));
   perform pg_temp.expect_brokerage_denied(format('select assign_transport_service_request(%L,%L,1,null,true)',uid,req));
 end loop;
 result:=brokerage_request_inbox(broker_id,'UNASSIGNED','ALL',1);
 if result::text like '%Private caller%' or result::text like '%251900000008%' then raise exception 'UNASSIGNED_CONTACT_LEAK';end if;
 perform pg_temp.expect_brokerage_denied(format('select brokerage_request_inbox(%L,''ALL'',''ALL'',1)',broker_id),'INVALID_TRANSPORT_VIEW');
 perform pg_temp.expect_brokerage_denied(format('select assign_transport_service_request(%L,%L,1,%L,false)',broker_id,req,other_id));
 perform assign_transport_service_request(broker_id,req,1,null,true);
 perform pg_temp.expect_brokerage_denied(format('select assign_transport_service_request(%L,%L,1,null,true)',other_id,req),'TRANSPORT_REQUEST_CHANGED');
 result:=brokerage_request_inbox(other_id,'MINE','ALL',1);
 if result::text like '%Private caller%' then raise exception 'CROSS_OWNER_READ';end if;
 perform pg_temp.expect_brokerage_denied(format('select update_transport_service_request(%L,%L,2,''CLOSED'',''x'')',other_id,req));
 perform update_transport_service_request(broker_id,req,2,'CONTACTED','First call');
 perform pg_temp.expect_brokerage_denied(format('select update_transport_service_request(%L,%L,2,''CLOSED'',''stale'')',broker_id,req),'TRANSPORT_REQUEST_CHANGED');
 perform assign_transport_service_request(admin_id,req,3,other_id,false);
 perform pg_temp.expect_brokerage_denied(format('select update_transport_service_request(%L,%L,4,''CLOSED'',''x'')',broker_id,req));
 perform update_transport_service_request(other_id,req,4,'CLOSED','Referred offline');
 perform pg_temp.expect_brokerage_denied(format('select update_transport_service_request(%L,%L,5,''NEW'',''x'')',other_id,req));
 perform update_transport_service_request(admin_id,req,5,'NEW','Reopened');
 update support_agent_profiles set can_manage_brokerage=false where user_id=other_id;
 if (select assigned_agent_user_id from transport_service_requests where id=req) is not null then raise exception 'REVOKED_OWNER_NOT_RELEASED';end if;
 perform pg_temp.expect_brokerage_denied(format('select brokerage_request_inbox(%L,''MINE'',''ALL'',1)',other_id));
 select version into v from transport_service_requests where id=req;
 perform pg_temp.expect_brokerage_denied(format('select assign_transport_service_request(%L,%L,%s,%L,false)',admin_id,req,v,support_id));
 perform assign_transport_service_request(broker_id,req,v,null,true);
 update profiles set active=false where id=broker_id;
 if (select assigned_agent_user_id from transport_service_requests where id=req) is not null then raise exception 'SUSPENDED_OWNER_NOT_RELEASED';end if;
 select version into v from transport_service_requests where id=req;
 perform update_transport_service_request(admin_id,req,v,'CLOSED','Archive');
 update profiles set active=true where id=broker_id;
 perform assign_transport_service_request(admin_id,req,v+1,broker_id,false);
 update support_agent_profiles set can_manage_brokerage=false where user_id=broker_id;
 perform update_transport_service_request(admin_id,req,v+2,'NEW','Reopen after team change');
 if (select assigned_agent_user_id from transport_service_requests where id=req) is not null then raise exception 'REOPENED_WITH_REVOKED_OWNER';end if;
 update support_agent_profiles set can_manage_brokerage=true where user_id=broker_id;
 if not exists(select 1 from transport_request_events where request_id=req and note='First call')
   or not exists(select 1 from transport_request_events where request_id=req and note='Referred offline') then raise exception 'PRIVATE_HISTORY_LOST';end if;
 if exists(select 1 from audit_logs where entity_id=req and details::text ~ 'Private caller|First call|251900000008') then raise exception 'AUDIT_PII_LEAK';end if;
 -- General help stays in Support. Brokerage alone cannot read, claim or reply.
 insert into guest_support_conversations(id,email,email_digest,phone,status) values(chat,'support-workflow@example.test',repeat('e',64),'+251900000009','WAITING');
 insert into guest_support_messages(conversation_id,sender_kind,body) values(chat,'GUEST','Help with an issue');
 update profiles set active=true where id=broker_id;
 perform pg_temp.expect_brokerage_denied(format('select managed_guest_support_inbox(%L,''WAITING'',0,15)',broker_id));
 perform pg_temp.expect_brokerage_denied(format('select claim_managed_guest_support(%L,%L)',broker_id,chat));
 perform pg_temp.expect_brokerage_denied(format('select assign_guest_support_agent(%L,%L,null,%L)',admin_id,chat,broker_id),'SUPPORT_AGENT_UNAVAILABLE');
 perform pg_temp.expect_brokerage_denied(format('select assign_guest_support_agent(%L,%L,null,%L)',support_id,chat,support_id));
 update support_agent_profiles set available=false where user_id=support_id;
 perform pg_temp.expect_brokerage_denied(format('select assign_guest_support_agent(%L,%L,null,%L)',admin_id,chat,support_id),'SUPPORT_AGENT_UNAVAILABLE');
 update support_agent_profiles set available=true,max_open_conversations=1 where user_id=support_id;
 insert into guest_support_conversations(id,email,email_digest,phone,status,assigned_agent_user_id)
 values(capacity_chat,'capacity@example.test',repeat('f',64),'+251900000007','OPEN',support_id);
 perform pg_temp.expect_brokerage_denied(format('select assign_guest_support_agent(%L,%L,null,%L)',admin_id,chat,support_id),'SUPPORT_AGENT_AT_CAPACITY');
 update guest_support_conversations set status='CLOSED' where id=capacity_chat;
 perform assign_guest_support_agent(admin_id,chat,null,support_id);
 result:=managed_guest_support_conversation(support_id,chat,null,50,false);
 if result->>'assigned_agent_user_id'<>support_id::text then raise exception 'SUPPORT_ASSIGNMENT_MISSING';end if;
 perform pg_temp.expect_brokerage_denied(format('select assign_guest_support_agent(%L,%L,null,%L)',admin_id,chat,support_id),'TRANSPORT_REQUEST_CHANGED');
 perform pg_temp.expect_brokerage_denied(format('select managed_guest_support_conversation(%L,%L,null,50,false)',broker_id,chat),'NOT_FOUND');
 perform close_managed_guest_support(support_id,chat,null);
 perform pg_temp.expect_brokerage_denied(format('select assign_guest_support_agent(%L,%L,%L,null)',admin_id,chat,support_id),'SUPPORT_CONVERSATION_CLOSED');
 -- Waiting list must offer only valid FIFO claims, including the shared chat limit.
 -- Closing the earlier chat can automatically assign an existing queued chat
 -- from the restored database. Reserve exactly one remaining slot relative to
 -- that real baseline; the claim below must still fill it and deny another.
 update support_agent_profiles set max_open_conversations=1+
   (select count(*) from support_conversations where assigned_agent_user_id=support_id and status='OPEN')+
   (select count(*) from guest_support_conversations where assigned_agent_user_id=support_id and status='OPEN')
 where user_id=support_id;
 insert into guest_support_conversations(id,email,email_digest,phone,status,created_at) values
 (fifo_first,'fifo-first@example.test',repeat('c',64),'+251900000015','WAITING','1900-01-01'),
 (fifo_next,'fifo-next@example.test',repeat('d',64),'+251900000016','WAITING','1900-01-02');
 select payload into result from managed_guest_support_inbox(support_id,'WAITING',0,50) where payload->>'id'=fifo_first::text;
 if result is null or not (result->>'can_claim')::boolean then raise exception 'OLDEST_CLAIM_NOT_OFFERED';end if;
 select payload into result from managed_guest_support_inbox(support_id,'WAITING',0,50) where payload->>'id'=fifo_next::text;
 if result is null or (result->>'can_claim')::boolean then raise exception 'INVALID_LATER_CLAIM_OFFERED';end if;
 perform pg_temp.expect_brokerage_denied(format('select claim_managed_guest_support(%L,%L)',support_id,fifo_next),'SUPPORT_CONVERSATION_NOT_WAITING');
 perform claim_managed_guest_support(support_id,fifo_first);
 select payload into result from managed_guest_support_inbox(support_id,'WAITING',0,50) where payload->>'id'=fifo_next::text;
 if (result->>'can_claim')::boolean then raise exception 'FULL_AGENT_CLAIM_OFFERED';end if;
 perform close_managed_guest_support(support_id,fifo_first,null);
 if not exists(select 1 from guest_support_conversations where id=fifo_next and status='OPEN' and assigned_agent_user_id is not null) then raise exception 'NEXT_CHAT_NOT_AUTOMATICALLY_ASSIGNED';end if;
 if has_table_privilege('anon','transport_request_events','SELECT') or has_table_privilege('authenticated','transport_request_events','SELECT,INSERT,UPDATE,DELETE')
   or has_function_privilege('authenticated','brokerage_request_inbox(uuid,text,text,integer)','EXECUTE')
   or has_function_privilege('anon','assign_transport_service_request(uuid,uuid,integer,uuid,boolean)','EXECUTE')
   or has_function_privilege('authenticated','assign_guest_support_agent(uuid,uuid,uuid,uuid)','EXECUTE') then raise exception 'BROWSER_BYPASS';end if;
 raise notice 'PASS: team separation, scoped contacts, claim, reassignment, stale writes, history, revocation, suspension, support assignment/closure and ACL denial';
end $test$;
rollback;
