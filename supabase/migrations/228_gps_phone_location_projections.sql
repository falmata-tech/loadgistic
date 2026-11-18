-- FEAT-GPS/CAP/MKT-001. GPS/Phone product projections; retained Manual history is not a third source.
-- No data rewrite, consent, assignment, Tracking, source revision or publication change.
begin;
select pg_advisory_xact_lock(8030228);
set local lock_timeout='5s';
set local statement_timeout='30s';

create temporary table location228_metadata on commit drop as
select oid,proowner,prosecdef,provolatile,proconfig,proacl from pg_proc where oid=any(array[
 'public.capacity_filter_values(text,text)'::regprocedure,
 'public.capacity_published_source_matches(jsonb,jsonb)'::regprocedure,
 'public.capacity_location_editor(uuid,uuid)'::regprocedure,
 'public.telematics_workspace_pre_phone157(uuid,integer)'::regprocedure,
 'public.provider_capacity_workspace(uuid)'::regprocedure,
 'public.account_capacity_rows(uuid,text,timestamptz,uuid,integer,jsonb)'::regprocedure,
 'public.business_capacity_rows(uuid,uuid,timestamptz,uuid,integer,jsonb)'::regprocedure,
 'public.capacity_search_public_rows(jsonb,timestamptz,uuid,integer)'::regprocedure,
 'public.public_capacity_page(jsonb,timestamptz,uuid,integer)'::regprocedure,
 'public.public_capacity_clusters(jsonb,timestamptz,uuid,integer)'::regprocedure]);

