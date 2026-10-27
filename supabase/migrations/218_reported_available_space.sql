-- FEAT-CAP-001 / FEAT-MAT-001 / FEAT-MKT-001: an optional, attributed
-- estimate of cargo space still free. Historical Partial=50 remains unknown.
begin;
select pg_advisory_xact_lock(8030218);
set local lock_timeout='5s';
set local statement_timeout='30s';
set local search_path=public,extensions,pg_temp;

alter table public.capacities
  add column available_percent_reported_at timestamptz,
  -- Historical actor IDs remain stable if an account is later removed.
  add column available_percent_reported_by uuid,
  add column available_percent_reported_driver_id uuid,
  add constraint capacity_reported_space_pair_check check (
    available_percent_reported_at is null and available_percent_reported_by is null
      and available_percent_reported_driver_id is null
    or available_percent_reported_at is not null and available_percent_reported_by is not null
      and available_percent_reported_driver_id is not null
      and coalesce(market_status,status::text)='PARTIAL' and available_percent between 1 and 99
  );

create function public.capacity_reported_space_invalidate() returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
  if coalesce(new.market_status,new.status::text)<>'PARTIAL'
    or new.status is distinct from old.status
    or new.market_status is distinct from old.market_status
    or new.available_percent is distinct from old.available_percent
    or new.available_percent_reported_at is distinct from old.available_percent_reported_at
    or new.available_percent_reported_by is distinct from old.available_percent_reported_by
    or new.available_percent_reported_driver_id is distinct from old.available_percent_reported_driver_id
  then
    new.available_percent_reported_at:=null;
    new.available_percent_reported_by:=null;
    new.available_percent_reported_driver_id:=null;
  end if;
  return new;
end $$;
create trigger capacity_reported_space_invalidate
before update of status,market_status,available_percent,available_percent_reported_at,
  available_percent_reported_by,available_percent_reported_driver_id
on public.capacities for each row
execute function public.capacity_reported_space_invalidate();

create function public.capacity_reported_assignment_invalidate() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare target_ids uuid[]:='{}';target_vehicle uuid;latest public.capacities%rowtype;
begin
  if tg_op='INSERT' then
    if new.active then target_ids:=array_append(target_ids,new.vehicle_id);end if;
  elsif tg_op='DELETE' then
    if old.active then target_ids:=array_append(target_ids,old.vehicle_id);end if;
  else
    if old.vehicle_id is not distinct from new.vehicle_id
      and old.driver_user_id is not distinct from new.driver_user_id
      and old.active is not distinct from new.active then return null;end if;
    if old.active then target_ids:=array_append(target_ids,old.vehicle_id);end if;
    if new.active then target_ids:=array_append(target_ids,new.vehicle_id);end if;
  end if;
  for target_vehicle in select distinct unnest(target_ids) loop
    -- Serialize an assignment change with the publisher's vehicle lock.
    perform 1 from public.vehicles where id=target_vehicle for update;
    select * into latest from public.capacities where vehicle_id=target_vehicle
      order by updated_at desc,id desc limit 1 for update;
    if latest.id is not null and latest.available_percent_reported_at is not null then
      insert into public.audit_logs(actor_user_id,organization_id,action,entity_type,entity_id,details)
      values(null,latest.provider_organization_id,'CAPACITY_SPACE_REPORT_INVALIDATED','capacity',latest.id,
        jsonb_build_object('reason','DRIVER_ASSIGNMENT_CHANGED',
          'availablePercent',latest.available_percent,
          'reportedAt',latest.available_percent_reported_at,
          'reportedBy',latest.available_percent_reported_by,
          'reportedDriverId',latest.available_percent_reported_driver_id));
      update public.capacities set available_percent_reported_at=null,
        available_percent_reported_by=null,available_percent_reported_driver_id=null
      where id=latest.id;
    end if;
  end loop;
  return null;
end $$;
create trigger capacity_reported_assignment_invalidate
after insert or delete or update of vehicle_id,driver_user_id,active
on public.driver_vehicle_assignments for each row
execute function public.capacity_reported_assignment_invalidate();

