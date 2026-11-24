import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {managedDevFixtureUuid as localUuid} from './prepare-managed-dev-review-fixtures.mjs';
import {pilotUuid} from './production-pilot-policy.mjs';
import {ensureIndependentVehicleAssignments} from './fixture-market-policy.mjs';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const pilotId=value=>value==null?null:uuid.test(value)?value:pilotUuid(value);
const status=row=>row.market_status||row.status;
const validPercent=value=>Number.isInteger(value)&&value>=1&&value<=99;

export function demoSpaceBackfillPlan(document,{pilotPublicRows}={}){
  if(document?.fixture_source!=='loadgistic'||document.schema_version!==1)throw Error('DEMO_SPACE_FIXTURE_INVALID');
  const {capacities,vehicles,provider_profiles:profiles,driver_vehicle_assignments:assignments}=document.tables;
  const isPilot=pilotPublicRows!==undefined;
  const id=isPilot?pilotId:localUuid;
  const partial=capacities.filter(row=>status(row)==='PARTIAL');
  const knownByVehicle=new Map(partial.map(row=>[id(row.vehicle_id),row]));
  const knownPilotVehicles=new Map(vehicles.map(row=>[pilotId(row.id),row]));
  if(knownByVehicle.size!==partial.length)throw Error('DEMO_SPACE_DUPLICATE_VEHICLE');
  const candidate=({id:capacityId,vehicleId,seed,vehicle,percent,reportedAt,reporterKey,driverKey})=>{
    if(!uuid.test(capacityId)||!uuid.test(vehicleId)||!validPercent(percent)||
      !Number.isFinite(Date.parse(reportedAt))||!reporterKey||!driverKey||!vehicle)throw Error('DEMO_SPACE_SEED_INVALID');
    if(seed&&seed.vehicle_id!==vehicle.id)throw Error('DEMO_SPACE_SEED_INVALID');
    return {capacity_id:capacityId,vehicle_id:vehicleId,
      organization_id:id(vehicle.organization_id),provider_profile_id:id(vehicle.provider_profile_id),
      reporter_key:reporterKey,driver_key:driverKey,percent,reported_at:new Date(reportedAt).toISOString()};
  };
  if(!isPilot)return partial.map(seed=>candidate({
    id:id(seed.id),vehicleId:id(seed.vehicle_id),seed,
    vehicle:vehicles.find(row=>row.id===seed.vehicle_id),percent:seed.available_percent,
    reportedAt:seed.available_percent_reported_at,reporterKey:seed.available_percent_reported_by,
    driverKey:seed.available_percent_reported_driver_id,
  }));
  // These two pilot trucks have newer Partial publications than the local
  // Empty fixtures. The values are explicit example estimates for those demos.
  const pilotOnlyEstimates=new Map([['veh-public-owner-01',40],['veh-public-owner-09',65]]);
  if(!Array.isArray(pilotPublicRows)||!pilotPublicRows.length||
    new Set(pilotPublicRows.map(row=>row.vehicleId)).size!==pilotPublicRows.length)throw Error('DEMO_SPACE_PILOT_INPUT_INVALID');
  const pilotAssignments=ensureIndependentVehicleAssignments(vehicles,profiles,assignments);
  return pilotPublicRows.map(row=>{
    const seed=knownByVehicle.get(row.vehicleId);
    const vehicle=knownPilotVehicles.get(row.vehicleId);
    if(!vehicle)throw Error('DEMO_SPACE_PILOT_VEHICLE_UNKNOWN');
    const driverKey=seed?.available_percent_reported_driver_id||pilotAssignments.find(
      assignment=>assignment.vehicle_id===vehicle.id&&Number(assignment.active)===1,
    )?.driver_user_id;
    return candidate({id:row.id,vehicleId:row.vehicleId,seed,vehicle,
      percent:seed?.available_percent??pilotOnlyEstimates.get(vehicle.id),
      reportedAt:seed?.available_percent_reported_at??document.captured_at,
      reporterKey:seed?.available_percent_reported_by??driverKey,driverKey});
  });
}

