begin;
create function pg_temp.chat_denied(command text,expected text default 'FORBIDDEN') returns void language plpgsql as $$
begin begin execute command;exception when others then if sqlerrm=expected then return;end if;raise;end;raise exception 'EXPECTED_DENIAL: %',expected;end $$;
do $test$
declare admin_id uuid;broker uuid:=gen_random_uuid();other_broker uuid:=gen_random_uuid();support_id uuid:=gen_random_uuid();uid uuid;
 req uuid:=gen_random_uuid();legacy uuid:=gen_random_uuid();other_req uuid:=gen_random_uuid();msg uuid:=gen_random_uuid();result jsonb;v integer;i integer;
 command jsonb:='{"name":"Synthetic visitor","phone":"+251900000003","origin":"Adama","destination":"Dire Dawa"}';
begin
 select id into strict admin_id from profiles where active and role='ADMIN' limit 1;
 foreach uid in array array[broker,other_broker,support_id] loop
  insert into auth.users(id,email) values(uid,uid::text||'@example.test');
  insert into profiles(id,email,full_name,role,active) values(uid,uid::text||'@example.test','Chat test staff','SUPPORT',true)
   on conflict(id) do update set role='SUPPORT',active=true;
  insert into support_agent_profiles(user_id,active,available,max_open_conversations,can_manage_support,can_manage_brokerage)
   values(uid,true,true,20,uid=support_id,uid<>support_id);
 end loop;
 perform create_transport_chat_request(req,command,repeat('a',64));
 perform create_transport_chat_request(req,command,repeat('a',64));
 if (select count(*) from transport_service_requests where id=req)<>1 then raise exception 'DUPLICATE_REQUEST';end if;
 perform pg_temp.chat_denied(format('select create_transport_chat_request(%L,%L,%L)',req,command,repeat('b',64)));
 perform create_transport_service_request(legacy,command);
 perform pg_temp.chat_denied(format('select create_transport_chat_request(%L,%L,%L)',legacy,command,repeat('a',64)));
 perform create_transport_chat_request(other_req,command,repeat('b',64));
 perform pg_temp.chat_denied(format('select transport_chat_snapshot(%L,%L,null)',other_req,repeat('a',64)));
 perform pg_temp.chat_denied(format('select transport_chat_snapshot(%L,null,%L)',req,broker));
 perform send_transport_chat_message(req,repeat('a',64),null,msg,'Private visitor message');
 perform send_transport_chat_message(req,repeat('a',64),null,msg,'Private visitor message');
 if (select count(*) from transport_chat_messages where request_id=req)<>1 then raise exception 'DUPLICATE_MESSAGE';end if;
 perform pg_temp.chat_denied(format('select send_transport_chat_message(%L,%L,null,%L,''Changed'')',req,repeat('a',64),msg),'INVALID_TRANSPORT_MESSAGE');
 perform assign_transport_service_request(broker,req,1,null,true);
 perform send_transport_chat_message(req,null,broker,gen_random_uuid(),'Broker reply');
 result:=transport_chat_snapshot(req,repeat('a',64),null);
 if jsonb_array_length(result->'messages')<>2 or result::text ~ 'credential_digest|actor_user_id|requester_name|follow_up_note|251900000003' then raise exception 'CHAT_PROJECTION_FAILED';end if;
 foreach uid in array array[other_broker,support_id] loop
  perform pg_temp.chat_denied(format('select transport_chat_snapshot(%L,null,%L)',req,uid));
  perform pg_temp.chat_denied(format('select send_transport_chat_message(%L,null,%L,%L,''Denied'')',req,uid,gen_random_uuid()));
 end loop;
 select version into v from transport_service_requests where id=req;
 perform update_transport_service_request(admin_id,req,v,'CLOSED','Internal note never shared');
 perform pg_temp.chat_denied(format('select send_transport_chat_message(%L,%L,null,%L,''Closed'')',req,repeat('a',64),gen_random_uuid()),'TRANSPORT_CHAT_CLOSED');
 perform pg_temp.chat_denied(format('select send_transport_chat_message(%L,null,%L,%L,''Closed'')',req,broker,gen_random_uuid()),'TRANSPORT_CHAT_CLOSED');
 perform update_transport_service_request(admin_id,req,v+1,'NEW','Reopen');
 perform assign_transport_service_request(admin_id,req,v+2,other_broker,false);
 perform pg_temp.chat_denied(format('select send_transport_chat_message(%L,null,%L,%L,''Old owner'')',req,broker,gen_random_uuid()));
 for i in 1..55 loop perform send_transport_chat_message(req,repeat('a',64),null,gen_random_uuid(),'History '||i);end loop;
 result:=transport_chat_snapshot(req,repeat('a',64),null);
 if jsonb_array_length(result->'messages')<>50 or not (result->>'hasMore')::boolean then raise exception 'BOUNDED_HISTORY_FAILED';end if;
 result:=transport_chat_snapshot(req,repeat('a',64),null,0,(result->'messages'->0->>'sequence')::bigint);
 if jsonb_array_length(result->'messages')<>7 then raise exception 'OLDER_HISTORY_LOST';end if;
 result:=transport_chat_snapshot(req,repeat('a',64),null,(result->'messages'->0->>'sequence')::bigint);
 if jsonb_array_length(result->'messages')<>50 or not (result->>'hasMore')::boolean then raise exception 'CATCH_UP_FAILED';end if;
 result:=brokerage_request_inbox(admin_id,'ALL','ALL',1);
 if not (result->'items'->0->>'awaiting_reply')::boolean or (result->'items'->0->>'id')<>req::text then raise exception 'AWAITING_REPLY_QUEUE_FAILED';end if;
 update support_agent_profiles set can_manage_brokerage=false where user_id=other_broker;
 perform pg_temp.chat_denied(format('select transport_chat_snapshot(%L,null,%L)',req,other_broker));
 update transport_chat_access set expires_at=now()-interval '1 second' where request_id=req;
 perform pg_temp.chat_denied(format('select transport_chat_snapshot(%L,%L,null)',req,repeat('a',64)));
 perform transport_chat_snapshot(req,null,admin_id);
 if exists(select 1 from audit_logs where entity_id=req and details::text ~ 'Private visitor message|Broker reply|251900000003') then raise exception 'AUDIT_TEXT_LEAK';end if;