create function public.capacity_reported_available_percent(
  capacity_status text, stored_percent integer, reported_at timestamptz,
  reported_driver_id uuid, current_driver_id uuid
) returns integer language sql immutable set search_path=public,pg_temp as $$
  select case when capacity_status='EMPTY' then 100
    when capacity_status='PARTIAL' and reported_at is not null
      and reported_driver_id is not null and reported_driver_id=current_driver_id
      and stored_percent between 1 and 99
      then stored_percent end
$$;

create function public.capacity_min_available_percent(query jsonb)
returns integer language plpgsql immutable set search_path=public,pg_temp as $$
declare value text;
begin
  if not query ? 'min_available_percent' then return null;end if;
  if jsonb_typeof(query->'min_available_percent') not in ('number','string') then
    raise exception 'INVALID_CAPACITY_FILTER';
  end if;
  value:=query->>'min_available_percent';
  if value !~ '^(100|[1-9][0-9]?)$' then raise exception 'INVALID_CAPACITY_FILTER';end if;
  return value::integer;
end $$;

revoke all on function public.capacity_reported_space_invalidate(),
 public.capacity_reported_assignment_invalidate(),
 public.capacity_reported_available_percent(text,integer,timestamptz,uuid,uuid),
 public.capacity_min_available_percent(jsonb)
 from public,anon,authenticated,service_role;

create temporary table capacity218_function_metadata on commit drop as
select oid,md5(prosrc) as source,proowner,prosecdef,provolatile,proconfig,proacl
from pg_proc where oid=any(array[
 'public.publish_provider_capacity_pre_radius163(uuid,jsonb)'::regprocedure,
 'public.provider_capacity_workspace(uuid)'::regprocedure,
 'public.capacity_payload_matches(jsonb,jsonb)'::regprocedure,
 'public.public_capacity_page(jsonb,timestamptz,uuid,integer)'::regprocedure,
 'public.public_capacity_clusters(jsonb,timestamptz,uuid,integer)'::regprocedure,
 'public.capacity_search_public_rows(jsonb,timestamptz,uuid,integer)'::regprocedure,
 'public.capacity_search_public_profile_rows(jsonb,timestamptz,uuid,integer)'::regprocedure,
 'public.account_capacity_rows(uuid,text,timestamptz,uuid,integer,jsonb)'::regprocedure,
 'public.business_capacity_rows(uuid,uuid,timestamptz,uuid,integer,jsonb)'::regprocedure
]);

do $patch$
declare
  signature text; name text; backup_signature text; definition text; backup text;
  old_text text; new_text text; count_found integer; function_oid oid;driver_reference text;
begin
  if (select count(*) from capacity218_function_metadata)<>9 then
    raise exception 'CAPACITY218_FUNCTION_MISSING';
  end if;
  for signature in select value from (values
    ('public.publish_provider_capacity_pre_radius163(uuid,jsonb)'),
    ('public.provider_capacity_workspace(uuid)'),
    ('public.capacity_payload_matches(jsonb,jsonb)'),
    ('public.public_capacity_page(jsonb,timestamptz,uuid,integer)'),
    ('public.public_capacity_clusters(jsonb,timestamptz,uuid,integer)'),
    ('public.capacity_search_public_rows(jsonb,timestamptz,uuid,integer)'),
    ('public.capacity_search_public_profile_rows(jsonb,timestamptz,uuid,integer)'),
    ('public.account_capacity_rows(uuid,text,timestamptz,uuid,integer,jsonb)'),
    ('public.business_capacity_rows(uuid,uuid,timestamptz,uuid,integer,jsonb)')
  ) selected(value) loop
    function_oid:=signature::regprocedure;
    name:=split_part(split_part(signature,'(',1),'.',2);
    backup_signature:='public.'||name||'_pre_space218'||substring(signature from position('(' in signature));
    if to_regprocedure(backup_signature) is not null then
      raise exception 'CAPACITY218_BACKUP_EXISTS: %',name;
    end if;
    definition:=pg_get_functiondef(function_oid);
    old_text:='CREATE OR REPLACE FUNCTION public.'||name||'(';
    if strpos(definition,old_text)<>1 then raise exception 'CAPACITY218_DECLARATION_DRIFT: %',name;end if;
    backup:=replace(definition,old_text,'CREATE OR REPLACE FUNCTION public.'||name||'_pre_space218(');
    execute backup;
    execute format('revoke all on function %s from public,anon,authenticated,service_role',
      backup_signature::regprocedure);
    if exists(select 1 from pg_proc original join pg_proc saved
      on saved.oid=backup_signature::regprocedure
      where original.oid=function_oid and (
        saved.proowner is distinct from original.proowner
        or saved.prosecdef is distinct from original.prosecdef
        or saved.provolatile is distinct from original.provolatile
        or saved.proconfig is distinct from original.proconfig
      )) then raise exception 'CAPACITY218_BACKUP_AUTHORITY_DRIFT: %',name;end if;

    if name='publish_provider_capacity_pre_radius163' then
      old_text:=$old$  photo_reference text:=nullif(trim(command->>'photo_storage_path'),'');
