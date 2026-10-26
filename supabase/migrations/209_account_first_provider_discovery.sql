-- FEAT-MKT-001: discover the provider account, while retaining every eligible
-- vehicle in Capacity and every existing driver connection/grant.
begin;
select pg_advisory_xact_lock(8030209);
set local lock_timeout='5s';
set local statement_timeout='30s';

do $account_first$
declare
 signature text;
 definition text;
 start_anchor text:=E'\n  union all\n  select ''DRIVER:''';
 end_anchor text:='where meta->>''kind''=''COMPANY'' and nullif(meta->>''driver_name'','''') is not null';
 start_at integer;
 end_at integer;
 old_text text;
 new_text text;
begin
 -- Search is scoped by the installed public/private row producers. Removing
 -- the result branch does not remove a capacity row, a driver, or a grant.
 foreach signature in array array[
  'public.capacity_search_results_public_fast(jsonb,integer)',
  'public.business_capacity_search(uuid,uuid,text,integer)',
  'public.account_capacity_search_results(uuid,text,jsonb,integer)'
 ] loop
  definition:=pg_get_functiondef(signature::regprocedure);
  start_at:=strpos(definition,start_anchor);
  end_at:=strpos(definition,end_anchor);
  if start_at=0 or end_at<=start_at
   or strpos(substring(definition from start_at+1),start_anchor)>0
   or strpos(substring(definition from end_at+1),end_anchor)>0
   or strpos(definition,'with capacity as materialized (')=0
   or strpos(definition,'count(*) as matching_trucks')=0
   then raise exception 'ACCOUNT_SEARCH_SOURCE_DRIFT: %',signature;end if;
  definition:=left(definition,start_at-1)
   ||substring(definition from end_at+length(end_anchor));

  if signature='public.capacity_search_results_public_fast(jsonb,integer)' then
   old_text:='min(sample_id) as sample_id,city,status,owner,driver,';
   new_text:='min(sample_id) as sample_id,min(city) as city,status,owner,driver,';
   if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1
    then raise exception 'PUBLIC_ACCOUNT_CITY_DRIFT';end if;
   definition:=replace(definition,old_text,new_text);
   old_text:='group by key,kind,title,subtitle,description,identifier,handle,city,status,owner,driver,account_name,manager_name';
   new_text:='group by key,kind,title,subtitle,description,identifier,handle,status,owner,driver,account_name,manager_name';
  else
   old_text:='null::text as driver,';
   new_text:='null::text as driver,meta->>''account_name'' as account_name,meta->>''manager_name'' as manager_name,';
   if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1
    then raise exception 'PRIVATE_ACCOUNT_IDENTITY_DRIFT: %',signature;end if;
   definition:=replace(definition,old_text,new_text);
   old_text:='city,status,owner,driver,documents,';
   new_text:='min(city) as city,status,owner,driver,documents,account_name,manager_name,';
   if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1
    then raise exception 'PRIVATE_ACCOUNT_CITY_DRIFT: %',signature;end if;
   definition:=replace(definition,old_text,new_text);
   old_text:='concat_ws('' '',title,identifier)';
   new_text:='concat_ws('' '',title,identifier,account_name,manager_name)';
   if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1
    then raise exception 'PRIVATE_ACCOUNT_SCORE_DRIFT: %',signature;end if;
   definition:=replace(definition,old_text,new_text);
   if signature='public.account_capacity_search_results(uuid,text,jsonb,integer)' then
    old_text:=E'group by key,kind,title,subtitle,description,identifier,handle,city,status,\n   owner,driver,documents';
    new_text:=E'group by key,kind,title,subtitle,description,identifier,handle,status,\n   owner,driver,documents,account_name,manager_name';
   else
    old_text:='group by key,kind,title,subtitle,description,identifier,handle,city,status,owner,driver,documents';
    new_text:='group by key,kind,title,subtitle,description,identifier,handle,status,owner,driver,documents,account_name,manager_name';
   end if;
  end if;
  if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1
   then raise exception 'ACCOUNT_GROUPING_DRIFT: %',signature;end if;
  definition:=replace(definition,old_text,new_text);
  old_text:='concat_ws('' '',subtitle,description,city,owner,driver)';
  new_text:='concat_ws('' '',subtitle,description,min(city),owner,driver)';
  if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1
   then raise exception 'ACCOUNT_CITY_SCORE_DRIFT: %',signature;end if;
  definition:=replace(definition,old_text,new_text);
  execute definition;
 end loop;

 -- The public profile-row producer applies this matcher before grouping.
 -- Employee names are still projected on authorized vehicle details, but are
 -- not an account-search term or a fast-path match.
 definition:=pg_get_functiondef('public.capacity_search_matches(jsonb,jsonb)'::regprocedure);
 old_text:=E'item->>''provider_handle'',\n   item->>''active_driver_name''';
 new_text:='item->>''provider_handle''';
 if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1
  then raise exception 'ACCOUNT_FAST_MATCH_DRIFT';end if;
 definition:=replace(definition,old_text,new_text);
 old_text:='meta->>''manager_name'',meta->>''driver_name''';
 new_text:='meta->>''manager_name''';
 if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1
  then raise exception 'ACCOUNT_TEXT_MATCH_DRIFT';end if;
 definition:=replace(definition,old_text,new_text);
 -- Provider handles include '-' and '_'. Their exact substring is already a
 -- positive text match; avoid a costly per-vehicle profile metadata lookup.
 old_text:='trim(query->>''q'') ~ ''^[[:alnum:]]+$''';
 new_text:='trim(query->>''q'') ~ ''^[[:alnum:]_-]+$''';
 if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1
  then raise exception 'ACCOUNT_HANDLE_FAST_MATCH_DRIFT';end if;
 execute replace(definition,old_text,new_text);

 -- This producer belongs only to account discovery. Active driver ID remains
 -- required for vehicle eligibility, while its personal name is never an
 -- account search field. The public map still uses its own full projection.
 definition:=pg_get_functiondef('public.capacity_search_public_profile_rows(jsonb,timestamptz,uuid,integer)'::regprocedure);
 old_text:=$driver_name$
  ), driver_named as materialized (
   select scoped.*,coalesce(nullif(public.normalize_personal_name(driver_profile.first_name),''),
    nullif(split_part(public.normalize_personal_name(driver_profile.full_name),' ',1),'')) as active_driver_name
   from driver_scoped scoped left join public.profiles driver_profile
    on driver_profile.id=scoped.active_driver_id and driver_profile.active
  ), provider_refs as materialized ($driver_name$;
 new_text:=$account_only$
  ), driver_named as materialized (
   select scoped.*,null::text as active_driver_name from driver_scoped scoped
  ), provider_refs as materialized ($account_only$;
 if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1
  or strpos(definition,'public.capacity_active_driver_id(latest.vehicle_id) as active_driver_id')=0
  then raise exception 'ACCOUNT_PROFILE_DRIVER_LOOKUP_DRIFT';end if;
 execute replace(definition,old_text,new_text);

 -- FIND shows accounts only. Direct driver connections and historical DRIVER
 -- relationship records remain valid and keep their existing permissions.
 definition:=pg_get_functiondef('public.account_directory_page(uuid,text,integer,integer)'::regprocedure);
 old_text:=E'\n  union all select ''DRIVER'',p.id,null::text from profiles p where p.role=''DRIVER''';
 if (length(definition)-length(replace(definition,old_text,'')))/length(old_text)<>1
  or strpos(definition,'public.directory_account_summary(c.kind,c.id)')=0
  then raise exception 'ACCOUNT_DIRECTORY_FIND_DRIFT';end if;
 execute replace(definition,old_text,'');
end $account_first$;

notify pgrst,'reload schema';
commit;
