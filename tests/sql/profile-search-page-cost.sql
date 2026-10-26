-- FEAT-MKT-001 / FEAT-LST-001 / NR-13. Exact public-result parity while the
-- internal profile path skips map-card decoration. Rollback keeps fixtures intact.
begin;
-- Use the accepted account/offer semantics for the reference too. The177
-- snapshots predate209 account-only discovery and211/213 offer matching.
do $references$
declare definition text;anchor text;start_at integer;end_at integer;
begin
 if (select md5(prosrc) from pg_proc where oid='public.capacity_search_results_public_fast(jsonb,integer)'::regprocedure)<>'ae6155282f29ad40f599798657b4477a'
  or (select md5(prosrc) from pg_proc where oid='public.capacity_search_matches(jsonb,jsonb)'::regprocedure)<>'7a4ca944e31f1989d522e11d4f1d8f52'
  or (select md5(prosrc) from pg_proc where oid='public.capacity_search_public_rows(jsonb,timestamptz,uuid,integer)'::regprocedure)<>'0e1c6af41131e3bede8c38e99fcf9f35'
  or (select md5(prosrc) from pg_proc where oid='public.capacity_search_public_profile_rows(jsonb,timestamptz,uuid,integer)'::regprocedure)<>'ecbffcec23895388f73ad3955c3408fc'
  then raise exception 'CURRENT_ACCOUNT_REFERENCE_SOURCE_DRIFT';end if;
 definition:=pg_get_functiondef('public.capacity_search_results_public_fast(jsonb,integer)'::regprocedure);
 anchor:='public.capacity_search_public_profile_rows(';
 if (length(definition)-length(replace(definition,anchor,'')))/length(anchor)<>1
  then raise exception 'CURRENT_ACCOUNT_REFERENCE_PRODUCER_DRIFT';end if;
 definition:=replace(definition,'FUNCTION public.capacity_search_results_public_fast(',
  'FUNCTION pg_temp.search177_full_results(');
 execute replace(definition,anchor,'public.capacity_search_public_rows(');
 definition:=pg_get_functiondef('public.capacity_search_matches(jsonb,jsonb)'::regprocedure);
 start_at:=strpos(definition,'if query->>''_profile_search_internal''=''177''');
 end_at:=strpos(definition,'meta:=public.capacity_search_metadata');
 if start_at=0 or end_at<=start_at then raise exception 'CURRENT_ACCOUNT_REFERENCE_SHORTCUT_DRIFT';end if;
 definition:=left(definition,start_at-1)||substring(definition from end_at);
 execute replace(definition,'FUNCTION public.capacity_search_matches(',
  'FUNCTION pg_temp.search177_full_matches(');
end $references$;
create temporary table search177_employee on commit drop as
 select (c.payload->>'vehicle_id')::uuid as vehicle_id,
  public.capacity_active_driver_id((c.payload->>'vehicle_id')::uuid) as employee_id,
  'Zqxemployee177'||replace(gen_random_uuid()::text,'-','') as term
 from public.capacity_search_public_rows('{}',null,null,14) c
 cross join lateral public.provider_capacity_actor_scope(
  public.capacity_active_driver_id((c.payload->>'vehicle_id')::uuid)) scope
 where scope.is_company_driver limit 1;
do $employee_fixture$
begin
 if (select count(*) from search177_employee)<>1 then raise exception 'ACCOUNT_SEARCH_EMPLOYEE_FIXTURE_MISSING';end if;
 update public.profiles p set first_name=f.term from search177_employee f where p.id=f.employee_id;
end $employee_fixture$;
-- A published pair already exists in both the CI seed and the restored hosted
-- snapshot. Add only synthetic reviewed facts to it inside this transaction;
-- the test must not depend on pre-existing document-review coverage.
do $document_fixture$
declare item jsonb;driver_id uuid;owner_type public.verification_subject_type;
 owner_id uuid;ownership_request_id uuid;
