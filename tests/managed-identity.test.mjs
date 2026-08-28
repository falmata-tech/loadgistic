import assert from 'node:assert/strict';
import test from 'node:test';
import {getManagedDriverAccess,getManagedWorkspaceAccess} from '../src/lib/identity/workspace-access.js';

test('managed role projection drives workspace access without a SQLite lookup',()=>{
  const user={
    role:'DRIVER',
    organization_id:'organization-id',
    provider_profile_id:null,
    workspace_subscription:{status:'ACTIVE',starts_at:'2026-08-01T00:00:00.000Z',ends_at:'2026-09-01T00:00:00.000Z'}
  };
  const access=getManagedWorkspaceAccess(user,new Date('2026-08-24T00:00:00.000Z'));
  assert.equal(access.granted,true);
  assert.equal(access.status,'ACTIVE');
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
