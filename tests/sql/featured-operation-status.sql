begin;
do $test$
declare admin_id uuid;staff_id uuid;summary jsonb;result jsonb;
begin
 select id into strict admin_id from profiles where active and role='ADMIN' limit 1;
 select id into staff_id from profiles where active and role='SUPPORT' and not public.can_manage_featured(id) limit 1;
 summary:=managed_featured_overview(admin_id);
 if jsonb_array_length(summary->'days')<>7 or (summary->>'remaining')::integer>(summary->>'eligible')::integer then raise exception 'BAD_OVERVIEW';end if;
 begin perform managed_featured_overview(staff_id);raise exception 'STAFF_OVERVIEW_ALLOWED';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
 begin perform managed_featured_overview(null);raise exception 'ANON_OVERVIEW_ALLOWED';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
 update platform_controls set featured_mode='MANUAL' where singleton;
 result:=generate_managed_featured_days();
 if result->>'ok'<>'true' or (select outcome from featured_automation_status where singleton)<>'PAUSED' then raise exception 'PAUSE_STATUS_MISSING';end if;
 update platform_controls set featured_mode='AUTO' where singleton;
 result:=generate_managed_featured_days();
 if result->>'ok'<>'true' or (select outcome from featured_automation_status where singleton)<>'READY' then raise exception 'SUCCESS_STATUS_MISSING';end if;
 if has_table_privilege('anon','featured_automation_status','SELECT') or has_table_privilege('authenticated','featured_automation_status','SELECT,INSERT,UPDATE,DELETE')
   or has_function_privilege('anon','managed_featured_overview(uuid)','EXECUTE') or has_function_privilege('authenticated','generate_managed_featured_days()','EXECUTE')
   or has_function_privilege('service_role','generate_managed_featured_days_core()','EXECUTE') then raise exception 'STATUS_AUTHORITY_BYPASS';end if;
end $test$;
-- Inject failure after a write; the wrapper must retain failure status, not partial work or raw errors.
create or replace function public.generate_managed_featured_days_core() returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin insert into audit_logs(action,entity_type,details) values('FEATURED_TEST_PARTIAL','test','{}');raise exception 'private error that must never leave the generator';end $$;
do $$declare result jsonb;begin
 result:=generate_managed_featured_days();
 if result->>'ok'<>'false' or (select outcome from featured_automation_status where singleton)<>'FAILED' then raise exception 'FAILURE_NOT_RECORDED';end if;
 if exists(select 1 from audit_logs where action='FEATURED_TEST_PARTIAL') or result::text like '%private error%' then raise exception 'PARTIAL_WORK_OR_ERROR_LEAK';end if;
 raise notice 'PASS: Featured overview, successful/paused/failed run status, atomic failure rollback and role/ACL denial';
end $$;
rollback;
