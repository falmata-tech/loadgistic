-- Synthetic requests and staff only; retain no test writes.
begin;
create function pg_temp.must_deny(command text,expected text default 'FORBIDDEN') returns void language plpgsql as $$
begin begin execute command;exception when others then if sqlerrm=expected then return;end if;raise;end;raise exception 'EXPECTED_DENIAL: %',expected;end $$;
do $test$
declare admin_id uuid;broker uuid:=gen_random_uuid();other_broker uuid:=gen_random_uuid();u uuid;
 req uuid:=gen_random_uuid();waiting uuid:=gen_random_uuid();expired uuid:=gen_random_uuid();legacy uuid:=gen_random_uuid();msg uuid:=gen_random_uuid();v integer;result jsonb;before_count integer;ended_time timestamptz;
 command jsonb:='{"name":"Follow-up visitor","phone":"+251900000003","origin":"Adama","destination":"Dire Dawa"}';
begin
 select id into strict admin_id from profiles where active and role='ADMIN' limit 1;
 foreach u in array array[broker,other_broker] loop
  insert into auth.users(id,email) values(u,u::text||'@example.test');
  insert into profiles(id,email,full_name,role,active) values(u,u::text||'@example.test','Follow-up test staff','SUPPORT',true) on conflict(id) do update set role='SUPPORT',active=true;
  insert into support_agent_profiles(user_id,active,available,max_open_conversations,can_manage_support,can_manage_brokerage) values(u,true,true,20,false,true);
 end loop;
 perform create_transport_chat_request(req,command,repeat('a',64));
 perform send_transport_chat_message(req,repeat('a',64),null,msg,'Please help arrange pickup');
 perform assign_transport_service_request(broker,req,1,null,true);
 perform update_transport_service_request(broker,req,2,'CONTACTED','Internal call note');
 perform pg_temp.must_deny(format('select end_transport_chat(%L,null)',req));
 perform pg_temp.must_deny(format('select end_transport_chat(%L,%L)',req,repeat('b',64)));
 result:=brokerage_request_inbox(broker,'MINE','ACTIVE',1);
 if (result->>'total')::integer<>1 or not(result->'items'->0->>'awaiting_reply')::boolean then raise exception 'ACTIVE_CHAT_MISSING';end if;
 perform end_transport_chat(req,repeat('a',64));
 select ended_at into strict ended_time from transport_chat_access where request_id=req;
 if ended_time is null then raise exception 'END_NOT_RECORDED';end if;
 select version into v from transport_service_requests where id=req;
 if not exists(select 1 from transport_service_requests where id=req and status='CONTACTED' and assigned_agent_user_id=broker and follow_up_note='Internal call note' and phone='+251900000003') then raise exception 'FOLLOW_UP_WAS_LOST';end if;
 perform end_transport_chat(req,repeat('a',64));
 if (select version from transport_service_requests where id=req)<>v or (select ended_at from transport_chat_access where request_id=req)<>ended_time or (select count(*) from audit_logs where entity_id=req and action='transport_chat_ended')<>1 then raise exception 'ENDING_NOT_IDEMPOTENT';end if;
 -- Previously acknowledged message retries remain idempotent, but no new writes.
 perform send_transport_chat_message(req,repeat('a',64),null,msg,'Please help arrange pickup');
 perform pg_temp.must_deny(format('select send_transport_chat_message(%L,%L,null,%L,''After ending'')',req,repeat('a',64),gen_random_uuid()),'TRANSPORT_CHAT_ENDED');
 perform pg_temp.must_deny(format('select send_transport_chat_message(%L,null,%L,%L,''After ending'')',req,broker,gen_random_uuid()),'TRANSPORT_CHAT_ENDED');
 result:=transport_chat_snapshot(req,repeat('a',64),null);
 if result ? 'staffDetails' or result::text ~ 'Internal call note|251900000003|credential_digest' or jsonb_array_length(result->'messages')<>1 or result->'request'->>'endedAt' is null then raise exception 'VISITOR_HISTORY_OR_PRIVACY';end if;
 result:=transport_chat_snapshot(req,null,broker);
 if result->'staffDetails'->>'phone'<>'+251900000003' or result->'staffDetails'->>'followUpNote'<>'Internal call note' then raise exception 'STAFF_FOLLOW_UP_MISSING';end if;
 perform pg_temp.must_deny(format('select transport_chat_snapshot(%L,null,%L)',req,other_broker));
 if (brokerage_request_inbox(broker,'MINE','ACTIVE',1)->>'total')::integer<>0 then raise exception 'ENDED_CHAT_STILL_ACTIVE';end if;
 result:=brokerage_request_inbox(broker,'MINE','FOLLOW_UP',1);
 if (result->>'total')::integer<>1 or (result->'items'->0->>'awaiting_reply')::boolean or result->'items'->0->>'chat_ended_at' is null then raise exception 'ENDED_CHAT_NOT_IN_FOLLOW_UP';end if;
 perform pg_temp.must_deny(format('select update_transport_service_request(%L,%L,3,''CLOSED'',''Stale'')',broker,req),'TRANSPORT_REQUEST_CHANGED');
 perform update_transport_service_request(broker,req,v,'CLOSED','Called; no longer interested');
 if (brokerage_request_inbox(broker,'MINE','FOLLOW_UP',1)->>'total')::integer<>0 or (brokerage_request_inbox(broker,'MINE','CLOSED',1)->>'total')::integer<>1 then raise exception 'RESOLVED_GROUP_FAILED';end if;
 perform update_transport_service_request(admin_id,req,v+1,'NEW','Revisit by phone');
 perform pg_temp.must_deny(format('select send_transport_chat_message(%L,null,%L,%L,''Reopened'')',req,broker,gen_random_uuid()),'TRANSPORT_CHAT_ENDED');
 -- A visitor can leave before assignment; staff can still claim/call later.
 perform create_transport_chat_request(waiting,command,repeat('b',64));perform end_transport_chat(waiting,repeat('b',64));
 if (select status from transport_service_requests where id=waiting)<>'NEW' then raise exception 'WAITING_REQUEST_RESOLVED';end if;
 perform assign_transport_service_request(other_broker,waiting,2,null,true);
 if (brokerage_request_inbox(other_broker,'MINE','FOLLOW_UP',1)->>'total')::integer<>1 then raise exception 'WAITING_FOLLOW_UP_MISSING';end if;
 -- Legacy callbacks and expired chats require phone follow-up, not live replies.
 perform create_transport_service_request(legacy,command);perform assign_transport_service_request(other_broker,legacy,1,null,true);
 perform create_transport_chat_request(expired,command,repeat('c',64));perform assign_transport_service_request(other_broker,expired,1,null,true);
 update transport_chat_access set expires_at=now()-interval '1 second' where request_id=expired;
 perform pg_temp.must_deny(format('select end_transport_chat(%L,%L)',expired,repeat('c',64)));
 perform pg_temp.must_deny(format('select send_transport_chat_message(%L,null,%L,%L,''Expired'')',expired,other_broker,gen_random_uuid()),'TRANSPORT_CHAT_ENDED');
 if (brokerage_request_inbox(other_broker,'MINE','FOLLOW_UP',1)->>'total')::integer<>3 then raise exception 'PHONE_FOLLOW_UP_COUNTS';end if;
 perform pg_temp.must_deny(format('select brokerage_request_inbox(%L,''ALL'',''FOLLOW_UP'',1)',other_broker),'INVALID_TRANSPORT_VIEW');
 if exists(select 1 from audit_logs where entity_id=req and details::text ~ 'Internal call note|251900000003|Please help') then raise exception 'AUDIT_LEAK';end if;
end $test$;
do $$ begin
 if has_function_privilege('anon','public.end_transport_chat(uuid,text)','EXECUTE') or has_function_privilege('authenticated','public.end_transport_chat(uuid,text)','EXECUTE') then raise exception 'BROWSER_ENDING_ALLOWED';end if;
 if not has_function_privilege('service_role','public.end_transport_chat(uuid,text)','EXECUTE') then raise exception 'SERVICE_ENDING_MISSING';end if;
end $$;
rollback;
