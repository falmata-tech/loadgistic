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
  const migration=fs.readFileSync(path.join(root,'supabase/migrations/068_truck_capacity_catalog.sql'),'utf8');
  const create=migration.slice(migration.indexOf('create or replace function public.create_provider_vehicle'));
  assert.match(create,/membership_role='OWNER'/);
  assert.match(create,/actor\.is_company_driver/);
  assert.match(create,/SUBSCRIPTION_ACCESS_REQUIRED/);
  assert.match(create,/INVALID_VEHICLE_CONFIGURATION/);
  assert.match(create,/PROVIDER_VEHICLE_CREATED/);
  assert.match(create,/Heavy Rigid Stake Body Truck \+ Trailer/);
  assert.doesNotMatch(create,/Courier motorcycle|Courier car/);
  assert.doesNotMatch(create,/insert into public\.(capacities|driver_vehicle_assignments|verification_requests)/);
  assert.match(migration,/revoke all on function public\.create_provider_vehicle\(uuid,jsonb\) from public,anon,authenticated/);
  assert.match(migration,/grant execute on function public\.create_provider_vehicle\(uuid,jsonb\) to service_role/);
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
