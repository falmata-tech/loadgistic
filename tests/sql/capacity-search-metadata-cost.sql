begin;
do $test$
declare row_data jsonb;full_meta jsonb;lean_meta jsonb;term text;name text;
begin
 select c.payload into strict row_data from public_capacity_page('{}',null,null,14) c limit 1;
 -- The matcher consumes database candidate keys, not the public projection.
 select to_jsonb(c)||jsonb_build_object('vehicle_id',c.vehicle_id) into strict row_data
 from capacities c where c.id=(row_data->>'id')::uuid;
 full_meta:=capacity_search_metadata(row_data);
 lean_meta:=capacity_search_metadata(row_data||'{"_search_documents_required":false}');
 if (full_meta-'owner_documents'-'driver_documents'-'truck_documents') is distinct from
 (lean_meta-'owner_documents'-'driver_documents'-'truck_documents') then raise exception 'PUBLIC_PROFILE_FACTS_CHANGED';end if;
 if lean_meta->'owner_documents'<>'[]'::jsonb or lean_meta->'driver_documents'<>'[]'::jsonb or lean_meta->'truck_documents'<>'[]'::jsonb then raise exception 'UNREQUESTED_DOCUMENT_WORK_RETAINED';end if;
 term:=full_meta->>'driver_name';
 if term is null or not capacity_search_matches(row_data,jsonb_build_object('q',term)) then raise exception 'DRIVER_TEXT_MATCH_LOST';end if;
 foreach name in array array['owner','driver','truck'] loop
  if capacity_search_matches(row_data||'{"_search_documents_required":false}',jsonb_build_object('q',term,name||'_docs','NONEXISTENT_DOCUMENT')) then raise exception 'REQUESTED_DOCUMENT_FILTER_BYPASSED';end if;
 end loop;
 if capacity_search_metadata(row_data) is distinct from full_meta then raise exception 'DEFAULT_PROFILE_DOCUMENTS_CHANGED';end if;
 if has_function_privilege('anon','public.capacity_search_metadata(jsonb)','EXECUTE')
 or has_function_privilege('authenticated','public.capacity_search_matches(jsonb,jsonb)','EXECUTE') then raise exception 'SEARCH_AUTHORITY_BROADENED';end if;
end $test$;
rollback;
