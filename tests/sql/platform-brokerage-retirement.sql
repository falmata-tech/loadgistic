-- FEAT-ENT/TRQ/SHR/SUP/NOT-001. Isolated local159 rehearsal, rollback only.
begin;
create function pg_temp.retired_denied(statement text,expected text) returns void language plpgsql as $$
declare denied boolean:=false;
begin
 begin execute statement;exception when others then if sqlerrm<>expected then raise;end if;denied:=true;end;
 if not denied then raise exception 'RETIREMENT_DENIAL_MISSING_%',expected;end if;
end $$;
do $test$
declare actor uuid;worker uuid;result jsonb;before_support jsonb;before_requests jsonb;before_messages bigint;row record;
begin
 select p.id into actor from profiles p join auth.users u on u.id=p.id where p.active and p.role='ADMIN'
  and u.raw_app_meta_data->>'fixture_source'='loadgistic' and u.raw_user_meta_data->>'fixture_key'='user-admin';
 if actor is null then raise exception 'LOCAL_ADMIN_FIXTURE_REQUIRED';end if;
 select jsonb_agg(to_jsonb(c) order by id) into before_support from support_conversations c;
 select jsonb_agg(to_jsonb(r) order by id) into before_requests from transport_service_requests r;
 select count(*) into before_messages from transport_chat_messages;
 if can_manage_brokerage(actor) or can_access_transport_chat(gen_random_uuid(),repeat('a',64),actor)
  or private_capacity_operations_actor(actor) then raise exception 'RETIRED_PLATFORM_AUTHORITY_REMAINS';end if;
 perform pg_temp.retired_denied(format('select create_transport_service_request(%L,%L::jsonb)',gen_random_uuid(),'{}'),'PLATFORM_BROKERAGE_RETIRED');
 perform pg_temp.retired_denied(format('select create_transport_chat_request(%L,%L::jsonb,%L)',gen_random_uuid(),'{}',repeat('a',64)),'PLATFORM_BROKERAGE_RETIRED');
 perform pg_temp.retired_denied(format('select brokerage_request_inbox(%L)',actor),'PLATFORM_BROKERAGE_RETIRED');
 perform pg_temp.retired_denied(format('select transport_chat_snapshot(%L,%L,%L)',gen_random_uuid(),repeat('a',64),actor),'PLATFORM_BROKERAGE_RETIRED');
 perform pg_temp.retired_denied(format('select set_loadgistic_capacity_access(%L,%L,true,%L)',actor,gen_random_uuid(),repeat('a',64)),'PLATFORM_BROKERAGE_RETIRED');
 perform pg_temp.retired_denied(format('select * from private_capacity_projection(%L,%L)', 'LOADGISTIC',repeat('a',64)),'PLATFORM_CAPACITY_RETIRED');
 perform pg_temp.retired_denied(format('select capacity_search_results(%L::jsonb,%L,%L,%L,1)','{}','LOADGISTIC',repeat('a',64),actor),'PLATFORM_CAPACITY_RETIRED');
 perform pg_temp.retired_denied(format('select chat_read_state(%L,%L,%L)', 'BROKERAGE',gen_random_uuid(),actor),'FORBIDDEN');
 perform pg_temp.retired_denied(format('select chat_alert_snapshot(null,%L,%L)',gen_random_uuid(),repeat('a',64)),'FORBIDDEN');
 if exists(select 1 from support_agent_profiles where can_manage_brokerage) then raise exception 'BROKERAGE_TEAM_FLAG_REMAINS';end if;
 select user_id into worker from support_agent_profiles limit 1;
 if worker is not null then perform pg_temp.retired_denied(format('update support_agent_profiles set can_manage_brokerage=true where user_id=%L',worker),'PLATFORM_BROKERAGE_RETIRED');end if;
 if exists(select 1 from capacity_access_grants where audience_type='LOADGISTIC' and revoked_at is null)
  or exists(select 1 from native_push_bindings where audience='GUEST' and expires_at>clock_timestamp())
  or exists(select 1 from native_push_outbox where kind='BROKERAGE' and state in('PENDING','SENDING','SUBMITTED','CHECKING')) then raise exception 'RETIRED_ACTIVE_STATE_REMAINS';end if;
 result:=chat_alert_snapshot(actor);
 if exists(select 1 from jsonb_array_elements(result->'items') item where item->>'kind'<>'SUPPORT') then raise exception 'RETIRED_ALERT_RETURNED';end if;
 -- Existing Support functions remain callable and installed; no fabricated
 -- permission transfer or mutation of either conversation history occurred.
 if before_support is distinct from(select jsonb_agg(to_jsonb(c) order by id) from support_conversations c)
  or before_requests is distinct from(select jsonb_agg(to_jsonb(r) order by id) from transport_service_requests r)
  or before_messages<>(select count(*) from transport_chat_messages) then raise exception 'RETIREMENT_COMMAND_MUTATED_HISTORY';end if;
 if not has_function_privilege('service_role','public.chat_alert_snapshot(uuid,uuid,text)','EXECUTE')
  or not has_function_privilege('service_role','public.acknowledge_visible_chat_read(text,uuid,uuid,text,bigint,bigint)','EXECUTE')
  or not has_function_privilege('service_role','public.native_push_delivery_context(uuid,uuid)','EXECUTE') then raise exception 'SOFTWARE_SUPPORT_AUTHORITY_REMOVED';end if;
 for row in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like '%_pre_retirement159' loop
  if has_function_privilege('service_role',row.oid,'EXECUTE') or has_function_privilege('authenticated',row.oid,'EXECUTE') then raise exception 'RETIRED_AUDIENCE_COPY_EXPOSED';end if;
 end loop;
end $test$;
rollback;