end $test$;
-- Catalog denial includes all message objects and their identity sequence.
do $$ declare role_name text;object_name text;signature text;begin
 if exists(select 1 from pg_publication_tables where schemaname='public' and tablename in ('transport_chat_access','transport_chat_messages')) then raise exception 'UNREVIEWED_CHAT_PUBLICATION';end if;
 foreach role_name in array array['anon','authenticated'] loop
  foreach object_name in array array['transport_chat_access','transport_chat_messages'] loop
   if has_table_privilege(role_name,'public.'||object_name,'SELECT,INSERT,UPDATE,DELETE') then raise exception 'BROWSER_CHAT_GRANT';end if;
   if not (select relrowsecurity from pg_class where oid=('public.'||object_name)::regclass) then raise exception 'CHAT_RLS_REQUIRED';end if;
  end loop;
  if has_sequence_privilege(role_name,'public.transport_chat_messages_sequence_seq','USAGE,SELECT,UPDATE') then raise exception 'BROWSER_CHAT_SEQUENCE';end if;
  foreach signature in array array['create_transport_chat_request(uuid,jsonb,text)','can_access_transport_chat(uuid,text,uuid)','transport_chat_snapshot(uuid,text,uuid,bigint,bigint)','send_transport_chat_message(uuid,text,uuid,uuid,text)'] loop
   if has_function_privilege(role_name,'public.'||signature,'EXECUTE') then raise exception 'BROWSER_CHAT_RPC';end if;
  end loop;
 end loop;
end $$;
rollback;