begin
 select payload into strict item from public.capacity_search_public_rows('{}'::jsonb,null,null,14) limit 1;
 driver_id:=public.capacity_active_driver_id((item->>'vehicle_id')::uuid);
 if driver_id is null then raise exception 'PROFILE_SEARCH_DRIVER_FIXTURE_MISSING';end if;
 owner_type:=case when item->>'provider_organization_id' is not null
  then 'ORGANIZATION'::public.verification_subject_type
  else 'PROVIDER_PROFILE'::public.verification_subject_type end;
 owner_id:=coalesce((item->>'provider_organization_id')::uuid,(item->>'provider_profile_id')::uuid);
 insert into public.verification_requests(subject_type,subject_id,verification_type,
  document_name,storage_path,original_name,mime_type,status,submitted_by,reviewed_at)
 values(owner_type,owner_id,'IDENTITY','Rollback-only owner document',
  'synthetic/search-177-owner','synthetic.jpg','image/jpeg','APPROVED',driver_id,now()),
  ('DRIVER',driver_id,'DRIVER_IDENTITY','Rollback-only Driver document',
  'synthetic/search-177-driver','synthetic.jpg','image/jpeg','APPROVED',driver_id,now());
 insert into public.verification_requests(subject_type,subject_id,verification_type,
  document_name,storage_path,original_name,mime_type,status,submitted_by,reviewed_at)
 values('VEHICLE',(item->>'vehicle_id')::uuid,'VEHICLE_OWNERSHIP',
  'Rollback-only vehicle document','synthetic/search-177-vehicle','synthetic.jpg',
  'image/jpeg','APPROVED',driver_id,now()) returning id into ownership_request_id;
 insert into public.provider_vehicle_authority_reviews(source_request_id,vehicle_id,
  vehicle_identity_digest,organization_id,provider_profile_id,fact_kind,reviewed_by,review_note)
 values(ownership_request_id,(item->>'vehicle_id')::uuid,
  (select public.provider_vehicle_authority_identity(vehicle) from public.vehicles vehicle
   where vehicle.id=(item->>'vehicle_id')::uuid),
  (item->>'provider_organization_id')::uuid,(item->>'provider_profile_id')::uuid,
  'OWNERSHIP',driver_id,'Rollback-only search document parity fixture');
end $document_fixture$;
create temporary table search177_fixture on commit drop as
 select payload,public.capacity_search_metadata(payload) as meta
 from public.capacity_search_public_rows('{}'::jsonb,null,null,14);
create temporary table search177_internal_fixture on commit drop as
 select payload,public.capacity_search_metadata(payload) as meta
 from public.capacity_search_public_profile_rows('{"_profile_search_internal":"177"}'::jsonb,null,null,14);
create temporary table search177_query_rows(payload jsonb,helper_item jsonb) on commit drop;
do $test$
declare row_data jsonb;internal_row jsonb;meta jsonb;query jsonb;helper_query jsonb;old_result jsonb;new_result jsonb;
 provider_handle text;account_name text;manager_name text;about_word text;doc_kind text;doc_value text;
 sampled record; old_ids text[];new_ids text[];