$old$;
      new_text:=$new$  photo_reference text:=nullif(trim(command->>'photo_storage_path'),'');
  prior_space public.capacities%rowtype;
  reported_percent integer;
  reported_stamp timestamptz;
  reported_by uuid;
  reported_driver uuid;
$new$;
      count_found:=(length(definition)-length(replace(definition,old_text,'')))/length(old_text);
      if count_found<>1 then raise exception 'CAPACITY218_PUBLISH_DECLARATION_DRIFT';end if;
      definition:=replace(definition,old_text,new_text);

      old_text:=$old$  update public.capacities set expires_at=timestamp_value
  where vehicle_id=vehicle.id and expires_at>timestamp_value;
$old$;
      new_text:=$new$  -- The vehicle row serializes concurrent reports for this one vehicle.
  perform 1 from public.vehicles where id=vehicle.id for update;
  if command ? 'available_percent' and command->'available_percent'<>'null'::jsonb then
    if status_value<>'PARTIAL' or jsonb_typeof(command->'available_percent')<>'number'
      or command->>'available_percent' !~ '^([1-9]|[1-9][0-9])$'
    then raise exception 'INVALID_AVAILABLE_PERCENT';end if;
    reported_percent:=(command->>'available_percent')::integer;
  end if;
  if status_value='PARTIAL' then
    select * into prior_space from public.capacities
    where vehicle_id=vehicle.id order by updated_at desc,id desc limit 1;
    if reported_percent is not null then
      if prior_space.id is not null and coalesce(prior_space.market_status,prior_space.status::text)='PARTIAL'
        and prior_space.available_percent=reported_percent
        and prior_space.available_percent_reported_at is not null
        and prior_space.available_percent_reported_by is not null
        and prior_space.available_percent_reported_driver_id=assigned_driver
      then
        reported_stamp:=prior_space.available_percent_reported_at;
        reported_by:=prior_space.available_percent_reported_by;
        reported_driver:=assigned_driver;
      else
        reported_stamp:=timestamp_value;
        reported_by:=actor_user_id;
        reported_driver:=assigned_driver;
      end if;
    elsif not command ? 'available_percent' and prior_space.id is not null
      and coalesce(prior_space.market_status,prior_space.status::text)='PARTIAL'
      and prior_space.available_percent_reported_at is not null
      and prior_space.available_percent_reported_by is not null
      and prior_space.available_percent_reported_driver_id=assigned_driver
    then
      reported_percent:=prior_space.available_percent;
      reported_stamp:=prior_space.available_percent_reported_at;
      reported_by:=prior_space.available_percent_reported_by;
      reported_driver:=assigned_driver;
    end if;
  end if;

  update public.capacities set expires_at=timestamp_value
  where vehicle_id=vehicle.id and expires_at>timestamp_value;
