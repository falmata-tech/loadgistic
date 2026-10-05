begin;
create function pg_temp.assert_search(ok boolean,message text) returns void language plpgsql as $$begin if not coalesce(ok,false) then raise exception '%',message;end if;end $$;
do $test$
declare item jsonb;result jsonb;other jsonb;provider uuid;org uuid;meta jsonb;count_before int;active_driver uuid;signature text;role_name text;
begin
 perform pg_temp.assert_search(capacity_text_score('haullage','Rift Valley Haulage')>0,'TYPO_MATCH');
 perform pg_temp.assert_search(capacity_text_score('Rift Valley','Rift Valley')>capacity_text_score('Rift Valley','A company','Rift Valley'),'EXACT_TITLE_PRIORITY');
 perform pg_temp.assert_search(capacity_text_score('Valley Rift','Rift Valley')>capacity_text_score('Valley Rift','Another company','Rift Valley'),'WORD_ORDER_AND_TITLE_WEIGHT');
 perform pg_temp.assert_search(capacity_text_score('valley zzzznotaword','Rift Valley')=0,'ALL_WORDS_REQUIRED');
 perform pg_temp.assert_search(capacity_text_score('የጭነት','የጭነት መኪና')>0,'ETHIOPIC_SEARCH');
 perform pg_temp.assert_search(capacity_text_score('%%%%','Rift Valley')=0,'WILDCARDS_NOT_MATCH_ALL');
 select payload into strict item from capacity_search_public_rows('{}',null,null,14) where payload->>'provider_organization_id' is not null limit 1;
 org:=(item->>'provider_organization_id')::uuid;
 active_driver:=capacity_active_driver_id((item->>'vehicle_id')::uuid);
 perform pg_temp.assert_search(active_driver is not null,'PAIR_HAS_ACTIVE_DRIVER');
 update profiles set active=false where id=active_driver;
 perform pg_temp.assert_search(not exists(select 1 from capacity_search_public_rows('{}',null,null,14) r where r.payload->>'id'=item->>'id'),'NO_STANDALONE_TRUCK');
 update profiles set active=true where id=active_driver;

 perform pg_temp.assert_search(not capacity_search_matches(item||jsonb_build_object('vehicle_make','Xqztruckonly','vehicle_model','Xqztruckonly','platform_number','Xqztruckonly','cargo_configuration','Xqztruckonly','location_area','Xqztruckonly'),'{"q":"Xqztruckonly"}'),'TRUCK_FACTS_NOT_PROFILE_SEARCH');
 result:=capacity_search_results(jsonb_build_object('q',item->>'provider_handle'));
 perform pg_temp.assert_search((result->>'total')::int>0,'HANDLE_SEARCH');
 perform pg_temp.assert_search(not exists(select 1 from capacity_search_public_rows(jsonb_build_object('q',item->>'provider_handle'),null,null,14) r where r.payload->>'provider_handle'<>item->>'provider_handle'),'COMPANY_SEARCH_MAP_SCOPE');
 perform pg_temp.assert_search((select count(*) from capacity_search_public_rows(jsonb_build_object('q',item->>'provider_handle'),null,null,14))=(select count(*) from capacity_search_public_rows('{}',null,null,14) r where r.payload->>'provider_handle'=item->>'provider_handle'),'COMPANY_SEARCH_ALL_MATCHING_PAIRS');
 update profiles set full_name='Zqxdriverprofile Person' where id=active_driver;
 perform pg_temp.assert_search(exists(select 1 from capacity_search_public_rows('{"q":"Zqxdriverprofile"}',null,null,14)),'DRIVER_SEARCH_MATCH');
 perform pg_temp.assert_search(not exists(select 1 from capacity_search_public_rows('{"q":"Zqxdriverprofile"}',null,null,14) r where capacity_active_driver_id((r.payload->>'vehicle_id')::uuid)<>active_driver),'DRIVER_SEARCH_MAP_SCOPE');

 update company_pages set about='Zebravan special freight service',contact_email='hidden-search-unique@example.invalid',show_contact_email=false where organization_id=org;
 result:=capacity_search_results('{"q":"zebravan"}');
 perform pg_temp.assert_search((result->>'total')::int>0,'PUBLIC_DESCRIPTION_SEARCH');
 perform pg_temp.assert_search(not exists(select 1 from jsonb_array_elements(result->'items') r where r->>'handle'<>item->>'provider_handle'),'DESCRIPTION_SCOPE');
 result:=capacity_search_results('{"q":"hidden-search-unique"}');
 perform pg_temp.assert_search((result->>'total')::int=0,'HIDDEN_CONTACT_NOT_SEARCHABLE');
 update organizations set city='Zqxofficecity' where id=org;
 meta:=capacity_search_metadata(item);
 perform pg_temp.assert_search(capacity_search_matches(item,'{"q":"Zqxofficecity"}'),'OFFICE_CITY_MAIN_SEARCH');
 perform pg_temp.assert_search((capacity_search_results('{"q":"Zqxofficecity"}')->>'total')::int>0,'OFFICE_CITY_PROFILE_RESULTS');
 perform pg_temp.assert_search(not exists(select 1 from capacity_search_public_rows('{"q":"Zqxofficecity"}',null,null,14) r where r.payload->>'provider_handle'<>item->>'provider_handle'),'OFFICE_CITY_ASSOCIATED_MAP_TRUCKS');
 perform pg_temp.assert_search(capacity_search_matches(item,jsonb_build_object('office_city',meta->>'city')),'OFFICE_CITY_MATCH');
 perform pg_temp.assert_search(not capacity_search_matches(item,'{"office_city":"zzzzzunknowncity"}'),'OFFICE_CITY_FILTER');
 perform pg_temp.assert_search(not capacity_search_matches(item,'{"truck_docs":"BUSINESS_LICENSE"}'),'DOCUMENT_SUBJECT_SCOPE');
 update verification_requests set expires_on=(now() at time zone 'Africa/Addis_Ababa')::date-1 where subject_type='ORGANIZATION' and subject_id=org;
 perform pg_temp.assert_search(not capacity_search_matches(item,'{"owner_docs":"BUSINESS_LICENSE"}'),'EXPIRED_DOCUMENT_DENIAL');
 update company_pages set published=false where organization_id=org;
 perform pg_temp.assert_search((capacity_search_results('{"q":"zebravan"}')->>'total')::int=0,'UNPUBLISHED_DESCRIPTION_DENIAL');
 result:=capacity_search_results('{}');other:=capacity_search_results('{}','PUBLIC',null,null,2);
 perform pg_temp.assert_search(jsonb_array_length(result->'items')<=15 and jsonb_array_length(other->'items')<=15,'BOUNDED_RESULTS');
 perform pg_temp.assert_search(not exists(select 1 from jsonb_array_elements(result->'items') a join jsonb_array_elements(other->'items') b on a->>'key'=b->>'key'),'PAGE_NO_DUPLICATES');
 perform pg_temp.assert_search(result=capacity_search_results('{}'),'STABLE_RANKING');
 perform pg_temp.assert_search((capacity_search_results('{}','EMAIL',repeat('e',64))->>'total')::int=0,'UNKNOWN_PRIVATE_RECIPIENT');
 result:=capacity_search_results('{}');
 perform pg_temp.assert_search(not exists(select 1 from jsonb_array_elements(result->'items') r where r->>'kind' not in ('COMPANY','OWNER_OPERATOR','SELF_MANAGED_DRIVER','COMPANY_DRIVER')),'PROFILES_ONLY');
 perform pg_temp.assert_search(result=capacity_search_results('{"result_kind":"TRUCK"}'),'RETIRED_TYPE_IGNORED');
 perform pg_temp.assert_search(not exists(select 1 from jsonb_array_elements(result->'items') r where (r->>'matching_trucks')::int<1),'AVAILABLE_TRUCK_REQUIRED');
 foreach signature in array array['public.capacity_search_metadata(jsonb)','public.capacity_search_matches(jsonb,jsonb)','public.capacity_search_results(jsonb,text,text,uuid,integer)','public.capacity_search_public_rows(jsonb,timestamptz,uuid,integer)','public.capacity_search_private_rows(text,text,uuid,timestamptz,uuid,integer,jsonb)'] loop
  foreach role_name in array array['anon','authenticated'] loop
   perform pg_temp.assert_search(not has_function_privilege(role_name,signature,'EXECUTE'),'BROWSER_RPC_DENIED '||signature);
  end loop;
 end loop;
