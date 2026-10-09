import test from 'node:test';
import assert from 'node:assert/strict';
import {getManagedWorkspaceAccess,getManagedDriverAccess} from '../src/lib/identity/workspace-access.js';
import {submitSupabasePaymentProof,reviewSupabasePaymentProof} from '../src/lib/billing/supabase.js';

test('provider access depends on an active linked workspace, never a plan or paid mode',()=>{
 for(const role of ['TRANSPORTER','DRIVER'])for(const link of ['organization_id','provider_profile_id'])for(const subscription of [null,{status:'TRIAL',ends_at:'2000-01-01'}, {status:'PAYMENT_UNDER_REVIEW'},{status:'ACTIVE',ends_at:'2099-01-01'}]){
  const user={active:true,role,[link]:'linked',workspace_subscription:subscription,access_policy:{mode:'TRIAL_PAYMENT',activated_at:'2000-01-01'}};
  assert.deepEqual(getManagedWorkspaceAccess(user),{granted:true,status:'FREE_ACCESS',ends_at:null,days_remaining:null,subscription:null});
 }
});
test('retiring plans does not unlock inactive, missing, unlinked or non-provider identities',()=>{
 for(const user of [null,{active:false,role:'DRIVER',provider_profile_id:'linked'}, {active:true,role:'DRIVER'}, {active:true,role:'SHIPPER',organization_id:'linked'}, {active:true,role:'UNKNOWN',provider_profile_id:'linked'}])assert.equal(getManagedWorkspaceAccess(user).granted,false);
 for(const role of ['ADMIN','SUPPORT']){assert.equal(getManagedWorkspaceAccess({active:true,role}).status,role);assert.equal(getManagedWorkspaceAccess({active:false,role}).granted,false);}
});
test('company-driver operational permissions are unchanged by plan retirement',()=>{
 const driver={active:true,role:'DRIVER',organization_id:'linked',can_manage_capacity:false,can_manage_tracking:true};
 assert.equal(getManagedWorkspaceAccess(driver).granted,true);
 assert.equal(getManagedDriverAccess(driver).can_manage_capacity,false);
 assert.equal(getManagedDriverAccess(driver).can_manage_tracking,true);
});
test('retired payment commands reject before reading a file or creating a database client',async()=>{
 const file={get arrayBuffer(){throw new Error('FILE_MUST_NOT_BE_READ');},get size(){throw new Error('FILE_MUST_NOT_BE_INSPECTED');}};
 await assert.rejects(submitSupabasePaymentProof({id:'provider'},100,'reference',file),/BILLING_RETIRED/);
 await assert.rejects(reviewSupabasePaymentProof({id:'admin'},'proof','APPROVED'),/BILLING_RETIRED/);
});
