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
select organization.id as organization_id,member.user_id as owner_user_id
from public.organizations organization
join public.organization_members member on member.organization_id=organization.id
  and member.membership_role='OWNER'
join public.company_pages page on page.organization_id=organization.id and page.published
where organization.type='TRANSPORT_COMPANY'
order by organization.id
limit 1;

insert into public.vehicles(
  id,organization_id,label,category,make,model,cargo_configuration,plate,active,platform_number
)
select
  md5('loadgistic-scale-vehicle-'||series)::uuid,owner.organization_id,
  'Scale truck '||series,'Cargo van','Scale','Local','Cargo van',
  'SCALE-'||lpad(series::text,5,'0'),true,'LG-SCALE-'||lpad(series::text,5,'0')
from generate_series(1,:scale_count) series cross join scale_owner owner;

-- Publication now requires an active Driver. These no-password identities,
-- memberships, and one-to-one assignments exist only inside this rollback.
insert into auth.users(id,email,raw_user_meta_data)
select md5('loadgistic-scale-driver-'||series)::uuid,
  'scale-driver-'||series||'@example.invalid','{}'::jsonb
from generate_series(1,:scale_count) series;

insert into public.profiles(id,email,full_name,role,active)
select md5('loadgistic-scale-driver-'||series)::uuid,
  'scale-driver-'||series||'@example.invalid','Scale driver '||series,'DRIVER',true
from generate_series(1,:scale_count) series
on conflict(id) do update set full_name=excluded.full_name,role=excluded.role,active=true;

insert into public.organization_members(user_id,organization_id,membership_role)
select md5('loadgistic-scale-driver-'||series)::uuid,owner.organization_id,'DRIVER'
from generate_series(1,:scale_count) series cross join scale_owner owner;

insert into public.drivers(user_id,organization_id,name,active)
select md5('loadgistic-scale-driver-'||series)::uuid,owner.organization_id,'Scale driver '||series,true
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
  query_ms numeric;
  route_ms numeric;
  overview_ms numeric; overview_rows integer; overview_trucks bigint; overview_bytes bigint;
  result_rows integer;
  route_rows integer;
  payload_bytes bigint;
begin
  started_at:=clock_timestamp();
  select count(*),coalesce(sum(octet_length(payload::text)),0)
    into result_rows,payload_bytes
  from public.public_capacity_page('{"q":"lg-scale"}'::jsonb,null,null,14);
  query_ms:=extract(epoch from clock_timestamp()-started_at)*1000;

  started_at:=clock_timestamp();
  select count(*) into route_rows
  from public.public_capacity_page(
    '{"origin_lat":9.03,"origin_lng":38.74,"destination_lat":8.75,"destination_lng":38.99,"origin_radius_km":10,"destination_radius_km":10}'::jsonb,
    null,null,14
  );
  route_ms:=extract(epoch from clock_timestamp()-started_at)*1000;

  started_at:=clock_timestamp();
  select count(*),coalesce(sum((payload->>'count')::bigint),0),coalesce(sum(octet_length(payload::text)),0)
    into overview_rows,overview_trucks,overview_bytes
  from public.public_capacity_clusters('{"q":"lg-scale","viewport":[38,8,40,10]}'::jsonb);
  overview_ms:=extract(epoch from clock_timestamp()-started_at)*1000;
  if overview_rows>200 or overview_trucks<>${requested} or overview_bytes>100000 then raise exception 'SCALE_OVERVIEW_BOUND_FAILED';end if;
  if overview_ms>5000 then raise exception 'SCALE_OVERVIEW_TOO_SLOW:%',overview_ms;end if;
  raise notice 'LOADGISTIC_OVERVIEW_RESULT cells=% trucks=% bytes=% query_ms=%',overview_rows,overview_trucks,overview_bytes,round(overview_ms,3);

  if result_rows<>15 or route_rows<>15 then
    raise exception 'SCALE_BOUNDED_PAGE_FAILED:%,%',result_rows,route_rows;
  end if;
  if payload_bytes>1000000 then
    raise exception 'SCALE_PAYLOAD_TOO_LARGE:%',payload_bytes;
  end if;
  if query_ms>5000 or route_ms>5000 then
    raise exception 'SCALE_QUERY_TOO_SLOW:%,%',query_ms,route_ms;
  end if;
  raise notice 'LOADGISTIC_SCALE_RESULT trucks=${requested} rows=% bytes=% query_ms=% route_rows=% route_ms=%',
    result_rows,payload_bytes,round(query_ms,3),route_rows,round(route_ms,3);
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
if(!/LOADGISTIC_SCALE_REMAINING=0/.test(combined))throw new Error('POSTGRES_SCALE_ROLLBACK_FAILED');
if(!/LOADGISTIC_SCALE_DRIVERS_REMAINING=0/.test(combined))throw new Error('POSTGRES_SCALE_DRIVER_ROLLBACK_FAILED');
const planStart=combined.indexOf('[\n');
if(planStart>=0){
 const planEnd=combined.indexOf('\n]',planStart);
 if(planEnd>=0)fs.writeFileSync(path.join(root,'.local','audit-viewport-explain.json'),combined.slice(planStart,planEnd+2));
}
const overview=combined.split(/\r?\n/).find(line=>line.includes('LOADGISTIC_OVERVIEW_RESULT'))?.trim();
if(overview)process.stdout.write(overview+'\n');
const summary=combined.split(/\r?\n/).find(line=>line.includes('LOADGISTIC_SCALE_RESULT'))?.trim();
process.stdout.write(`${summary}\nPostgreSQL scale transaction rolled back with zero synthetic trucks remaining.\n`);
