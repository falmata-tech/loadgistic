import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import type {SupabaseClient} from '@supabase/supabase-js';
import {checked} from './audit-helpers';

// A local-only owner fixture for workflows that need more than one Live
// vehicle. The second Live vehicle must be unlocked through the same reviewed
// ownership command that a real Trust reviewer uses. Never grant that status
// by editing the truck or document rows directly.
export function localFleetPublication(db:SupabaseClient,owner:{id:string}){
 const target=new URL(db.supabaseUrl);
 if(!['127.0.0.1','localhost'].includes(target.hostname)||target.port!=='55321')throw Error('LOCAL_PUBLICATION_FIXTURE_REQUIRED');
 const published:string[]=[],proofs:string[]=[],requests:string[]=[],reviews:string[]=[],identities:string[]=[];
 let qualified=false;
 async function qualify(firstVehicleId:string){
  if(qualified)return;
  const reviewer=checked(await db.auth.admin.createUser({email:`publication-review-${randomUUID()}@example.test`,email_confirm:true})).user.id;
  identities.push(reviewer);
  checked(await db.from('profiles').update({role:'ADMIN',active:true,full_name:'Synthetic Trust reviewer'}).eq('id',reviewer));
  const proofPath=`verification/synthetic-e2e-publication/${randomUUID()}.png`;
  checked(await db.storage.from('verification').upload(proofPath,readFileSync('public/icon-192.png'),{contentType:'image/png'}));proofs.push(proofPath);
  const source=checked(await db.rpc('submit_managed_verification',{actor_user_id:owner.id,command:{
   subject_type:'VEHICLE',subject_id:firstVehicleId,verification_type:'VEHICLE_OWNERSHIP',
   document_name:'Synthetic local ownership review',storage_path:`supabase://verification/${proofPath}`,
   original_name:'synthetic-ownership.png',mime_type:'image/png'
  }}));requests.push(source);
  checked(await db.rpc('review_managed_verification',{actor_user_id:reviewer,request_id:source,review_status:'APPROVED',review_note:'Synthetic local fixture only.'}));
  const context=checked(await db.rpc('managed_provider_authority_review_context',{actor_user_id:reviewer,requested_request_ids:[source]}));
  const review=checked(await db.rpc('confirm_provider_vehicle_authority',{actor_user_id:reviewer,request_id:source,command:{
   fact_kind:'OWNERSHIP',review_note:'Matched synthetic owner and exact test vehicle.',context_revision:context[0].contextRevision
  }}));reviews.push(review);qualified=true;
 }
 async function publish(vehicleId:string){
  if(published.length)await qualify(published[0]);
  checked(await db.rpc('set_provider_vehicle_publication',{actor_user_id:owner.id,target_vehicle_id:vehicleId,requested_state:'LIVE'}));
  published.push(vehicleId);
 }
 async function cleanup(){
  const entityIds=[...requests,...reviews,...identities];
  if(entityIds.length)checked(await db.from('audit_logs').delete().in('entity_id',entityIds));
  if(requests.length){checked(await db.from('verification_requests').delete().in('id',requests).eq('submitted_by',owner.id));
   if(reviews.length&&checked(await db.from('provider_vehicle_authority_reviews').select('id').in('id',reviews)).length)throw Error('LOCAL_AUTHORITY_FIXTURE_REMAINS');}
  if(proofs.length)checked(await db.storage.from('verification').remove(proofs));
  for(const id of identities){checked(await db.from('audit_logs').delete().eq('actor_user_id',id));checked(await db.auth.admin.deleteUser(id));}
 }
 return {publish,cleanup};
}
