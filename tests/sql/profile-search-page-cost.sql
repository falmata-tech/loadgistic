-- FEAT-MKT-001 / FEAT-LST-001 / NR-13. Exact public-result parity while the
-- internal profile path skips map-card decoration. Rollback keeps fixtures intact.
begin;
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
do $test$
declare row_data jsonb;internal_row jsonb;meta jsonb;query jsonb;old_result jsonb;new_result jsonb;
 provider_handle text;driver_name text;about_word text;doc_kind text;doc_value text;
 sampled record; old_ids text[];new_ids text[];
begin
 select payload,search177_fixture.meta into strict row_data,meta from search177_fixture limit 1;
 provider_handle:=row_data->>'provider_handle';
 driver_name:=meta->>'driver_name';
 about_word:=split_part(coalesce(meta->>'about',''), ' ', 1);
 foreach query in array array[
  '{}'::jsonb,
  jsonb_build_object('q',provider_handle),
  jsonb_build_object('q',coalesce(nullif(driver_name,''),provider_handle)),
  jsonb_build_object('q',coalesce(nullif(about_word,''),provider_handle)),
  jsonb_build_object('q','zzzz-no-matching-profile-177'),
  jsonb_build_object('blocked_handles',jsonb_build_array(provider_handle)),
  '{"location_source":"MOBILE"}'::jsonb
 ] loop
  old_result:=public.capacity_search_results_pre_perf177(query,'PUBLIC',null,null,1);
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
  jsonb_build_object('q',coalesce(nullif(driver_name,''),provider_handle)),
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
 -- The old result function calls today's matcher too; compare the saved
 -- matcher directly to prove the internal name shortcut cannot add results.
 for sampled in select payload,search177_internal_fixture.meta from search177_internal_fixture loop
  foreach query in array array[
   jsonb_build_object('q',coalesce(sampled.meta->>'driver_name','')),
   jsonb_build_object('q',sampled.payload->>'provider_handle'),
   jsonb_build_object('q',coalesce(sampled.meta->>'about','')),
   jsonb_build_object('q','zzzz-no-matching-profile-177'),
   jsonb_build_object('q',coalesce(sampled.meta->>'driver_name',''),'blocked_handles',
    jsonb_build_array(sampled.payload->>'provider_handle'))
  ] loop
   query:=query||'{"_profile_search_internal":"177"}'::jsonb;
   if public.capacity_search_matches(sampled.payload,query) is distinct from
    public.capacity_search_matches_pre_perf177(sampled.payload,query)
    then raise exception 'PROFILE_SEARCH_MATCHER_DRIFT: %',query;end if;
  end loop;
 end loop;
 foreach doc_kind in array array['owner','driver','truck'] loop
  select payload,search177_fixture.meta into row_data,meta from search177_fixture
   where jsonb_array_length(search177_fixture.meta->(doc_kind||'_documents'))>0 limit 1;
  if not found then raise exception 'PROFILE_SEARCH_DOCUMENT_FIXTURE_MISSING: %',doc_kind;end if;
  doc_value:=meta->(doc_kind||'_documents')->>0;
  query:=jsonb_build_object('q',row_data->>'provider_handle',doc_kind||'_docs',doc_value);
  old_result:=public.capacity_search_results_pre_perf177(query,'PUBLIC',null,null,1);
  new_result:=public.capacity_search_results(query,'PUBLIC',null,null,1);
  if old_result is distinct from new_result or (new_result->>'total')::integer<1
   then raise exception 'PROFILE_SEARCH_DOCUMENT_RESULT_DRIFT: %',doc_kind;end if;
  select payload into strict internal_row from search177_internal_fixture
   where payload->>'id'=row_data->>'id';
  query:=query||'{"_profile_search_internal":"177"}'::jsonb;
  if public.capacity_search_matches(internal_row,query) is distinct from
   public.capacity_search_matches_pre_perf177(internal_row,query)
   then raise exception 'PROFILE_SEARCH_DOCUMENT_MATCHER_DRIFT: %',doc_kind;end if;
  select array_agg(payload->>'id' order by payload->>'id') into old_ids
   from public.capacity_search_public_rows(query - '_profile_search_internal',null,null,14);
  select array_agg(payload->>'id' order by payload->>'id') into new_ids
   from public.capacity_search_public_profile_rows(query,null,null,14);
  if old_ids is distinct from new_ids then
   raise exception 'PROFILE_SEARCH_DOCUMENT_SET_DRIFT: %',doc_kind;end if;
 end loop;
 old_result:=public.capacity_search_results_pre_perf177('{}','PUBLIC',null,null,2);
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
