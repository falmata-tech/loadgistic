begin;
do $test$
declare admin_id uuid;outsider uuid;support_id uuid;request_id uuid:=gen_random_uuid();result jsonb;command jsonb;count_before bigint;request_row public.transport_service_requests%rowtype;
begin
 select id into strict admin_id from public.profiles where active and role='ADMIN' limit 1;
 select id into strict outsider from public.profiles where active and role='TRANSPORTER' limit 1;
 select id into support_id from public.profiles where active and role='SUPPORT' limit 1;
 command:='{"name":"Transport SQL test","phone":"+251900000001","origin":"Adama","destination":"Bishoftu"}';
 select count(*) into count_before from public.transport_service_requests;
 perform public.create_transport_service_request(request_id,command);
 perform public.create_transport_service_request(request_id,command);
 if (select count(*) from public.transport_service_requests)<>count_before+1 then raise exception 'RETRY_DUPLICATED';end if;
 begin perform public.create_transport_service_request(request_id,command||'{"name":"Other"}');raise exception 'ID_REUSE_ALLOWED';exception when raise_exception then if sqlerrm<>'INVALID_TRANSPORT_REQUEST' then raise;end if;end;
 begin perform public.create_transport_service_request(gen_random_uuid(),command||'{"phone":"123"}');raise exception 'BAD_PHONE_ALLOWED';exception when raise_exception then if sqlerrm<>'INVALID_TRANSPORT_REQUEST' then raise;end if;end;
 begin perform public.create_transport_service_request(gen_random_uuid(),command||'{"origin":null}');raise exception 'EMPTY_ROUTE_ALLOWED';exception when raise_exception then if sqlerrm<>'INVALID_TRANSPORT_REQUEST' then raise;end if;end;
 foreach outsider in array array[outsider,support_id,null::uuid] loop
   begin perform public.transport_service_request_inbox(outsider,'ALL',1);raise exception 'OUTSIDER_READ';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
   begin perform public.update_transport_service_request(outsider,request_id,1,'CLOSED','');raise exception 'OUTSIDER_WRITE';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
 end loop;
 perform public.update_transport_service_request(admin_id,request_id,1,'CONTACTED','Called and referred offline');
 begin perform public.update_transport_service_request(admin_id,request_id,1,'CLOSED','Stale');raise exception 'STALE_OVERWRITE';exception when raise_exception then if sqlerrm<>'TRANSPORT_REQUEST_CHANGED' then raise;end if;end;
 perform public.update_transport_service_request(admin_id,request_id,2,'CLOSED','Called and referred offline');
 perform public.update_transport_service_request(admin_id,request_id,3,'NEW','Caller asked to reopen');
 select * into strict request_row from public.transport_service_requests where id=request_id;
 if request_row.version<>4 or request_row.origin<>'Adama' or request_row.requester_name<>'Transport SQL test' then raise exception 'HISTORY_LOST';end if;
 if exists(select 1 from audit_logs where entity_id=request_id and (details::text like '%251900%' or details::text like '%Called%' or details::text like '%Transport SQL%')) then raise exception 'AUDIT_CONTACT_LEAK';end if;
 update public.profiles set active=false where id=admin_id;
 begin perform public.transport_service_request_inbox(admin_id,'ALL',1);raise exception 'INACTIVE_ADMIN_READ';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
 begin perform public.update_transport_service_request(admin_id,request_id,4,'CLOSED','');raise exception 'INACTIVE_ADMIN_WRITE';exception when raise_exception then if sqlerrm<>'FORBIDDEN' then raise;end if;end;
 update public.profiles set active=true where id=admin_id;
 for n in 1..17 loop perform public.create_transport_service_request(gen_random_uuid(),command);end loop;
 result:=public.transport_service_request_inbox(admin_id,'ALL',1);
 if jsonb_array_length(result->'items')<>15 or (result->>'total')::bigint<>count_before+18 then raise exception 'PAGING_INCORRECT';end if;
 result:=public.transport_service_request_inbox(admin_id,'ALL',2147483647);
 if (result->>'page')::integer<>(result->>'pageCount')::integer then raise exception 'PAGE_CLAMP_FAILED';end if;
 if not (select relrowsecurity from pg_class where oid='public.transport_service_requests'::regclass) then raise exception 'RLS_MISSING';end if;
 if has_table_privilege('anon','public.transport_service_requests','SELECT') or has_table_privilege('authenticated','public.transport_service_requests','INSERT,UPDATE,DELETE')
 or has_function_privilege('anon','public.create_transport_service_request(uuid,jsonb)','EXECUTE')
 or has_function_privilege('authenticated','public.transport_service_request_inbox(uuid,text,integer)','EXECUTE')
 or has_function_privilege('authenticated','public.update_transport_service_request(uuid,uuid,integer,text,text)','EXECUTE') then raise exception 'BROWSER_BYPASS';end if;
 raise notice 'PASS: private transport requests, validation, retry, role denial, inactive admin, stale edits, retention, paging and ACL/RLS';
end $test$;
set local role anon;
do $$begin
 begin perform * from public.transport_service_requests;raise exception 'ANON_READ';exception when insufficient_privilege then null;end;
 begin perform public.create_transport_service_request(gen_random_uuid(),'{}');raise exception 'ANON_RPC';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role authenticated;
do $$begin
 begin perform * from public.transport_service_requests;raise exception 'BROWSER_READ';exception when insufficient_privilege then null;end;
 begin perform public.transport_service_request_inbox(null,'ALL',1);raise exception 'BROWSER_RPC';exception when insufficient_privilege then null;end;
end $$;
rollback;
