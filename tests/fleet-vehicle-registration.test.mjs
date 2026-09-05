import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {canManageProviderVehicles} from '../src/lib/fleet.js';

const root=path.resolve(process.cwd());

test('only provider owners receive the truck-registration affordance',()=>{
  assert.equal(canManageProviderVehicles({role:'TRANSPORTER'}),true);
  assert.equal(canManageProviderVehicles({role:'DRIVER',driver_kind:'SELF_MANAGED',provider_profile_id:'provider-1'}),true);
  assert.equal(canManageProviderVehicles({role:'DRIVER',driver_kind:'OWNER_OPERATOR',provider_profile_id:'provider-1'}),true);
  assert.equal(canManageProviderVehicles({role:'DRIVER',driver_kind:'COMPANY'}),false);
  assert.equal(canManageProviderVehicles({role:'DRIVER',driver_kind:'SELF_MANAGED'}),false);
  assert.equal(canManageProviderVehicles({role:'SHIPPER'}),false);
});

test('truck registration is one owner-scoped managed command without inferred operational state',()=>{
  const migration=fs.readFileSync(path.join(root,'supabase/migrations/071_interchangeable_tractor_trailers.sql'),'utf8');
  const create=migration.slice(migration.indexOf('create or replace function public.create_provider_vehicle'));
  assert.match(create,/membership_role='OWNER'/);
  assert.match(create,/actor\.is_company_driver/);
  assert.match(create,/SUBSCRIPTION_ACCESS_REQUIRED/);
  assert.match(create,/INVALID_VEHICLE_CONFIGURATION/);
  assert.match(create,/PROVIDER_VEHICLE_CREATED/);
  assert.match(create,/Heavy Rigid Stake Body Truck \+ Trailer/);
  assert.match(create,/Courier car/);
  assert.match(create,/Tractor \+ Container Trailer/);
  assert.match(create,/Tractor \+ Dry Van Trailer/);
  assert.match(create,/Tractor \+ Heavy Equipment Trailer/);
  assert.match(create,/supported_trailer_configurations/);
  assert.match(create,/current configuration/i);
  assert.doesNotMatch(create,/Courier motorcycle/);
  assert.doesNotMatch(create,/insert into public\.(capacities|driver_vehicle_assignments|verification_requests)/);
  assert.match(migration,/revoke all on function public\.create_provider_vehicle\(uuid,jsonb\) from public,anon,authenticated/);
  assert.match(migration,/grant execute on function public\.create_provider_vehicle\(uuid,jsonb\) to service_role/);
});

test('an owner can switch only a registered tractor to a compatible attached trailer',()=>{
  const migration=fs.readFileSync(path.join(root,'supabase/migrations/071_interchangeable_tractor_trailers.sql'),'utf8');
  const update=migration.slice(migration.indexOf('create or replace function public.set_provider_vehicle_attached_trailer'));
  assert.match(update,/membership_role='OWNER'/);
  assert.match(update,/actor\.is_company_driver/);
  assert.match(update,/NOT_INTERCHANGEABLE_TRACTOR/);
  assert.match(update,/INCOMPATIBLE_TRAILER_CONFIGURATION/);
  assert.match(update,/VEHICLE_ATTACHED_TRAILER_CHANGED/);
  assert.match(update,/update public\.vehicles[\s\S]*cargo_configuration=configuration_value/);
  assert.match(update,/revoke all on function public\.set_provider_vehicle_attached_trailer\(uuid,jsonb\) from public,anon,authenticated/);
  assert.match(update,/grant execute on function public\.set_provider_vehicle_attached_trailer\(uuid,jsonb\) to service_role/);

  const route=fs.readFileSync(path.join(root,'src/app/api/fleet/vehicles/[id]/trailer/route.ts'),'utf8');
  const detail=fs.readFileSync(path.join(root,'src/app/app/fleet/[id]/page.tsx'),'utf8');
  assert.match(route,/setProviderVehicleAttachedTrailer/);
  assert.match(detail,/Attached trailer/);
  assert.match(detail,/supported_trailer_configurations/);
});

test('a fixed truck detail keeps map tools but omits its redundant selected-truck overlay',()=>{
  const capacity=fs.readFileSync(path.join(root,'src/components/capacity-form.tsx'),'utf8');
  const detail=fs.readFileSync(path.join(root,'src/app/app/fleet/[id]/page.tsx'),'utf8');
  assert.match(capacity,/lockVehicleSelection\?null:<header className="capacity-summary-map-header">/);
  assert.match(detail,/capacity-home-page fleet-truck-capacity-workspace/);
  assert.match(detail,/lockVehicleSelection/);
});

test('the public catalogue has courier cars and distinct attached tractor trailers but no motorcycle',()=>{
  const catalog=fs.readFileSync(path.join(root,'src/lib/vehicle-configurations.ts'),'utf8');
  const registration=fs.readFileSync(path.join(root,'src/components/vehicle-registration-fields.tsx'),'utf8');
  for(const [name,file] of [
    ['Courier car','courier-car.jpg'],
    ['Tractor + Container Trailer','tractor-container-trailer.jpg'],
    ['Tractor + Dry Van Trailer','tractor-dry-van-trailer.jpg'],
    ['Tractor + Heavy Equipment Trailer','tractor-heavy-equipment-trailer.jpg']
  ]){
    assert.match(catalog,new RegExp(name.replaceAll('+','\\+')));
    assert.equal(fs.existsSync(path.join(root,'public/vehicle-configurations',file)),true,file);
  }
  assert.match(registration,/Interchangeable tractor/);
  assert.match(registration,/Compatible trailers/);
  assert.match(registration,/Currently attached trailer/);
  assert.doesNotMatch(catalog,/Courier motorcycle/);
});

test('fleet pages expose add and detail destinations while company drivers are filtered out',()=>{
  const fleet=fs.readFileSync(path.join(root,'src/app/app/fleet/page.tsx'),'utf8');
  const menu=fs.readFileSync(path.join(root,'src/app/app/menu/page.tsx'),'utf8');
  const shell=fs.readFileSync(path.join(root,'src/components/app-shell.tsx'),'utf8');
  assert.match(fleet,/href="\/app\/fleet\/new"/);
  assert.match(fleet,/href=\{`\/app\/fleet\/\$\{vehicle\.id\}`\}/);
  assert.match(menu,/canManageProviderVehicles/);
  assert.match(shell,/\['\/app\/company-page','\/app\/fleet'\]\.includes\(item\.href\)/);
});
