import assert from 'node:assert/strict';
import test from 'node:test';
import {projectVerificationSubject} from '../src/lib/verification-summary.js';
import {getSupabaseVerificationCenter} from '../src/lib/verification/supabase.js';
import {emptyTruckAuthority} from '../src/lib/provider-authority-contract.js';

const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const types=['VEHICLE_OWNERSHIP','VEHICLE_AUTHORIZATION','VEHICLE_OPERATING_LICENSE'];
const approved=types.map(verification_type=>({verification_type,reviewed_at:'2026-10-14',expires_on:'2999-01-01'}));
const subject={subject_type:'VEHICLE',subject_id:uuid(1),verification_types:types,approved_documents:approved};
test('revoked or changed exact authority allows a replacement without erasing generic reviewed history',()=>{
 const result=projectVerificationSubject({...subject,authority:emptyTruckAuthority()});
 assert.deepEqual(result.allowed_types,types);
 assert.ok(result.badges.every(badge=>badge.verified),'Generic document review history remains visible');
});
test('current exact facts and pending replacements still suppress duplicate categories',()=>{
 for(const [type,key] of [['VEHICLE_OWNERSHIP','ownership'],['VEHICLE_AUTHORIZATION','permission'],['VEHICLE_OPERATING_LICENSE','operatingLicence']]){
  const authority=emptyTruckAuthority();authority[key]={...authority[key],verified:true,reviewedAt:'2026-10-14',expiresOn:'2999-01-01'};
  const result=projectVerificationSubject({...subject,authority},[{subject_type:'VEHICLE',subject_id:uuid(1),verification_type:types.find(value=>value!==type),status:'PENDING'}]);
  assert.equal(result.allowed_types.includes(type),false);
  assert.equal(result.allowed_types.length,1);
 }
});
test('organization and driver documents retain existing duplicate rules',()=>{
 for(const subject_type of ['DRIVER','ORGANIZATION']){
  const result=projectVerificationSubject({subject_type,subject_id:uuid(1),verification_types:['IDENTITY'],
   approved_documents:[{verification_type:'IDENTITY',reviewed_at:'2026-10-14',expires_on:null}],authority:emptyTruckAuthority()});
  assert.deepEqual(result.allowed_types,[]);
 }
});
test('an employed driver keeps personal pairing review separate from provider authority',()=>{
 const result=projectVerificationSubject({...subject,authority:emptyTruckAuthority()},[],{driverPairingAuthorization:true});
 assert.equal(result.allowed_types.includes('VEHICLE_AUTHORIZATION'),false);
 assert.equal(result.allowed_types.includes('VEHICLE_OWNERSHIP'),true);
});

async function withRpc(handler,run){
 const previous={fetch:globalThis.fetch,url:process.env.NEXT_PUBLIC_SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY};
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://authority-recovery.invalid';process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic-test-key';
 const calls=[];
 globalThis.fetch=async(url,init)=>{
  const name=new URL(url).pathname.split('/').at(-1),body=JSON.parse(init.body);calls.push({name,body});
  const response=await handler(name,body);
  return new Response(JSON.stringify(response.body),{status:response.status||200,headers:{'Content-Type':'application/json'}});
 };
 try{await run(calls);}finally{
  globalThis.fetch=previous.fetch;
  for(const [key,value] of [['NEXT_PUBLIC_SUPABASE_URL',previous.url],['SUPABASE_SERVICE_ROLE_KEY',previous.key]]){
   if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
 }
}
test('verification center enriches only authorized truck subjects in bounded batches',async()=>{
 const subjects=Array.from({length:233},(_,index)=>({...subject,subject_id:uuid(index+1)}));
 subjects.push({subject_type:'DRIVER',subject_id:uuid(999),verification_types:['IDENTITY']});
 await withRpc((name,body)=>{
  if(name==='managed_verification_center')return {body:{subjects,requests:[]}};
  assert.equal(name,'provider_vehicle_authority_states');
  return {body:body.requested_vehicle_ids.map(vehicleId=>({vehicleId,authority:emptyTruckAuthority()}))};
 },async calls=>{
  const result=await getSupabaseVerificationCenter({id:uuid(1000)});
  assert.equal(result.subjects.length,234);
  assert.deepEqual(calls.slice(1).map(call=>call.body.requested_vehicle_ids.length),[100,100,33]);
  assert.deepEqual(calls.slice(1).flatMap(call=>call.body.requested_vehicle_ids),subjects.slice(0,233).map(value=>value.subject_id));
  assert.ok(result.subjects.slice(0,233).every(value=>value.allowed_types.includes('VEHICLE_OWNERSHIP')));
  assert.equal(Object.hasOwn(result.subjects.at(-1),'authority'),false);
 });
});
test('authority failure or an incomplete truck response cannot revert to stale generic approvals',async()=>{
 for(const failure of [{status:503,body:{message:'Synthetic unavailable'}},{body:[]}]){
  await withRpc(name=>name==='managed_verification_center'?{body:{subjects:[subject],requests:[]}}:failure,async()=>{
   await assert.rejects(()=>getSupabaseVerificationCenter({id:uuid(1000)}),/PROVIDER_AUTHORITY_UNAVAILABLE|SUPABASE_VERIFICATION_AUTHORITY_FAILED/);
  });
 }
});
test('verification authority enrichment rejects foreign truck IDs and avoids reads for other entities',async()=>{
 await withRpc(name=>name==='managed_verification_center'?{body:{subjects:[subject],requests:[]}}
  :{body:[{vehicleId:uuid(777),authority:emptyTruckAuthority()}]},async()=>{
  await assert.rejects(()=>getSupabaseVerificationCenter({id:uuid(1000)}),/PROVIDER_AUTHORITY_SCOPE_MISMATCH/);
 });
 await withRpc(name=>{
  assert.equal(name,'managed_verification_center');return {body:{subjects:[{subject_type:'DRIVER',subject_id:uuid(1),verification_types:['IDENTITY']}],requests:[]}};
 },async calls=>{await getSupabaseVerificationCenter({id:uuid(1000)});assert.equal(calls.length,1);});
});
