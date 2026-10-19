import assert from 'node:assert/strict';
import test from 'node:test';
import {canManageProviderFleet,canManageProviderVehicles,createProviderVehicle,getFleetDriverPage,updateFleetDriverAccess} from '../src/lib/fleet.js';
import {TRUCK_USE_BASES,truckUseBasisLabel} from '../src/lib/independent-driver.js';

test('fleet management follows owner capability and never an employer connection',()=>{
 const personal={id:'owner',role:'DRIVER',active:true,provider_profile_id:'own-provider',driver_kind:'SELF_MANAGED'};
 const business={id:'business',role:'TRANSPORTER',active:true,organization_id:'own-organization'};
 const employee={id:'employee',role:'DRIVER',active:true,driver_kind:'COMPANY',employer_provider_profile_id:'employer'};
 for(const user of [personal,business,{...business,owns_provider_account:true,can_manage_fleet:true}]){
  assert.equal(canManageProviderFleet(user),true);assert.equal(canManageProviderVehicles(user),true);
 }
 for(const user of [null,employee,{...personal,active:false},{...personal,can_manage_fleet:false,owns_provider_account:true},
  {...employee,can_manage_fleet:true,owns_provider_account:false},{role:'SUPPORT',active:true},{role:'TRANSPORTER',active:true}]){
  assert.equal(canManageProviderFleet(user),false);
 }
});

test('every owner declares owned, financed or permission use without legacy replacement',async()=>{
 assert.deepEqual(TRUCK_USE_BASES,['OWNED','FINANCED','PERMISSION']);
 assert.match(truckUseBasisLabel('FINANCED'),/financing/);
 assert.doesNotMatch(truckUseBasisLabel('PERMISSION'),/licen[cs]e/i);
 assert.match(truckUseBasisLabel('PERMISSION'),/rent.*permission/);
 const owner={id:'owner',role:'DRIVER',active:true,provider_profile_id:'own-provider'};
 await assert.rejects(()=>createProviderVehicle(owner,{}),/INVALID_VEHICLE_USE_BASIS/);
 await assert.rejects(()=>createProviderVehicle(owner,{useBasis:'RENTED'}),/INVALID_VEHICLE_USE_BASIS/);
 await assert.rejects(()=>createProviderVehicle(owner,{useBasis:'OWNED',replaceVehicleId:'old'}),/TRUCK_CHANGE_REQUIRED/);
});

test('employed drivers are denied before fleet repository calls',async()=>{
 const employee={id:'employee',role:'DRIVER',active:true,driver_kind:'COMPANY',employer_provider_profile_id:'employer'};
 await assert.rejects(()=>createProviderVehicle(employee,{useBasis:'OWNED'}),/FORBIDDEN/);
 await assert.rejects(()=>getFleetDriverPage(employee),/FORBIDDEN/);
 await assert.rejects(()=>updateFleetDriverAccess(employee,'someone',{}),/FORBIDDEN/);
});