begin
 select payload,search177_fixture.meta into strict row_data,meta from search177_fixture limit 1;
 provider_handle:=row_data->>'provider_handle';
 account_name:=meta->>'account_name';manager_name:=meta->>'manager_name';
 about_word:=split_part(coalesce(meta->>'about',''), ' ', 1);
 foreach query in array array[jsonb_build_object('q',account_name),jsonb_build_object('q',provider_handle),jsonb_build_object('q',manager_name)] loop
  if nullif(query->>'q','') is null or not public.capacity_search_matches(row_data,query)
   or not exists(select 1 from jsonb_array_elements(public.capacity_search_results(query)->'items') r
    where r->>'handle'=provider_handle and r->>'account_name'=account_name and r->>'manager_name'=manager_name
     and (r->>'matching_trucks')::integer>0 and r->>'kind'<>'COMPANY_DRIVER')
   then raise exception 'PUBLISHED_ACCOUNT_IDENTITY_SEARCH_LOST';end if;
 end loop;
 for sampled in select * from search177_employee loop
  query:=jsonb_build_object('q',sampled.term);
  if (public.capacity_search_results(query)->>'total')::integer<>0
   or exists(select 1 from public.capacity_search_public_rows(query,null,null,14))
   then raise exception 'EMPLOYEE_NAME_BECAME_ACCOUNT_SEARCH';end if;
  if not exists(select 1 from public.capacity_search_public_rows('{}',null,null,14) c
   where c.payload->>'vehicle_id'=sampled.vehicle_id::text
    and c.payload->>'assigned_driver_first_name'=sampled.term)
   then raise exception 'AUTHORIZED_DRIVER_DETAILS_LOST';end if;
 end loop;
 foreach query in array array[
  '{}'::jsonb,
  jsonb_build_object('q',provider_handle),
  jsonb_build_object('q',account_name),jsonb_build_object('q',manager_name),
  jsonb_build_object('q',coalesce(nullif(about_word,''),provider_handle)),
  jsonb_build_object('q','zzzz-no-matching-profile-177'),
  jsonb_build_object('blocked_handles',jsonb_build_array(provider_handle)),
  '{"location_source":"MOBILE"}'::jsonb
 ] loop
  old_result:=pg_temp.search177_full_results(query,1);
  new_result:=public.capacity_search_results(query,'PUBLIC',null,null,1);
  if old_result is distinct from new_result then
   raise exception 'PROFILE_SEARCH_RESULT_DRIFT: %',query;
  end if;
 end loop;
 -- The private producer must retain the ordinary public producer's exact
 -- authorized capacity set under combined and selective filters.
 foreach query in array array[
  '{}'::jsonb,
  jsonb_build_object('q',provider_handle),
  jsonb_build_object('q',account_name),jsonb_build_object('q',manager_name),
  jsonb_build_object('q',coalesce(nullif(about_word,''),provider_handle)),
  jsonb_build_object('blocked_handles',jsonb_build_array(provider_handle)),
  '{"status":"EMPTY"}'::jsonb,
  '{"location_source":"MOBILE"}'::jsonb,
  jsonb_build_object('vehicle_category',row_data->>'cargo_configuration'),
  jsonb_build_object('origin_lat',row_data->>'current_origin_lat',
   'origin_lng',row_data->>'current_origin_lng','origin_radius_km',20)
 ] loop
  select array_agg(payload->>'id' order by payload->>'id') into old_ids
   from public.capacity_search_public_rows(query,null,null,14);
  select array_agg(payload->>'id' order by payload->>'id') into new_ids
   from public.capacity_search_public_profile_rows(query||'{"_profile_search_internal":"177"}'::jsonb,null,null,14);
  if old_ids is distinct from new_ids then
   raise exception 'PROFILE_SEARCH_AUTHORIZED_SET_DRIFT: %',query;end if;
 end loop;
 -- Deduplicate exact provider/query calls, preserving every sampled pair.
 -- Compare only rows produced after the current query's real prevalidation.
 for query in
  select distinct term.value||jsonb_build_object('_profile_search_internal','177',
   'provider',f.payload->>'provider_handle')
  from search177_internal_fixture f cross join lateral(values
   (jsonb_build_object('q',coalesce(f.meta->>'account_name',''))),
   (jsonb_build_object('q',coalesce(f.meta->>'manager_name',''))),
   (jsonb_build_object('q',f.payload->>'provider_handle')),
   (jsonb_build_object('q',split_part(coalesce(f.meta->>'about',''),' ',1))),
   (jsonb_build_object('q','zzzz-no-matching-profile-177')),
   (jsonb_build_object('q',coalesce(f.meta->>'manager_name',''),'blocked_handles',
    jsonb_build_array(f.payload->>'provider_handle')))
  ) term(value)
 loop
  truncate pg_temp.search177_query_rows;
  insert into pg_temp.search177_query_rows(payload,helper_item)
  select r.payload,jsonb_build_object('location_source',c.location_source,
   'provider_handle',r.payload->>'provider_handle','provider_organization_id',c.provider_organization_id,
   'provider_profile_id',c.provider_profile_id,'vehicle_id',c.vehicle_id)
  from public.capacity_search_public_profile_rows(query,null,null,14) r
  join public.capacities c on c.id=(r.payload->>'id')::uuid;
  select array_agg(r.payload->>'id' order by r.payload->>'id') into new_ids
   from pg_temp.search177_query_rows r;
  if query->>'q'='zzzz-no-matching-profile-177' or query ? 'blocked_handles' then
   if new_ids is not null then raise exception 'PROFILE_SEARCH_DENIED_CALLER_ROWS';end if;
  else
   select array_agg(f.payload->>'id' order by f.payload->>'id') into old_ids
    from search177_internal_fixture f where f.payload->>'provider_handle'=query->>'provider';
   if new_ids is distinct from old_ids then raise exception 'PROFILE_SEARCH_CALLER_PAIR_COVERAGE_DRIFT';end if;
  end if;
  for sampled in select helper_item from pg_temp.search177_query_rows loop
   if public.capacity_search_matches(sampled.helper_item,query) is distinct from
    pg_temp.search177_full_matches(sampled.helper_item,query)
    then raise exception 'PROFILE_SEARCH_MATCHER_DRIFT: %',query;end if;
  end loop;
 end loop;
 foreach doc_kind in array array['owner','driver','truck'] loop
  select payload,search177_fixture.meta into row_data,meta from search177_fixture
   where jsonb_array_length(search177_fixture.meta->(doc_kind||'_documents'))>0 limit 1;
  if not found then raise exception 'PROFILE_SEARCH_DOCUMENT_FIXTURE_MISSING: %',doc_kind;end if;
  doc_value:=meta->(doc_kind||'_documents')->>0;
  query:=jsonb_build_object('q',row_data->>'provider_handle',doc_kind||'_docs',doc_value);
  old_result:=pg_temp.search177_full_results(query,1);
  new_result:=public.capacity_search_results(query,'PUBLIC',null,null,1);
  if old_result is distinct from new_result or (new_result->>'total')::integer<1
   then raise exception 'PROFILE_SEARCH_DOCUMENT_RESULT_DRIFT: %',doc_kind;end if;
  query:=query||'{"_profile_search_internal":"177"}'::jsonb;
  helper_query:=query||jsonb_build_object('provider',row_data->>'provider_handle');
  select jsonb_build_object('location_source',c.location_source,
   'provider_handle',r.payload->>'provider_handle','provider_organization_id',c.provider_organization_id,
   'provider_profile_id',c.provider_profile_id,'vehicle_id',c.vehicle_id) into strict internal_row
  from public.capacity_search_public_profile_rows(helper_query,null,null,14) r
  join public.capacities c on c.id=(r.payload->>'id')::uuid
  where r.payload->>'id'=row_data->>'id';
  if public.capacity_search_matches(internal_row,helper_query) is distinct from
   pg_temp.search177_full_matches(internal_row,helper_query)
   then raise exception 'PROFILE_SEARCH_DOCUMENT_MATCHER_DRIFT: %',doc_kind;end if;
  select array_agg(payload->>'id' order by payload->>'id') into old_ids
   from public.capacity_search_public_rows(query - '_profile_search_internal',null,null,14);
  select array_agg(payload->>'id' order by payload->>'id') into new_ids
   from public.capacity_search_public_profile_rows(query,null,null,14);
  if old_ids is distinct from new_ids then
   raise exception 'PROFILE_SEARCH_DOCUMENT_SET_DRIFT: %',doc_kind;end if;
 end loop;
 old_result:=pg_temp.search177_full_results('{}',2);
 new_result:=public.capacity_search_results('{}','PUBLIC',null,null,2);
 if old_result is distinct from new_result then raise exception 'PROFILE_SEARCH_SECOND_PAGE_DRIFT';end if;
 -- The normal map projection must retain all rich keys and identical rows.
 if (select jsonb_agg(payload order by payload->>'id') from public.capacity_search_public_rows('{}'))
  is distinct from
  (select jsonb_agg(payload order by payload->>'id') from public.capacity_search_public_rows_pre_perf177('{}'))
  then raise exception 'PROFILE_SEARCH_MAP_PROJECTION_DRIFT';end if;
 -- An unknown private recipient stays denied; the old private query remains the
 -- implementation for EMAIL and does not acquire the public fast path.
 if public.capacity_search_results('{}','EMAIL',repeat('e',64)) is distinct from
  public.capacity_search_results_pre_perf177('{}','EMAIL',repeat('e',64))
  then raise exception 'PROFILE_SEARCH_PRIVATE_DRIFT';end if;
 if has_function_privilege('anon','public.capacity_search_results_public_fast(jsonb,integer)','EXECUTE')
  or has_function_privilege('authenticated','public.capacity_search_results_public_fast(jsonb,integer)','EXECUTE')
  or has_function_privilege('anon','public.capacity_search_public_profile_rows(jsonb,timestamptz,uuid,integer)','EXECUTE')
  or has_function_privilege('authenticated','public.capacity_search_public_profile_rows(jsonb,timestamptz,uuid,integer)','EXECUTE')
  or has_function_privilege('anon','public.capacity_search_matches_pre_perf177(jsonb,jsonb)','EXECUTE')
  or has_function_privilege('anon','public.capacity_search_public_rows_pre_perf177(jsonb,timestamptz,uuid,integer)','EXECUTE')
  then raise exception 'PROFILE_SEARCH_BROWSER_RPC_EXPOSED';end if;
end $test$;
rollback;
