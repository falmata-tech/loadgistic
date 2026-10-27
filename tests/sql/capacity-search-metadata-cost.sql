begin;
do $test$
declare row_data jsonb;projected jsonb;full_meta jsonb;lean_meta jsonb;term text;name text;
 employee_id uuid;employee_term text:='ZqxemployeeMetadata'||replace(gen_random_uuid()::text,'-','');
begin
 select c.payload,public.capacity_active_driver_id((c.payload->>'vehicle_id')::uuid)
 into strict projected,employee_id
 from public.capacity_search_public_rows('{}',null,null,14) c
 cross join lateral public.provider_capacity_actor_scope(
  public.capacity_active_driver_id((c.payload->>'vehicle_id')::uuid)) scope
 where scope.is_company_driver limit 1;
 update public.profiles set first_name=employee_term where id=employee_id;
 -- The matcher consumes database candidate keys, not the public projection.
 select to_jsonb(c)||jsonb_build_object('vehicle_id',c.vehicle_id,
  'provider_handle',projected->>'provider_handle') into strict row_data
 from capacities c where c.id=(projected->>'id')::uuid;
 full_meta:=capacity_search_metadata(row_data);
 lean_meta:=capacity_search_metadata(row_data||'{"_search_documents_required":false}');
 if (full_meta-'owner_documents'-'driver_documents'-'truck_documents') is distinct from
 (lean_meta-'owner_documents'-'driver_documents'-'truck_documents') then raise exception 'PUBLIC_PROFILE_FACTS_CHANGED';end if;
 if lean_meta->'owner_documents'<>'[]'::jsonb or lean_meta->'driver_documents'<>'[]'::jsonb or lean_meta->'truck_documents'<>'[]'::jsonb then raise exception 'UNREQUESTED_DOCUMENT_WORK_RETAINED';end if;
 --209 indexes the provider account, while preserving the assigned employee's
 -- permitted vehicle details. A driver name is not an independent q match.
 foreach term in array array[full_meta->>'account_name',projected->>'provider_handle',full_meta->>'manager_name'] loop
  if nullif(term,'') is null or not capacity_search_matches(row_data,jsonb_build_object('q',term))
   then raise exception 'PUBLISHED_ACCOUNT_TEXT_MATCH_LOST';end if;
 end loop;
 if full_meta->>'driver_name' is distinct from employee_term
  or capacity_search_matches(row_data,jsonb_build_object('q',employee_term))
  or capacity_search_matches(row_data,jsonb_build_object('q',employee_term,'_profile_search_internal','177'))
  then raise exception 'EMPLOYEE_NAME_BECAME_ACCOUNT_SEARCH';end if;
 if not exists(select 1 from public_capacity_page(jsonb_build_object('capacity_id',projected->>'id'),null,null,14) c
  where c.payload->>'vehicle_id'=projected->>'vehicle_id'
   and c.payload->>'assigned_driver_first_name'=employee_term)
  then raise exception 'AUTHORIZED_DRIVER_DETAILS_LOST';end if;
 term:=projected->>'provider_handle';
 foreach name in array array['owner','driver','truck'] loop
  if capacity_search_matches(row_data||'{"_search_documents_required":false}',jsonb_build_object('q',term,name||'_docs','NONEXISTENT_DOCUMENT')) then raise exception 'REQUESTED_DOCUMENT_FILTER_BYPASSED';end if;
 end loop;
 if capacity_search_metadata(row_data) is distinct from full_meta then raise exception 'DEFAULT_PROFILE_DOCUMENTS_CHANGED';end if;
 if has_function_privilege('anon','public.capacity_search_metadata(jsonb)','EXECUTE')
 or has_function_privilege('authenticated','public.capacity_search_matches(jsonb,jsonb)','EXECUTE') then raise exception 'SEARCH_AUTHORITY_BROADENED';end if;
end $test$;
rollback;
