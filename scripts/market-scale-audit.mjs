import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const root=process.cwd();
const config=fs.readFileSync(path.join(root,'supabase','config.toml'),'utf8');
const projectId=config.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1];
if(projectId!=='loadgistic-local')throw new Error('SCALE_LOCAL_PROJECT_REQUIRED');

const requested=Number.parseInt(String(process.env.MARKET_SCALE_TRUCKS||'5000'),10);
if(!Number.isInteger(requested)||requested<5000||requested>10000){
  throw new Error('SCALE_TRUCK_COUNT_OUT_OF_RANGE');
}

const container=`supabase_db_${projectId}`;
const sql=String.raw`
\set ON_ERROR_STOP on
begin;

create temporary table scale_owner on commit drop as
select organization.id as organization_id,organization.handle as provider_handle,
  member.user_id as owner_user_id
from public.organizations organization
join public.organization_members member on member.organization_id=organization.id
  and member.membership_role='OWNER'
join public.profiles owner_profile on owner_profile.id=member.user_id
  and owner_profile.active and owner_profile.role='TRANSPORTER'
join auth.users owner_auth on owner_auth.id=member.user_id and owner_auth.deleted_at is null
join public.company_pages page on page.organization_id=organization.id and page.published
where organization.type='TRANSPORT_COMPANY' and organization.public_visibility='PUBLIC'
  and not organization.content_hidden and not organization.review_workspace
  and public.provider_scope_can_publish(organization.id,null)
  and exists(select 1 from public.current_provider_vehicle_authority() authority
    where authority.organization_id=organization.id
      and(authority.fact_kind='OWNERSHIP' or authority.fact_kind='OPERATING_LICENCE' and authority.holder_basis in('OWNED','FINANCED')))
order by organization.id
limit 1;

do $fixture$
begin
 if(select count(*) from scale_owner)<>1 then raise exception 'SCALE_REVIEWED_LOCAL_OWNER_REQUIRED';end if;
end $fixture$;

insert into public.vehicles(
  id,organization_id,label,category,make,model,cargo_configuration,plate,active,platform_number,publication_status
)
select
  md5('loadgistic-scale-vehicle-'||series)::uuid,owner.organization_id,
  'Scale truck '||series,'Cargo van','Scale','Local','Cargo van',
  'SCALE-'||lpad(series::text,5,'0'),true,'LG-SCALE-'||lpad(series::text,5,'0'),'LIVE'
from generate_series(1,:scale_count) series cross join scale_owner owner;

insert into public.vehicle_capacity_sharing(vehicle_id,mode)
select md5('loadgistic-scale-vehicle-'||series)::uuid,'PUBLIC'
from generate_series(1,:scale_count) series;

-- Publication now requires an active Driver. These no-password identities,
-- memberships, and one-to-one assignments exist only inside this rollback.
insert into auth.users(id,email,raw_user_meta_data)
select md5('loadgistic-scale-driver-'||series)::uuid,
  'scale-driver-'||series||'@example.invalid','{}'::jsonb
from generate_series(1,:scale_count) series;

insert into public.profiles(id,email,full_name,role,active)
select md5('loadgistic-scale-driver-'||series)::uuid,
  'scale-driver-'||series||'@example.invalid','Scaleaudit driver '||series,'DRIVER',true
from generate_series(1,:scale_count) series
on conflict(id) do update set full_name=excluded.full_name,role=excluded.role,active=true;

insert into public.organization_members(user_id,organization_id,membership_role)
select md5('loadgistic-scale-driver-'||series)::uuid,owner.organization_id,'DRIVER'
from generate_series(1,:scale_count) series cross join scale_owner owner;

insert into public.drivers(user_id,organization_id,name,active)
select md5('loadgistic-scale-driver-'||series)::uuid,owner.organization_id,'Scaleaudit driver '||series,true
from generate_series(1,:scale_count) series cross join scale_owner owner;

insert into public.driver_vehicle_assignments(driver_user_id,vehicle_id,assigned_by)
select md5('loadgistic-scale-driver-'||series)::uuid,
  md5('loadgistic-scale-vehicle-'||series)::uuid,owner.owner_user_id
from generate_series(1,:scale_count) series cross join scale_owner owner;

insert into public.capacities(
  id,provider_organization_id,vehicle_id,status,available_percent,visibility,
  location_area,location_updated_at,location_lat,location_lng,location_precision_km,location_source,
  accepts_full_load,accepts_partial_load,updated_by,updated_at,expires_at,market_status,
  availability_geometry,work_radius_km,current_route_origin,current_route_destination,
  current_origin_place_ref,current_origin_lat,current_origin_lng,current_destination_place_ref,
  current_destination_lat,current_destination_lng,current_route_points_json
)
select
  md5('loadgistic-scale-capacity-'||series)::uuid,owner.organization_id,
  md5('loadgistic-scale-vehicle-'||series)::uuid,'EMPTY',100,'OPEN',
  'Around Addis Ababa, Ethiopia',now(),9.03+(series%20)*0.0001,38.74+(series%20)*0.0001,
  5,'DEVICE_OBSCURED',true,false,owner.owner_user_id,
  now()-make_interval(secs=>series%300),now()+interval '1 day','EMPTY',
  'ROUTE',30,'Addis Ababa, Ethiopia','Bishoftu, Ethiopia',
  'builtin:addis ababa',9.03,38.74,'builtin:bishoftu',8.75,38.99,
  '[{"place_ref":"builtin:addis ababa","label":"Addis Ababa, Ethiopia","lat":9.03,"lng":38.74},{"place_ref":"builtin:bishoftu","label":"Bishoftu, Ethiopia","lat":8.75,"lng":38.99}]'::jsonb
from generate_series(1,:scale_count) series cross join scale_owner owner;

analyze public.vehicles;
analyze public.capacities;
analyze public.profiles;
analyze public.drivers;
analyze public.organization_members;
analyze public.driver_vehicle_assignments;

do $audit$
declare
  started_at timestamptz;
  profile_ms numeric;
  map_ms numeric;
  route_ms numeric;
  unscoped_ms numeric; filtered_ms numeric; continuation_ms numeric;
  unscoped_page jsonb; filtered_page jsonb; continuation_page jsonb; measured_page jsonb;
  unscoped_bytes bigint; filtered_bytes bigint; continuation_bytes bigint;
  cursor_stamp timestamptz; cursor_capacity_id uuid; tail_stamp timestamptz; tail_id uuid;
  previous_stamp timestamptz; previous_id uuid; item_stamp timestamptz; item_id uuid; item jsonb;
  expected_fixture_ids uuid[]; actual_fixture_ids uuid[]; fixture_page_counts integer[]:=array[]::integer[];
  page_number integer;
  overview_ms numeric; overview_rows integer; overview_trucks bigint; overview_bytes bigint;
  profile_result jsonb; profile_total integer; profile_rows integer; profile_bytes bigint; profile_match_count integer;
  map_rows integer; map_bytes bigint; map_provider_match boolean; map_fixture_match boolean;
  route_rows integer; route_provider_match boolean; route_fixture_match boolean;
begin
  -- This is the same profile-search RPC used by Transporter search, not the
  -- legacy text predicate on the vehicle map. All synthetic vehicles count
  -- inside one provider account; employees are not separate search results.
  started_at:=clock_timestamp();
  select public.capacity_search_results(jsonb_build_object('q',(select provider_handle from scale_owner)))
    into profile_result;
  profile_ms:=extract(epoch from clock_timestamp()-started_at)*1000;
  profile_total:=(profile_result->>'total')::integer;
  profile_rows:=jsonb_array_length(profile_result->'items');
  profile_bytes:=octet_length(profile_result::text);
  profile_match_count:=(profile_result->'items'->0->>'matching_trucks')::integer;

  -- Show trucks for the selected provider uses the ordinary vehicle page
  -- without a transporter text query. Scope to the fixture provider so
  -- unrelated pilot vehicles cannot satisfy the page-size assertion.
  started_at:=clock_timestamp();
  select count(*),coalesce(sum(octet_length(payload::text)),0),
    bool_and(payload->>'provider_handle'=(select provider_handle from scale_owner)),
    bool_or(payload->>'platform_number' like 'LG-SCALE-%')
    into map_rows,map_bytes,map_provider_match,map_fixture_match
  from public.public_capacity_page(
    jsonb_build_object('provider',(select provider_handle from scale_owner)),null,null,14);
  map_ms:=extract(epoch from clock_timestamp()-started_at)*1000;

  started_at:=clock_timestamp();
  select count(*),bool_and(payload->>'provider_handle'=(select provider_handle from scale_owner)),
    bool_or(payload->>'platform_number' like 'LG-SCALE-%')
    into route_rows,route_provider_match,route_fixture_match
  from public.public_capacity_page(
    '{"origin_lat":9.03,"origin_lng":38.74,"destination_lat":8.75,"destination_lng":38.99,"origin_radius_km":10,"destination_radius_km":10}'::jsonb
      ||jsonb_build_object('provider',(select provider_handle from scale_owner)),
    null,null,14
  );
  route_ms:=extract(epoch from clock_timestamp()-started_at)*1000;

  started_at:=clock_timestamp();
  select count(*),coalesce(sum((payload->>'count')::bigint),0),coalesce(sum(octet_length(payload::text)),0)
    into overview_rows,overview_trucks,overview_bytes
  -- Legacy aggregation is service-only and not an HTTP discovery mode. Its raw
  -- performance fixture retains its legacy identifier predicate.
  from public.public_capacity_clusters('{"q":"lg-scale","viewport":[38,8,40,10]}'::jsonb);
  overview_ms:=extract(epoch from clock_timestamp()-started_at)*1000;
  if overview_rows>200 or overview_trucks<>${requested} or overview_bytes>100000 then raise exception 'SCALE_OVERVIEW_BOUND_FAILED:cells=%,trucks=%,bytes=%',overview_rows,overview_trucks,overview_bytes;end if;
  if overview_ms>5000 then raise exception 'SCALE_OVERVIEW_TOO_SLOW:%',overview_ms;end if;
  raise notice 'LOADGISTIC_OVERVIEW_RESULT cells=% trucks=% bytes=% overview_ms=%',overview_rows,overview_trucks,overview_bytes,round(overview_ms,3);

  -- Ordinary map requests must evaluate all providers. Keep each RPC genuinely
  -- unscoped: no provider, vehicle IDs, capacity ID or synthetic text predicate.
  -- Preserve returned ordinality so these checks cannot sort away an order bug.
  started_at:=clock_timestamp();
  select coalesce(jsonb_agg(payload order by ordinal),'[]'::jsonb) into unscoped_page
  from public.public_capacity_page('{}'::jsonb,null,null,14) with ordinality as page(payload,ordinal);
  unscoped_ms:=extract(epoch from clock_timestamp()-started_at)*1000;
  started_at:=clock_timestamp();
  select coalesce(jsonb_agg(payload order by ordinal),'[]'::jsonb) into filtered_page
  from public.public_capacity_page('{"status":"EMPTY","vehicle_category":"Cargo van"}'::jsonb,null,null,14)
    with ordinality as page(payload,ordinal);
  filtered_ms:=extract(epoch from clock_timestamp()-started_at)*1000;
  if jsonb_array_length(unscoped_page)<>15 or jsonb_array_length(filtered_page)<>15
    then raise exception 'SCALE_UNSCOPED_FIRST_PAGE_INCOMPLETE';end if;
  -- The HTTP adapter consumes fourteen rows; its fifteenth is lookahead.
  -- Continue after row fourteen, so that lookahead must lead the next page.
  cursor_stamp:=(filtered_page->13->>'updated_at')::timestamptz;
  cursor_capacity_id:=(filtered_page->13->>'id')::uuid;
  if cursor_stamp is null or cursor_capacity_id is null then raise exception 'SCALE_UNSCOPED_CURSOR_MISSING';end if;
  started_at:=clock_timestamp();
  select coalesce(jsonb_agg(payload order by ordinal),'[]'::jsonb) into continuation_page
  from public.public_capacity_page('{"status":"EMPTY","vehicle_category":"Cargo van"}'::jsonb,
    cursor_stamp,cursor_capacity_id,14) with ordinality as page(payload,ordinal);
  continuation_ms:=extract(epoch from clock_timestamp()-started_at)*1000;
  if jsonb_array_length(continuation_page)<>15 then raise exception 'SCALE_UNSCOPED_NEXT_PAGE_INCOMPLETE';end if;
  unscoped_bytes:=octet_length(unscoped_page::text);filtered_bytes:=octet_length(filtered_page::text);continuation_bytes:=octet_length(continuation_page::text);
  if unscoped_bytes>1000000 or filtered_bytes>1000000 or continuation_bytes>1000000
    then raise exception 'SCALE_UNSCOPED_PAYLOAD_TOO_LARGE';end if;
  for page_number in 1..3 loop
    measured_page:=case page_number when 1 then unscoped_page when 2 then filtered_page else continuation_page end;
    previous_stamp:=null;previous_id:=null;
    for item in select value from jsonb_array_elements(measured_page) with ordinality as entries(value,ordinal) order by ordinal loop
      item_stamp:=(item->>'updated_at')::timestamptz;item_id:=(item->>'id')::uuid;
      if item_stamp is null or item_id is null or item->>'vehicle_id' is null
        then raise exception 'SCALE_UNSCOPED_IDENTITY_MISSING:page=%',page_number;end if;
      if previous_stamp is not null and ((previous_stamp,previous_id)>(item_stamp,item_id)) is not true
        then raise exception 'SCALE_UNSCOPED_ORDER_CHANGED:page=%',page_number;end if;
      if page_number>1 and (item->>'status' is distinct from 'EMPTY' or item->>'cargo_configuration' is distinct from 'Cargo van')
        then raise exception 'SCALE_UNSCOPED_FILTER_CHANGED:page=%',page_number;end if;
      if page_number=3 and ((item_stamp,item_id)<(cursor_stamp,cursor_capacity_id)) is not true
        then raise exception 'SCALE_UNSCOPED_CURSOR_NOT_ADVANCED';end if;
      previous_stamp:=item_stamp;previous_id:=item_id;
    end loop;
    if (select count(distinct value->>'vehicle_id') from jsonb_array_elements(measured_page))<>15
      or (select count(distinct value->>'id') from jsonb_array_elements(measured_page))<>15
      then raise exception 'SCALE_UNSCOPED_VEHICLE_DUPLICATED:page=%',page_number;end if;
    tail_stamp:=(measured_page->14->>'updated_at')::timestamptz;tail_id:=(measured_page->14->>'id')::uuid;
    -- Pilot rows may legitimately lead or interleave. Compare every known
    -- fixture ID within this actual page interval against direct fixture facts.
    -- Neither the expected values nor this check narrows the timed RPC query.
    select array_agg(capacity.id order by capacity.updated_at desc,capacity.id desc) into expected_fixture_ids
    from generate_series(1,${requested}) series
    join public.capacities capacity on capacity.id=md5('loadgistic-scale-capacity-'||series)::uuid
    where (capacity.updated_at,capacity.id)>=(tail_stamp,tail_id)
      and (page_number<>3 or (capacity.updated_at,capacity.id)<(cursor_stamp,cursor_capacity_id));
    select array_agg((value->>'id')::uuid order by ordinal) into actual_fixture_ids
    from jsonb_array_elements(measured_page) with ordinality as entries(value,ordinal)
    where exists(select 1 from generate_series(1,${requested}) series
      where (value->>'id')::uuid=md5('loadgistic-scale-capacity-'||series)::uuid);
    if actual_fixture_ids is distinct from expected_fixture_ids
      then raise exception 'SCALE_UNSCOPED_FIXTURE_PAGE_INCOMPLETE:page=%',page_number;end if;
    fixture_page_counts:=array_append(fixture_page_counts,coalesce(array_length(actual_fixture_ids,1),0));
  end loop;
  if (filtered_page->14->>'id') is distinct from (continuation_page->0->>'id')
    or (filtered_page->14->>'updated_at') is distinct from (continuation_page->0->>'updated_at')
    then raise exception 'SCALE_UNSCOPED_LOOKAHEAD_LOST';end if;
  if exists(select 1 from jsonb_array_elements(filtered_page) with ordinality as first_page(first_item,ordinal)
    cross join jsonb_array_elements(continuation_page) as next_page(next_item)
    where ordinal<=14 and (first_item->>'id'=next_item->>'id' or first_item->>'vehicle_id'=next_item->>'vehicle_id'))
    then raise exception 'SCALE_UNSCOPED_PAGES_OVERLAP';end if;
  if unscoped_ms>5000 or filtered_ms>5000 or continuation_ms>5000
    then raise exception 'SCALE_UNSCOPED_QUERY_TOO_SLOW:initial=%,filtered=%,continuation=%',unscoped_ms,filtered_ms,continuation_ms;end if;
  raise notice 'LOADGISTIC_UNSCOPED_SCALE_RESULT rows=15 filtered_rows=15 continuation_rows=15 bytes=% filtered_bytes=% continuation_bytes=% initial_ms=% filtered_ms=% continuation_ms=% fixture_rows=%',
    unscoped_bytes,filtered_bytes,continuation_bytes,round(unscoped_ms,3),round(filtered_ms,3),round(continuation_ms,3),fixture_page_counts;

  if profile_total is distinct from 1 or profile_rows is distinct from 1
    or coalesce(profile_match_count,0)<${requested}
    or profile_result->'items'->0->>'handle' is distinct from (select provider_handle from scale_owner)
    or profile_result->'items'->0->>'kind' is distinct from 'COMPANY'
    or profile_result->'items'->0->>'capacity_id' is not null
    or map_rows is distinct from 15 or route_rows is distinct from 15
    or map_provider_match is distinct from true or route_provider_match is distinct from true
    or map_fixture_match is distinct from true or route_fixture_match is distinct from true then
    raise exception 'SCALE_BOUNDED_PAGE_FAILED:profile_total=%,profile_rows=%,map_rows=%,route_rows=%',
      profile_total,profile_rows,map_rows,route_rows;
  end if;
  if profile_bytes is null or profile_bytes>100000 or map_bytes>1000000 then
    raise exception 'SCALE_PAYLOAD_TOO_LARGE:profile=%,map=%',profile_bytes,map_bytes;
  end if;
  if profile_ms>5000 or map_ms>5000 or route_ms>5000 then
    raise exception 'SCALE_QUERY_TOO_SLOW:profile=%,map=%,route=%',profile_ms,map_ms,route_ms;
  end if;
  raise notice 'LOADGISTIC_SCALE_RESULT trucks=${requested} profiles=% profile_rows=% profile_bytes=% profile_ms=% map_rows=% map_bytes=% map_ms=% route_rows=% route_ms=%',
    profile_total,profile_rows,profile_bytes,round(profile_ms,3),map_rows,map_bytes,round(map_ms,3),route_rows,round(route_ms,3);
end
$audit$;

explain (analyze,buffers,format json)
select count(*) from public.capacities where map_envelope && public.capacity_viewport_envelope('{"viewport":[38,8,40,10]}'::jsonb);

rollback;

select 'LOADGISTIC_SCALE_REMAINING='||count(*)
from public.vehicles where platform_number like 'LG-SCALE-%';
select 'LOADGISTIC_SCALE_DRIVERS_REMAINING='||count(*)
from auth.users where email like 'scale-driver-%@example.invalid';
`;