$new$;
      count_found:=(length(definition)-length(replace(definition,old_text,'')))/length(old_text);
      if count_found<>1 then raise exception 'CAPACITY218_PUBLISH_WRITE_DRIFT';end if;
      definition:=replace(definition,old_text,new_text);

      old_text:=$old$id,provider_organization_id,provider_profile_id,vehicle_id,status,market_status,available_percent,$old$;
      new_text:=$new$id,provider_organization_id,provider_profile_id,vehicle_id,status,market_status,available_percent,
    available_percent_reported_at,available_percent_reported_by,available_percent_reported_driver_id,$new$;
      count_found:=(length(definition)-length(replace(definition,old_text,'')))/length(old_text);
      if count_found<>1 then raise exception 'CAPACITY218_PUBLISH_COLUMNS_DRIFT';end if;
      definition:=replace(definition,old_text,new_text);

      old_text:=$old$status_value,case status_value when 'EMPTY' then 100 when 'PARTIAL' then 50 else 0 end,$old$;
      new_text:=$new$status_value,case status_value when 'EMPTY' then 100 when 'PARTIAL' then coalesce(reported_percent,50) else 0 end,
    reported_stamp,reported_by,reported_driver,$new$;
      count_found:=(length(definition)-length(replace(definition,old_text,'')))/length(old_text);
      if count_found<>1 then raise exception 'CAPACITY218_PUBLISH_PERCENT_DRIFT';end if;
      definition:=replace(definition,old_text,new_text);

    elsif name='provider_capacity_workspace' then
      old_text:=$old$    'status',coalesce(capacity.market_status,capacity.status::text),
$old$;
      new_text:=$new$    'status',coalesce(capacity.market_status,capacity.status::text),
    'available_percent',public.capacity_reported_available_percent(
      coalesce(capacity.market_status,capacity.status::text),capacity.available_percent,
      capacity.available_percent_reported_at,capacity.available_percent_reported_driver_id,
      public.capacity_active_driver_id(capacity.vehicle_id)),
    'available_percent_reported_at',case when capacity.available_percent_reported_driver_id=
      public.capacity_active_driver_id(capacity.vehicle_id) then capacity.available_percent_reported_at end,
$new$;
      count_found:=(length(definition)-length(replace(definition,old_text,'')))/length(old_text);
      if count_found<>1 then raise exception 'CAPACITY218_WORKSPACE_DRIFT';end if;
      definition:=replace(definition,old_text,new_text);

    elsif name='capacity_payload_matches' then
      old_text:=$old$ if status_values is not null and not coalesce(item->>'status'=any(status_values),false) then return false;end if;
$old$;
      new_text:=$new$ if status_values is not null and not coalesce(item->>'status'=any(status_values),false) then return false;end if;
 if public.capacity_min_available_percent(query) is not null and
   coalesce((item->>'available_percent')::integer,0)<public.capacity_min_available_percent(query)
 then return false;end if;
$new$;
      count_found:=(length(definition)-length(replace(definition,old_text,'')))/length(old_text);
      if count_found<>1 then raise exception 'CAPACITY218_PRIVATE_MATCH_DRIFT';end if;
      definition:=replace(definition,old_text,new_text);

    elsif name in ('public_capacity_page','public_capacity_clusters',
      'capacity_search_public_rows','capacity_search_public_profile_rows') then
      old_text:=case when name='public_capacity_clusters'
        then $old$    upper(nullif(trim(query->>'status'),'')) as capacity_status,
$old$
        else $old$    public.capacity_filter_values(query->>'status','status') as capacity_status,
$old$ end;
      new_text:=old_text||$new$    public.capacity_min_available_percent(query) as min_available_percent,
$new$;
      count_found:=(length(definition)-length(replace(definition,old_text,'')))/length(old_text);
      if count_found<>1 then raise exception 'CAPACITY218_PUBLIC_INPUT_DRIFT: %',name;end if;
      definition:=replace(definition,old_text,new_text);

      old_text:=case when name='public_capacity_clusters'
        then $old$    and (input.capacity_status is null or coalesce(candidate.market_status,candidate.status::text)=input.capacity_status)
$old$
        else $old$    and (input.capacity_status is null or coalesce(candidate.market_status,candidate.status::text)=any(input.capacity_status))
$old$ end;
      new_text:=$new$    and (input.capacity_status is null or coalesce(candidate.market_status,candidate.status::text)=input.capacity_status)
    and (input.min_available_percent is null or candidate.visibility='OPEN'
      and public.capacity_reported_available_percent(
        coalesce(candidate.market_status,candidate.status::text),candidate.available_percent,
        candidate.available_percent_reported_at,candidate.available_percent_reported_driver_id,
        __CURRENT_DRIVER__)>=input.min_available_percent)
