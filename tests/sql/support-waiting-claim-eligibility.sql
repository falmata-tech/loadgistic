-- FEAT-SUP-001 / WEB-MOB-032. Disposable local fixture clone only.
-- Every fixture, permission edit, claim event and audit is rolled back.
begin;
create function pg_temp.expect_claim_denied(command text,expected text) returns void language plpgsql as $$
begin
 begin execute command;exception when others then if sqlerrm=expected then return;end if;raise;end;
 raise exception 'EXPECTED_CLAIM_DENIAL';
end $$;
do $test$
declare members uuid[];agent_id uuid;competitor uuid;admin_id uuid;first_id uuid:=gen_random_uuid();second_id uuid:=gen_random_uuid();swap_id uuid;
 ids uuid[];member_open uuid:=gen_random_uuid();guest_open uuid:=gen_random_uuid();result jsonb;later jsonb;admin_result jsonb;current_item jsonb;
 baseline_total integer;baseline_waiting integer;baseline_open integer;competitor_open integer;initial_audits bigint;claims integer;i integer;
 first_time timestamptz;
begin
 select array_agg(id order by id) into members from (select p.id from profiles p where p.active and p.role='DRIVER'
  and not exists(select 1 from support_conversations c where c.customer_user_id=p.id and c.status in ('OPEN','WAITING')) order by p.id limit 17) available;
 if coalesce(array_length(members,1),0)<>17 then raise exception 'FIXTURE_MEMBER_COUNT_REQUIRED';end if;
 select p.id into strict agent_id from profiles p join support_agent_profiles a on a.user_id=p.id where p.active and p.role='SUPPORT' order by p.id limit 1;
 -- The protected baseline has one staff member; create the competing actor only
 -- inside this rollback transaction, using the established SQL fixture pattern.
 competitor:=gen_random_uuid();
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
 values(competitor,'support-claim-'||competitor||'@example.test',now(),'{}');
 insert into profiles(id,email,full_name,role,active)
 values(competitor,'support-claim-'||competitor||'@example.test','Synthetic claim staff','SUPPORT',true)
 on conflict(id) do update set role='SUPPORT',active=true;
 insert into support_agent_profiles(user_id,active,available,can_manage_support) values(competitor,true,true,true);
 select id into strict admin_id from profiles where active and role='ADMIN' order by id limit 1;
 select (select count(*) from support_conversations where assigned_agent_user_id=agent_id and status='OPEN')+
  (select count(*) from guest_support_conversations where assigned_agent_user_id=agent_id and status='OPEN') into baseline_open;
 select (select count(*) from support_conversations where assigned_agent_user_id=competitor and status='OPEN')+
  (select count(*) from guest_support_conversations where assigned_agent_user_id=competitor and status='OPEN') into competitor_open;
 if greatest(baseline_open,competitor_open)>18 then raise exception 'FIXTURE_CAPACITY_REQUIRED';end if;
 update support_agent_profiles set active=true,available=true,can_manage_support=true,max_open_conversations=baseline_open+2 where user_id=agent_id;
 update support_agent_profiles set active=true,available=true,can_manage_support=true,max_open_conversations=competitor_open+2 where user_id=competitor;
 result:=managed_support_inbox(agent_id,'WAITING',0,15);baseline_total:=(result->>'total')::integer;baseline_waiting:=(result->'counts'->>'waiting')::integer;
 select coalesce(min(created_at),now())-interval '1 day' into first_time from support_conversations where status='WAITING';
 if first_id>second_id then swap_id:=first_id;first_id:=second_id;second_id:=swap_id;end if;
 ids:=array[first_id,second_id];for i in 3..16 loop ids:=array_append(ids,gen_random_uuid());end loop;
 for i in 1..16 loop
  insert into support_conversations(id,customer_user_id,category,status,created_at,last_message_at)
  values(ids[i],members[i],'ACCOUNT','WAITING',first_time+case when i<=2 then interval '0' else i*interval '1 second' end,
   first_time+case when i=2 then interval '1 hour' else interval '0' end);
 end loop;
 result:=managed_support_inbox(agent_id,'WAITING',0,15);later:=managed_support_inbox(agent_id,'WAITING',15,15);
 if result->'items'->0->>'id'<>first_id::text or result->'items'->1->>'id'<>second_id::text then raise exception 'WAITING_FIFO_TIE_ORDER';end if;
 if (result->>'total')::integer<>baseline_total+16 or (result->'counts'->>'waiting')::integer<>baseline_waiting+16 or jsonb_array_length(result->'items')<>15
  or later->'items'->0->>'id'<>ids[16]::text then raise exception 'WAITING_PAGINATION_OR_COUNTS';end if;
 claims:=0;for current_item in select value from jsonb_array_elements(result->'items') loop
  if jsonb_typeof(current_item->'can_claim') is distinct from 'boolean' then raise exception 'AUTHORITATIVE_CAN_CLAIM_MISSING';end if;
  if (current_item->>'can_claim')::boolean then claims:=claims+1;if current_item->>'id'<>first_id::text then raise exception 'NON_OLDEST_CLAIM_OFFERED';end if;end if;
 end loop;
 if claims<>1 or exists(select 1 from jsonb_array_elements(later->'items') item where (item->>'can_claim')::boolean) then raise exception 'LATER_PAGE_CLAIM_OFFERED';end if;
 select count(*) into initial_audits from audit_logs where entity_id=any(ids);
 perform pg_temp.expect_claim_denied(format('select claim_managed_support_conversation(%L,%L)',agent_id,second_id),'SUPPORT_CONVERSATION_NOT_WAITING');
 if exists(select 1 from support_conversations where id=second_id and status<>'WAITING') or
  (select count(*) from audit_logs where entity_id=any(ids))<>initial_audits then raise exception 'DENIED_CLAIM_MUTATED';end if;
 update support_agent_profiles set available=false where user_id=agent_id;
 result:=managed_support_inbox(agent_id,'WAITING',0,15);
 if exists(select 1 from jsonb_array_elements(result->'items') item where (item->>'can_claim')::boolean) then raise exception 'PAUSED_CLAIM_OFFERED';end if;
 perform pg_temp.expect_claim_denied(format('select claim_managed_support_conversation(%L,%L)',agent_id,first_id),'SUPPORT_AGENT_UNAVAILABLE');
 update support_agent_profiles set available=true where user_id=agent_id;
 -- Another eligible actor claims between the first actor's read and submit.
 if managed_support_inbox(competitor,'WAITING',0,15)->'items'->0->>'can_claim'<>'true' then raise exception 'COMPETING_ACTOR_ELIGIBILITY';end if;
 perform claim_managed_support_conversation(competitor,first_id);
 perform pg_temp.expect_claim_denied(format('select claim_managed_support_conversation(%L,%L)',agent_id,first_id),'SUPPORT_CONVERSATION_NOT_WAITING');
 if not exists(select 1 from support_conversations where id=first_id and status='OPEN' and assigned_agent_user_id=competitor) then raise exception 'COMPETING_CLAIM_OWNERSHIP';end if;
 result:=managed_support_inbox(agent_id,'WAITING',0,15);
 if result->'items'->0->>'id'<>second_id::text or result->'items'->0->>'can_claim'<>'true' then raise exception 'NEXT_FIFO_ELIGIBILITY';end if;
 -- One member and one retained-guest OPEN assignment together consume capacity.
 insert into support_conversations(id,customer_user_id,assigned_agent_user_id,category,status) values(member_open,members[17],agent_id,'ACCOUNT','OPEN');
 insert into guest_support_conversations(id,email,email_digest,phone,status,assigned_agent_user_id)
 values(guest_open,'support-claim@example.test',md5(guest_open::text)||md5(member_open::text),'+251911000000','OPEN',agent_id);
 result:=managed_support_inbox(agent_id,'WAITING',0,15);
 if (result->'agent'->>'open_count')::integer<>baseline_open+2 or exists(select 1 from jsonb_array_elements(result->'items') item where (item->>'can_claim')::boolean) then raise exception 'SHARED_CAPACITY_CLAIM_OFFERED';end if;
 perform pg_temp.expect_claim_denied(format('select claim_managed_support_conversation(%L,%L)',agent_id,second_id),'SUPPORT_AGENT_AT_CAPACITY');
 update guest_support_conversations set status='CLOSED' where id=guest_open;
 result:=managed_support_inbox(agent_id,'WAITING',0,15);
 if result->'items'->0->>'can_claim'<>'true' then raise exception 'FREED_SHARED_CAPACITY_NOT_VISIBLE';end if;
 perform claim_managed_support_conversation(agent_id,second_id);
 if not exists(select 1 from support_conversations where id=second_id and status='OPEN' and assigned_agent_user_id=agent_id)
  or (select count(*) from support_events where conversation_id=second_id and event_type='CLAIMED')<>1 then raise exception 'CLAIM_NOT_PERSISTED';end if;
 admin_result:=managed_support_inbox(admin_id,'WAITING',0,50);
 if exists(select 1 from jsonb_array_elements(admin_result->'items') item where (item->>'can_claim')::boolean) then raise exception 'ADMIN_CLAIM_OFFERED';end if;
 perform pg_temp.expect_claim_denied(format('select claim_managed_support_conversation(%L,%L)',admin_id,ids[3]),'FORBIDDEN');
 result:=managed_support_inbox(agent_id,'ASSIGNED',0,50);
 if not exists(select 1 from jsonb_array_elements(result->'items') item where item->>'id'=second_id::text and item->>'can_claim'='false') then raise exception 'ASSIGNED_SHAPE_OR_ELIGIBILITY';end if;
 result:=managed_support_inbox(agent_id,'WAITING',0,999);
 if jsonb_array_length(result->'items')>50 then raise exception 'UNBOUNDED_INBOX';end if;
 perform pg_temp.expect_claim_denied(format('select managed_support_inbox(%L,''INVALID'',0,15)',agent_id),'INVALID_SUPPORT_VIEW');
 perform pg_temp.expect_claim_denied(format('select managed_support_inbox(%L,''WAITING'',0,15)',members[1]),'FORBIDDEN');
 perform pg_temp.expect_claim_denied(format('select managed_support_inbox(%L,''WAITING'',0,15)',gen_random_uuid()),'FORBIDDEN');
 update support_agent_profiles set can_manage_support=false where user_id=agent_id;
 perform pg_temp.expect_claim_denied(format('select managed_support_inbox(%L,''WAITING'',0,15)',agent_id),'FORBIDDEN');
 perform pg_temp.expect_claim_denied(format('select claim_managed_support_conversation(%L,%L)',agent_id,ids[3]),'FORBIDDEN');
 update support_agent_profiles set can_manage_support=true,active=false where user_id=agent_id;
 perform pg_temp.expect_claim_denied(format('select managed_support_inbox(%L,''WAITING'',0,15)',agent_id),'FORBIDDEN');
 update support_agent_profiles set active=true where user_id=agent_id;
 update profiles set active=false where id=agent_id;
 perform pg_temp.expect_claim_denied(format('select managed_support_inbox(%L,''WAITING'',0,15)',agent_id),'FORBIDDEN');
 if has_function_privilege('anon','public.managed_support_inbox(uuid,text,integer,integer)','execute')
  or has_function_privilege('authenticated','public.managed_support_inbox(uuid,text,integer,integer)','execute')
  or not has_function_privilege('service_role','public.managed_support_inbox(uuid,text,integer,integer)','execute') then raise exception 'INBOX_EXECUTE_GRANT_DRIFT';end if;
 raise notice 'Support FIFO, tie order, pagination, shared capacity, competing claim, authority and grants passed';
end $test$;
rollback;