end $test$;
do $load_matching$
declare shape text; item jsonb; points jsonb; query jsonb; selected_load text;
begin
 foreach shape in array array['ROUTE','RADIUS'] loop
  select payload into strict item from capacity_search_public_rows('{}',null,null,14)
   where payload->>'availability_geometry'=shape
    and ((payload->>'accepts_full_load')::boolean or (payload->>'accepts_partial_load')::boolean)
   limit 1;
  points:=case when shape='ROUTE' then item->'current_route_points' else item->'capacity_area_boundary' end;
  perform pg_temp.assert_search(jsonb_array_length(points)>=2,'LOAD_MATCHING_GEOMETRY_FIXTURE');
  selected_load:=case when (item->>'accepts_full_load')::boolean then 'FTL' else 'PTL' end;
  query:=jsonb_build_object('load_type',selected_load,'origin_lat',points->0->'lat','origin_lng',points->0->'lng',
   'destination_lat',points->1->'lat','destination_lng',points->1->'lng','origin_radius_km',5,'destination_radius_km',5);
  perform pg_temp.assert_search(exists(select 1 from capacity_search_public_rows(query,null,null,14) r where r.payload->>'id'=item->>'id'),'AUTOMATIC_PUBLIC_LOAD_AND_'||shape);
  perform pg_temp.assert_search(capacity_payload_matches(item,query),'PRIVATE_MATCHER_LOAD_AND_'||shape);
 end loop;
 perform pg_temp.assert_search(not exists(select 1 from capacity_search_public_rows('{"load_type":"FTL"}',null,null,14) r where not (r.payload->>'accepts_full_load')::boolean or r.payload->>'status'<>'EMPTY'),'FULL_TRUCK_AVAILABILITY');
 perform pg_temp.assert_search(not exists(select 1 from capacity_search_public_rows('{"load_type":"PTL"}',null,null,14) r where not (r.payload->>'accepts_partial_load')::boolean),'SHARED_LOAD_ACCEPTANCE');
end $load_matching$;

rollback;