$new$;
      if name<>'public_capacity_clusters' then
        new_text:=replace(new_text,
          'coalesce(candidate.market_status,candidate.status::text)=input.capacity_status',
          'coalesce(candidate.market_status,candidate.status::text)=any(input.capacity_status)');
      end if;
      driver_reference:=case name
        when 'public_capacity_page' then 'candidate._map_driver_id179'
        when 'public_capacity_clusters' then 'candidate._cluster_driver_id181'
        when 'capacity_search_public_profile_rows' then 'candidate.active_driver_id'
        else 'public.capacity_active_driver_id(candidate.vehicle_id)' end;
      new_text:=replace(new_text,'__CURRENT_DRIVER__',driver_reference);
      count_found:=(length(definition)-length(replace(definition,old_text,'')))/length(old_text);
      if count_found<>1 then raise exception 'CAPACITY218_PUBLIC_FILTER_DRIFT: %',name;end if;
      definition:=replace(definition,old_text,new_text);

      if name in ('public_capacity_page','capacity_search_public_rows') then
        old_text:=$old$  'updated_at',updated_at,'location_updated_at',case when visibility='OPEN' then location_updated_at end,
$old$;
        new_text:=$new$  'available_percent',case when visibility='OPEN' then public.capacity_reported_available_percent(
    coalesce(market_status,status::text),available_percent,available_percent_reported_at,
    available_percent_reported_driver_id,__CURRENT_DRIVER__) end,
  'available_percent_reported_at',case when visibility='OPEN'
    and available_percent_reported_driver_id=__CURRENT_DRIVER__ then available_percent_reported_at end,
  'updated_at',updated_at,'location_updated_at',case when visibility='OPEN' then location_updated_at end,
$new$;
        new_text:=replace(new_text,'__CURRENT_DRIVER__',case name when 'public_capacity_page'
          then '_map_driver_id179' else 'public.capacity_active_driver_id(vehicle_id)' end);
        count_found:=(length(definition)-length(replace(definition,old_text,'')))/length(old_text);
        if count_found<>1 then raise exception 'CAPACITY218_PUBLIC_OUTPUT_DRIFT';end if;
        definition:=replace(definition,old_text,new_text);
      end if;

    else
      old_text:=$old$    'status',coalesce(capacity.market_status,capacity.status::text),'updated_at',capacity.updated_at,
$old$;
      new_text:=$new$    'status',coalesce(capacity.market_status,capacity.status::text),
    'available_percent',public.capacity_reported_available_percent(
      coalesce(capacity.market_status,capacity.status::text),capacity.available_percent,
      capacity.available_percent_reported_at,capacity.available_percent_reported_driver_id,
      public.capacity_active_driver_id(capacity.vehicle_id)),
    'available_percent_reported_at',case when capacity.available_percent_reported_driver_id=
      public.capacity_active_driver_id(capacity.vehicle_id) then capacity.available_percent_reported_at end,
    'updated_at',capacity.updated_at,
$new$;
      count_found:=(length(definition)-length(replace(definition,old_text,'')))/length(old_text);
      if count_found<>1 then raise exception 'CAPACITY218_PRIVATE_OUTPUT_DRIFT: %',name;end if;
      definition:=replace(definition,old_text,new_text);
    end if;
    execute definition;
    if (select md5(prosrc) from pg_proc where oid=function_oid)
      =(select source from capacity218_function_metadata where oid=function_oid)
    then raise exception 'CAPACITY218_SOURCE_UNCHANGED: %',name;end if;
  end loop;

  if exists(select 1 from capacity218_function_metadata saved
    join pg_proc current on current.oid=saved.oid
    where current.proowner is distinct from saved.proowner
      or current.prosecdef is distinct from saved.prosecdef
      or current.provolatile is distinct from saved.provolatile
      or current.proconfig is distinct from saved.proconfig
      or current.proacl is distinct from saved.proacl
  ) then raise exception 'CAPACITY218_AUTHORITY_DRIFT';end if;
end $patch$;

notify pgrst,'reload schema';
commit;
