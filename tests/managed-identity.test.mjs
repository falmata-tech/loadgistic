import assert from 'node:assert/strict';
import test from 'node:test';
import {getManagedDriverAccess,getManagedWorkspaceAccess} from '../src/lib/identity/workspace-access.js';
import {providerWorkspaceCapabilities} from '../src/lib/provider-workspace.js';
import {hasPlatformPermission,PLATFORM_PERMISSIONS} from '../src/lib/workspace.js';

test('personal shipper/receiver account access does not manufacture provider, fleet or platform authority',()=>{
 for(const role of ['SHIPPER','RECEIVER']){
  const user={id:'synthetic-owner',role,platform_role:role,active:true,owns_provider_account:true,can_manage_fleet:true,can_manage_tracking:true,can_manage_operations:true};
  assert.deepEqual(getManagedWorkspaceAccess(user),{granted:true,status:'ACCOUNT_ACCESS',ends_at:null,days_remaining:null,subscription:null});
  assert.equal(getManagedDriverAccess(user),null);assert.equal(providerWorkspaceCapabilities(user).ownsProviderAccount,false);assert.equal(providerWorkspaceCapabilities(user).canManageFleet,false);
  for(const permission of Object.values(PLATFORM_PERMISSIONS))assert.equal(hasPlatformPermission(user,permission),false);
  assert.equal(getManagedWorkspaceAccess({...user,active:false}).granted,false);
  for(const platform_role of ['ADMIN','SUPPORT','TRANSPORTER','DRIVER'])assert.equal(getManagedWorkspaceAccess({...user,platform_role}).granted,false);
 }
 assert.equal(getManagedWorkspaceAccess({role:'CUSTOMER',platform_role:'SHIPPER',active:true}).granted,false,'a selected customer context still needs its saved membership');
});

test('managed role projection drives workspace access without a SQLite lookup',()=>{
  const user={
    role:'DRIVER',
    active:true,
    organization_id:'organization-id',
    provider_profile_id:null,
    workspace_subscription:{status:'ACTIVE',starts_at:'2026-08-01T00:00:00.000Z',ends_at:'2026-09-01T00:00:00.000Z'}
  };
  const access=getManagedWorkspaceAccess(user,new Date('2026-08-24T00:00:00.000Z'));
  assert.equal(access.granted,true);
  assert.equal(access.status,'FREE_ACCESS');
});

test('managed company Driver permissions come only from the verified projection',()=>{
  const access=getManagedDriverAccess({
    id:'driver-id',role:'DRIVER',organization_id:'organization-id',provider_profile_id:null,
    can_manage_capacity:true,can_manage_tracking:false
  });
  assert.deepEqual(access,{
    kind:'COMPANY',can_browse_load_board:false,can_contact_businesses:false,
    can_negotiate_loads:false,can_manage_capacity:true,can_manage_tracking:false
  });
});