const result=spawnSync('docker',[
  'exec','-i',container,'psql','-U','postgres','-d','postgres','--no-psqlrc','-v','ON_ERROR_STOP=1',
  '-v',`scale_count=${requested}`,'-Atq'
],{
  cwd:root,input:sql,encoding:'utf8',maxBuffer:8*1024*1024
});
const combined=`${result.stdout||''}\n${result.stderr||''}`;
if(result.status!==0)throw new Error(`POSTGRES_SCALE_AUDIT_FAILED:${combined.slice(-2000)}`);
if(!/LOADGISTIC_SCALE_RESULT/.test(combined))throw new Error('POSTGRES_SCALE_RESULT_MISSING');
if(!/LOADGISTIC_UNSCOPED_SCALE_RESULT/.test(combined))throw new Error('POSTGRES_UNSCOPED_SCALE_RESULT_MISSING');
if(!/LOADGISTIC_SCALE_REMAINING=0/.test(combined))throw new Error('POSTGRES_SCALE_ROLLBACK_FAILED');
if(!/LOADGISTIC_SCALE_DRIVERS_REMAINING=0/.test(combined))throw new Error('POSTGRES_SCALE_DRIVER_ROLLBACK_FAILED');
const planStart=combined.indexOf('[\n');
if(planStart>=0){
 const planEnd=combined.indexOf('\n]',planStart);
 if(planEnd>=0){
  const planPath=path.join(root,'.local','audit-viewport-explain.json');
  fs.mkdirSync(path.dirname(planPath),{recursive:true,mode:0o700});
  fs.writeFileSync(planPath,combined.slice(planStart,planEnd+2),{mode:0o600});
 }
}
const overview=combined.split(/\r?\n/).find(line=>line.includes('LOADGISTIC_OVERVIEW_RESULT'))?.trim();
if(overview)process.stdout.write(overview+'\n');
const unscoped=combined.split(/\r?\n/).find(line=>line.includes('LOADGISTIC_UNSCOPED_SCALE_RESULT'))?.trim();
if(unscoped)process.stdout.write(unscoped+'\n');
const summary=combined.split(/\r?\n/).find(line=>line.includes('LOADGISTIC_SCALE_RESULT'))?.trim();
process.stdout.write(`${summary}\nPostgreSQL scale transaction rolled back with zero synthetic trucks remaining.\n`);
