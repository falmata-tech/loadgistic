import assert from 'node:assert/strict';
import test from 'node:test';
import {getDriverAccess,getWorkspaceAccess} from '../src/lib/repository.js';

function withManagedRuntime(callback){
  const previousAuth=process.env.AUTH_BACKEND;
  const previousData=process.env.DATA_BACKEND;
  process.env.AUTH_BACKEND='supabase';
  process.env.DATA_BACKEND='supabase';
  try{return callback();}
  finally{
    if(previousAuth===undefined)delete process.env.AUTH_BACKEND;else process.env.AUTH_BACKEND=previousAuth;
    if(previousData===undefined)delete process.env.DATA_BACKEND;else process.env.DATA_BACKEND=previousData;
  }
}

test('managed role projection drives workspace access without a SQLite lookup',()=>withManagedRuntime(()=>{
  const user={
    role:'DRIVER',
    organization_id:'organization-id',
    provider_profile_id:null,
    workspace_subscription:{status:'ACTIVE',starts_at:'2026-08-01T00:00:00.000Z',ends_at:'2026-09-01T00:00:00.000Z'}
  };
  const access=getWorkspaceAccess(user,new Date('2026-08-24T00:00:00.000Z'));
  assert.equal(access.granted,true);
  assert.equal(access.status,'ACTIVE');
}));

test('managed company Driver permissions come only from the verified projection',()=>withManagedRuntime(()=>{
  const access=getDriverAccess({
    id:'driver-id',role:'DRIVER',organization_id:'organization-id',provider_profile_id:null,
    can_manage_capacity:true,can_manage_tracking:false
  });
  assert.deepEqual(access,{
    kind:'COMPANY',can_browse_load_board:false,can_contact_businesses:false,
    can_negotiate_loads:false,can_manage_capacity:true,can_manage_tracking:false
  });
}));
