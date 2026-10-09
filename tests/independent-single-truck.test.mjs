import test from 'node:test';
import assert from 'node:assert/strict';
import {independentOperatingModel,isIndependentDriver,truckUseBasisLabel} from '../src/lib/independent-driver.js';
import {normalizeProviderSignupInput} from '../src/lib/provider-signup.js';
import {createProviderVehicle} from '../src/lib/fleet.js';
import {mobileIdentity} from '../src/lib/mobile/identity-policy.js';
import {discoveryProfiles} from '../src/lib/mobile/discovery-contract.js';
import {recoverTracking} from '../src/lib/lifecycle.js';

test('former independent categories converge; fleet and company-driver identities remain distinct',()=>{
 for(const model of ['OWNER_OPERATOR','SELF_MANAGED_DRIVER']){
  assert.equal(independentOperatingModel(model),'SELF_MANAGED_DRIVER');
  assert.equal(mobileIdentity({id:'driver',role:'DRIVER',provider_operating_model:model}).operatingModel,'SELF_MANAGED_DRIVER');
  const result=normalizeProviderSignupInput({name:'Independent fixture',businessName:'Independent transport',phone:'+251900000000',applicationType:model});
  assert.equal(result.input.applicationType,'SELF_MANAGED_DRIVER');
 }
 for(const model of ['COMPANY_DRIVER','FLEET_TRANSPORTER',null])assert.equal(independentOperatingModel(model),model);
 assert.equal(isIndependentDriver({role:'DRIVER',provider_profile_id:'owned',driver_kind:'SELF_MANAGED'}),true);
 for(const user of [{role:'DRIVER',organization_id:'fleet',driver_kind:'COMPANY'},{role:'DRIVER'},{role:'TRANSPORTER',organization_id:'fleet'},{role:'ADMIN'}])assert.equal(isIndependentDriver(user),false);
});
test('missing ownership/permission and unconfirmed replacement reject before database access',async()=>{
 const user={role:'DRIVER',provider_profile_id:'owned',driver_kind:'SELF_MANAGED'};
 await assert.rejects(createProviderVehicle(user,{useBasis:'OWNER_OPERATOR'}),/INVALID_VEHICLE_USE_BASIS/);
 await assert.rejects(createProviderVehicle(user,{useBasis:'OWNED',replaceVehicleId:'current',replacementConfirmed:false}),/TRUCK_CHANGE_CONFIRMATION_REQUIRED/);
 await assert.rejects(createProviderVehicle({role:'DRIVER',driver_kind:'COMPANY',organization_id:'fleet'},{useBasis:'OWNED'}),/FORBIDDEN/);
 assert.equal(truckUseBasisLabel(null),'Choose how you use this truck');
 assert.equal(truckUseBasisLabel('OWNED'),'I own this truck');
 assert.equal(truckUseBasisLabel('PERMISSION'),"I rent it or have the owner's permission");
});
test('legacy public profile type normalizes without changing associated truck count or leaking ownership assertions',()=>{
 const result=discoveryProfiles({items:[{key:'profile:one',kind:'OWNER_OPERATOR',title:'Independent',matching_trucks:1,handle:'independent',use_basis:'OWNED'}],total:1,page:1,pageSize:15,hasMore:false});
 assert.equal(result.items[0].kind,'SELF_MANAGED_DRIVER');assert.equal(result.items[0].matchingTrucks,1);
 assert.equal(Object.hasOwn(result.items[0],'useBasis'),false);
});
test('independent Tracking does not expose a fleet reassignment command through the server port',async()=>{
 await assert.rejects(recoverTracking({role:'DRIVER',provider_profile_id:'owned',driver_kind:'SELF_MANAGED'},'11111111-1111-4111-8111-111111111111',{
  action:'REASSIGN',revision:'2026-10-07T12:00:00.000Z',reason:'A prohibited truck switch',vehicle_id:'22222222-2222-4222-8222-222222222222'
 }),/FORBIDDEN/);
});