export function demoSpaceBackfillSql(plan,{commit=false,requireAll=false}={}){
  if(!plan.length)throw Error('DEMO_SPACE_EMPTY_PLAN');
  const data=JSON.stringify(plan).replaceAll("'","''");
  return `-- FEAT-CAP-001 / FEAT-SIM-001. Generated SQL. Run against the reviewed database.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
lock table public.capacities in share row exclusive mode;

create temporary table demo_space_plan on commit drop as
  select * from jsonb_to_recordset('${data}'::jsonb) as seed(
    capacity_id uuid, vehicle_id uuid, organization_id uuid, provider_profile_id uuid,
    reporter_key text, driver_key text, percent integer, reported_at timestamptz
  );
alter table demo_space_plan add primary key (capacity_id), add unique (vehicle_id);

-- Only current, unreported rows whose exact synthetic vehicle, owner scope,
-- publisher and assigned driver still agree with the plan can be changed.
create temporary table demo_space_eligible on commit drop as
select c.id,seed.percent,seed.reported_at,reporter.id as reporter_id,driver.id as driver_id,
  to_jsonb(c) as before_row
from demo_space_plan seed
join public.capacities c on c.id=seed.capacity_id and c.vehicle_id=seed.vehicle_id
join public.vehicles v on v.id=c.vehicle_id and v.active and v.publication_status='LIVE'
join auth.users reporter on reporter.id=c.updated_by and reporter.deleted_at is null
  and reporter.raw_app_meta_data->>'fixture_source'='loadgistic'
  and reporter.raw_user_meta_data->>'fixture_key'=seed.reporter_key
join auth.users driver on driver.id=public.capacity_active_driver_id(v.id) and driver.deleted_at is null
  and driver.raw_app_meta_data->>'fixture_source'='loadgistic'
  and driver.raw_user_meta_data->>'fixture_key'=seed.driver_key
join public.profiles reporter_profile on reporter_profile.id=reporter.id and reporter_profile.active
join public.profiles driver_profile on driver_profile.id=driver.id and driver_profile.active
where v.organization_id is not distinct from seed.organization_id
  and v.provider_profile_id is not distinct from seed.provider_profile_id
  and c.provider_organization_id is not distinct from v.organization_id
  and c.provider_profile_id is not distinct from v.provider_profile_id
  and coalesce(c.market_status,c.status::text)='PARTIAL'
  and c.available_percent_reported_at is null and c.available_percent_reported_by is null
  and c.available_percent_reported_driver_id is null
  and seed.percent between 1 and 99 and seed.reported_at<=c.updated_at
  and not exists (
    select 1 from public.capacities newer where newer.vehicle_id=c.vehicle_id
    and (newer.updated_at,newer.id)>(c.updated_at,c.id)
  )
  and (public.capacity_owner_documents(
    case when v.organization_id is not null then array[v.organization_id] else '{}'::uuid[] end,
    case when v.organization_id is null and v.provider_profile_id is not null then array[v.provider_profile_id] else '{}'::uuid[] end
  )->0->>'account_is_demo')='true';
alter table demo_space_eligible add primary key (id);

do $check$
begin
  if not exists(select 1 from pg_trigger where tgrelid='public.capacities'::regclass
    and tgname='capacity_reported_space_invalidate' and tgenabled='O'
    and tgfoid='public.capacity_reported_space_invalidate()'::regprocedure)
  then raise exception 'DEMO_SPACE_REPORT_TRIGGER_DRIFT'; end if;
  ${requireAll?"if (select count(*) from demo_space_eligible)<>(select count(*) from demo_space_plan) then raise exception 'DEMO_SPACE_PILOT_SCOPE_DRIFT'; end if;":''}
end
$check$;

-- This single trigger invalidates any ordinary direct provenance edit. Suspend
-- it only for this bounded transaction under the write lock, then restore it
-- before readback. Any error rolls back both the writes and the trigger state.
alter table public.capacities disable trigger capacity_reported_space_invalidate;
update public.capacities c
set available_percent=seed.percent, available_percent_reported_at=seed.reported_at,
    available_percent_reported_by=seed.reporter_id, available_percent_reported_driver_id=seed.driver_id
from demo_space_eligible seed where c.id=seed.id;
alter table public.capacities enable trigger capacity_reported_space_invalidate;

do $verify$
begin
  if exists(
    select 1 from demo_space_eligible seed left join public.capacities c on c.id=seed.id
    where c.id is null
      or row(c.available_percent,c.available_percent_reported_at,c.available_percent_reported_by,c.available_percent_reported_driver_id)
        is distinct from row(seed.percent,seed.reported_at,seed.reporter_id,seed.driver_id)
      or public.capacity_active_driver_id(c.vehicle_id) is distinct from seed.driver_id
      or (to_jsonb(c) - array['available_percent','available_percent_reported_at','available_percent_reported_by','available_percent_reported_driver_id'])
        is distinct from (seed.before_row - array['available_percent','available_percent_reported_at','available_percent_reported_by','available_percent_reported_driver_id'])
  ) then raise exception 'DEMO_SPACE_READBACK_MISMATCH'; end if;
end
$verify$;
select count(*) as repaired_demo_rows from demo_space_eligible;
${commit?'commit':'rollback'};
`;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);
  const pilotFile=args.find(arg=>arg.startsWith('--pilot-observations='))?.slice('--pilot-observations='.length);
  if(args.some(arg=>arg!=='--commit'&&!arg.startsWith('--pilot-observations='))||args.length>2)throw Error('DEMO_SPACE_ARGUMENTS_INVALID');
  const fixture=JSON.parse(readFileSync(new URL('../resources/fixtures/managed-market.json',import.meta.url),'utf8'));
  const pilotPublicRows=pilotFile?JSON.parse(readFileSync(pilotFile,'utf8')):undefined;
  process.stdout.write(demoSpaceBackfillSql(demoSpaceBackfillPlan(fixture,{pilotPublicRows}),{commit:args.includes('--commit'),requireAll:!!pilotFile}));
}
