import test from 'node:test';
import assert from 'node:assert/strict';
import {providerWorkspaceCapabilities} from '../src/lib/provider-workspace.js';
import {getManagedDriverAccess,getManagedWorkspaceAccess} from '../src/lib/identity/workspace-access.js';
import {mobileIdentity} from '../src/lib/mobile/identity-policy.js';
import {normalizeProviderSignupInput} from '../src/lib/provider-signup.js';

const person={id:'owner',active:true,role:'DRIVER',driver_kind:'SELF_MANAGED',provider_profile_id:'provider'};
test('owner display capabilities preserve personal fleets without adopting employees',()=>{
  assert.equal(providerWorkspaceCapabilities(person).canManageFleet,true);
  const employee={id:'employee',active:true,role:'DRIVER',driver_kind:'COMPANY',provider_profile_id:null,employer_provider_profile_id:'provider',can_manage_capacity:true};
  assert.equal(providerWorkspaceCapabilities(employee).ownsProviderAccount,false);
  assert.equal(getManagedWorkspaceAccess(employee).granted,true);
  assert.equal(getManagedDriverAccess(employee).kind,'COMPANY');
  assert.equal(getManagedDriverAccess(employee).can_manage_tracking,false);
  assert.equal(providerWorkspaceCapabilities({...person,owns_provider_account:false}).canManageFleet,false);
  assert.equal(providerWorkspaceCapabilities({...person,active:false}).ownsProviderAccount,false);
  assert.equal(providerWorkspaceCapabilities({...person,role:'SUPPORT',owns_provider_account:true}).canManageFleet,false);
});
test('driving is independent of company presentation and additional truck ownership',()=>{
  const company={...person,role:'TRANSPORTER',organization_id:'org',provider_profile_id:null,owns_provider_account:true,can_manage_fleet:true,drives_truck:true,current_driver_id:'owner',current_driven_vehicle_id:'truck'};
  assert.deepEqual(providerWorkspaceCapabilities(company),{ownsProviderAccount:true,canManageFleet:true,drivesTruck:true,currentDriverId:'owner',currentDrivenVehicleId:'truck'});
  assert.equal(providerWorkspaceCapabilities({...company,drives_truck:false,current_driver_id:null}).currentDrivenVehicleId,null);
  const projection=mobileIdentity({...company,employer_provider_profile_id:'private-employer',privateDocument:'hidden'});
  assert.equal(projection.currentDrivenVehicleId,'truck');
  assert.equal('employer_provider_profile_id' in projection,false);
  assert.equal('privateDocument' in projection,false);
});
test('one provider signup keeps business presentation separate from driving intent',()=>{
  const input={firstName:'Aster',lastName:'Bekele',phone:'+251911000000',applicationType:'TRANSPORT_PROVIDER',drivesTruck:false};
  for(const drivesTruck of [true,false]){
    const personal=normalizeProviderSignupInput({...input,drivesTruck});
    assert.equal(personal.ok,true);assert.equal(personal.input.applicationType,'SELF_MANAGED_DRIVER');
    assert.equal(personal.input.businessName,'Aster');assert.equal(personal.input.drivesTruck,drivesTruck);
    const business=normalizeProviderSignupInput({...input,drivesTruck,businessName:'Aster Transport'});
    assert.equal(business.ok,true);assert.equal(business.input.applicationType,'TRANSPORT_COMPANY');assert.equal(business.input.drivesTruck,drivesTruck);
  }
  for(const drivesTruck of [undefined,'true',1,{},null])assert.equal(normalizeProviderSignupInput({...input,drivesTruck}).ok,false);
  assert.equal(normalizeProviderSignupInput({...input,businessName:'X'}).ok,false);
  assert.equal(normalizeProviderSignupInput({...input,publicCallbackPhone:'+251922000000'}).ok,true);
  assert.equal(normalizeProviderSignupInput({...input,businessName:'Aster Transport',publicCallbackPhone:'+251922000000'}).ok,false);
});