do $projection228$
declare entry record;patch record;definition text;
begin
 for entry in select * from (values
  ('capacity_filter_values','public.capacity_filter_values(text,text)','83ca32e2e15e611099bbccd106843451','d401e5fee01849e8e29d12f198258dfe'),
  ('capacity_published_source_matches','public.capacity_published_source_matches(jsonb,jsonb)','d381d55a10814355517b351bbd01b9a7','875b821d5ee961a023f86448faca0d06'),
  ('capacity_location_editor','public.capacity_location_editor(uuid,uuid)','1d701d7238169768034d562c8eccdd3d','8994c12ffc1c0634acf6731bca0decbe'),
  ('telematics_workspace_pre_phone157','public.telematics_workspace_pre_phone157(uuid,integer)','5ea2c3a9d1ad4e944bd71d59018bdcf6','1d9a568229082f8ebccd51719cad751d'),
  ('provider_capacity_workspace','public.provider_capacity_workspace(uuid)','b77116ef9b036acda78f83532c37d433','0dca25695b6e12eeab460876ae54e013'),
  ('account_capacity_rows','public.account_capacity_rows(uuid,text,timestamptz,uuid,integer,jsonb)','194b3045ccaa754c5b9920e88b61695f','123f66a9cdc648004ecd442c3dd23c63'),
  ('business_capacity_rows','public.business_capacity_rows(uuid,uuid,timestamptz,uuid,integer,jsonb)','ba0e7d23f1f676bae06ddde98148987a','b5069a3f0961f0aa3752148886e168d5'),
  ('capacity_search_public_rows','public.capacity_search_public_rows(jsonb,timestamptz,uuid,integer)','11f75def78dd8e922112be96f17bdc42','d98a54c5d109cd293bc989255cb26332'),
  ('public_capacity_page','public.public_capacity_page(jsonb,timestamptz,uuid,integer)','a99789b1035f98c6c16ba3f8ec632318','064038d08188025dc092afb7a7410de1'),
  ('public_capacity_clusters','public.public_capacity_clusters(jsonb,timestamptz,uuid,integer)','b06879f619bee94b76288f89c2571518','7141512b894b7855d905c13eb967d633')
 ) expected(name,signature,before_md5,after_md5) loop
  if (select md5(prosrc) from pg_proc where oid=entry.signature::regprocedure)<>entry.before_md5 then raise exception 'LOCATION228_SOURCE_DRIFT:%',entry.name;end if;
  definition:=pg_get_functiondef(entry.signature::regprocedure);
  for patch in select * from (values
   ('capacity_filter_values','when ''location_source'' then array[''GPS'',''MOBILE'',''MANUAL'']','when ''location_source'' then array[''GPS'',''MOBILE'']',1),
   ('capacity_published_source_matches','  when ''MANUAL_ADMIN'' then ''MANUAL''
','',1),
   ('capacity_location_editor','''source'',coalesce(selection.source,''MOBILE'')','''source'',case when selection.source=''MANUAL'' then null else coalesce(selection.source,''MOBILE'') end',1),
   ('capacity_location_editor','''manualPoint'',case when selection.source=''MANUAL'' and
   (public.fleet_actor_can_use_vehicle(actor_user_id,vehicle.id,true)
    or selection.selected_at>=coalesce(public.provider_capacity_pair_started_at(vehicle.id),''infinity''::timestamptz)) then
   jsonb_build_object(''latitude'',selection.manual_latitude,''longitude'',selection.manual_longitude) else null end,
  ''canSetManualLocation'',false,','''canChangeLocationSource'',not coalesce(selection.source=''MANUAL'' and selection.selected_by is distinct from actor_user_id and selection.selected_by=public.capacity_active_driver_id(vehicle.id),false),',1),
   ('telematics_workspace_pre_phone157','''source'',coalesce(s.source,''MOBILE'')','''source'',case when s.source=''MANUAL'' then null else coalesce(s.source,''MOBILE'') end',1),
   ('telematics_workspace_pre_phone157','''manualPoint'',case when s.source=''MANUAL'' then jsonb_build_object(''latitude'',s.manual_latitude,''longitude'',s.manual_longitude) else null end,''driverSelectedManual'',case when s.source=''MANUAL''
   and s.selected_by=public.capacity_active_driver_id(v.id) and s.selected_by<>actor_user_id then true else false end','''canChangeLocationSource'',not coalesce(s.source=''MANUAL'' and s.selected_by=public.capacity_active_driver_id(v.id) and s.selected_by is distinct from actor_user_id,false)',1),
   ('telematics_workspace_pre_phone157',' when ''MANUAL_ADMIN'' then ''MANUAL''','',1),
   ('account_capacity_rows','capacity.location_source in(''TELEMATICS'',''DEVICE_OBSCURED'',''MANUAL_ADMIN'')','capacity.location_source in(''TELEMATICS'',''DEVICE_OBSCURED'')',1),
   ('account_capacity_rows','''location_lat'',capacity.location_lat','''location_lat'',case when capacity.location_source in(''TELEMATICS'',''DEVICE_OBSCURED'') then capacity.location_lat end',1),
   ('account_capacity_rows','''location_lng'',capacity.location_lng','''location_lng'',case when capacity.location_source in(''TELEMATICS'',''DEVICE_OBSCURED'') then capacity.location_lng end',1),
   ('account_capacity_rows','''location_area'',capacity.location_area','''location_area'',case when capacity.location_source in(''TELEMATICS'',''DEVICE_OBSCURED'') then capacity.location_area end',1),
   ('business_capacity_rows','capacity.location_source in(''TELEMATICS'',''DEVICE_OBSCURED'',''MANUAL_ADMIN'')','capacity.location_source in(''TELEMATICS'',''DEVICE_OBSCURED'')',1),
   ('business_capacity_rows','''location_lat'',capacity.location_lat','''location_lat'',case when capacity.location_source in(''TELEMATICS'',''DEVICE_OBSCURED'') then capacity.location_lat end',1),
   ('business_capacity_rows','''location_lng'',capacity.location_lng','''location_lng'',case when capacity.location_source in(''TELEMATICS'',''DEVICE_OBSCURED'') then capacity.location_lng end',1),
   ('business_capacity_rows','''location_area'',capacity.location_area','''location_area'',case when capacity.location_source in(''TELEMATICS'',''DEVICE_OBSCURED'') then capacity.location_area end',1),
   ('provider_capacity_workspace','''location_source'',capacity.location_source','''location_source'',case when capacity.location_source in(''TELEMATICS'',''DEVICE_OBSCURED'') then capacity.location_source end',1),
   ('provider_capacity_workspace','''location_lat'',capacity.location_lat','''location_lat'',case when capacity.location_source in(''TELEMATICS'',''DEVICE_OBSCURED'') then capacity.location_lat end',1),
   ('provider_capacity_workspace','''location_lng'',capacity.location_lng','''location_lng'',case when capacity.location_source in(''TELEMATICS'',''DEVICE_OBSCURED'') then capacity.location_lng end',1),
   ('provider_capacity_workspace','''location_area'',capacity.location_area','''location_area'',case when capacity.location_source in(''TELEMATICS'',''DEVICE_OBSCURED'') then capacity.location_area end',1),
   ('provider_capacity_workspace','''location_place_ref'',capacity.location_place_ref','''location_place_ref'',case when capacity.location_source in(''TELEMATICS'',''DEVICE_OBSCURED'') then capacity.location_place_ref end',1),
   ('provider_capacity_workspace','and report.updated_at>=public.provider_capacity_pair_started_at(vehicle.id)','and report.updated_at>=public.provider_capacity_pair_started_at(vehicle.id) and not exists(select 1 from public.telematics_location_sources selected where selected.vehicle_id=vehicle.id and selected.source=''MANUAL'')',1),
   ('capacity_search_public_rows','candidate.location_lat is not null and candidate.location_lng is not null','candidate.location_source in(''TELEMATICS'',''DEVICE_OBSCURED'') and candidate.location_lat is not null and candidate.location_lng is not null',2),
   ('capacity_search_public_rows','''location_lat'',candidate.location_lat,''location_lng'',candidate.location_lng','''location_lat'',case when candidate.location_source in(''TELEMATICS'',''DEVICE_OBSCURED'') then candidate.location_lat end,''location_lng'',case when candidate.location_source in(''TELEMATICS'',''DEVICE_OBSCURED'') then candidate.location_lng end',1),
   ('capacity_search_public_rows','c.location_source in(''TELEMATICS'',''DEVICE_OBSCURED'',''MANUAL_ADMIN'')','c.location_source in(''TELEMATICS'',''DEVICE_OBSCURED'')',1),
   ('capacity_search_public_rows','''location_lat'',case when visibility=''OPEN'' then location_lat end','''location_lat'',case when visibility=''OPEN'' and location_source in(''TELEMATICS'',''DEVICE_OBSCURED'') then location_lat end',1),
   ('capacity_search_public_rows','''location_lng'',case when visibility=''OPEN'' then location_lng end','''location_lng'',case when visibility=''OPEN'' and location_source in(''TELEMATICS'',''DEVICE_OBSCURED'') then location_lng end',1),
   ('capacity_search_public_rows','''location_area'',case when visibility=''OPEN'' then location_area end','''location_area'',case when visibility=''OPEN'' and location_source in(''TELEMATICS'',''DEVICE_OBSCURED'') then location_area end',1),
   ('public_capacity_page','candidate.location_lat is not null and candidate.location_lng is not null','candidate.location_source in(''TELEMATICS'',''DEVICE_OBSCURED'') and candidate.location_lat is not null and candidate.location_lng is not null',2),
   ('public_capacity_page','''location_lat'',candidate.location_lat,''location_lng'',candidate.location_lng','''location_lat'',case when candidate.location_source in(''TELEMATICS'',''DEVICE_OBSCURED'') then candidate.location_lat end,''location_lng'',case when candidate.location_source in(''TELEMATICS'',''DEVICE_OBSCURED'') then candidate.location_lng end',1),
   ('public_capacity_page','c.location_source in(''TELEMATICS'',''DEVICE_OBSCURED'',''MANUAL_ADMIN'')','c.location_source in(''TELEMATICS'',''DEVICE_OBSCURED'')',1),
   ('public_capacity_page','''location_lat'',case when visibility=''OPEN'' then location_lat end','''location_lat'',case when visibility=''OPEN'' and location_source in(''TELEMATICS'',''DEVICE_OBSCURED'') then location_lat end',1),
   ('public_capacity_page','''location_lng'',case when visibility=''OPEN'' then location_lng end','''location_lng'',case when visibility=''OPEN'' and location_source in(''TELEMATICS'',''DEVICE_OBSCURED'') then location_lng end',1),
   ('public_capacity_page','''location_area'',case when visibility=''OPEN'' then location_area end','''location_area'',case when visibility=''OPEN'' and location_source in(''TELEMATICS'',''DEVICE_OBSCURED'') then location_area end',1),
   ('public_capacity_clusters','candidate.location_lat is not null and candidate.location_lng is not null','candidate.location_source in(''TELEMATICS'',''DEVICE_OBSCURED'') and candidate.location_lat is not null and candidate.location_lng is not null',2),
   ('public_capacity_clusters','''location_lat'',candidate.location_lat,''location_lng'',candidate.location_lng','''location_lat'',case when candidate.location_source in(''TELEMATICS'',''DEVICE_OBSCURED'') then candidate.location_lat end,''location_lng'',case when candidate.location_source in(''TELEMATICS'',''DEVICE_OBSCURED'') then candidate.location_lng end',2)
  ) changes(name,old_text,new_text,expected_count) where changes.name=entry.name loop
   if (length(definition)-length(replace(definition,patch.old_text,'')))/length(patch.old_text)<>patch.expected_count then raise exception 'LOCATION228_ANCHOR_DRIFT:%',entry.name;end if;
   definition:=replace(definition,patch.old_text,patch.new_text);
  end loop;
  execute definition;
  if (select md5(prosrc) from pg_proc where oid=entry.signature::regprocedure)<>entry.after_md5 then raise exception 'LOCATION228_RESULT_DRIFT:%',entry.name;end if;
 end loop;
 if (select count(*) from location228_metadata)<>10 or exists(select 1 from location228_metadata saved join pg_proc current on current.oid=saved.oid where current.proowner is distinct from saved.proowner or current.prosecdef is distinct from saved.prosecdef or current.provolatile is distinct from saved.provolatile or current.proconfig is distinct from saved.proconfig or current.proacl is distinct from saved.proacl) then raise exception 'LOCATION228_AUTHORITY_DRIFT';end if;
end $projection228$;
notify pgrst,'reload schema';
commit;
