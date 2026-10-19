import {commitPrivateUpload} from '../private-upload-commit.js';
import {readWindowedPage} from '../pagination.js';
import {removePrivateUpload,storePrivateUpload} from '../private-storage.js';
import {createSupabaseAdminClient} from '../supabase-adapter.js';
import {projectVerificationSubject} from '../verification-summary.js';
import {getTruckAuthorities} from '../provider-authority.js';

const ERRORS=['FORBIDDEN','SUBSCRIPTION_ACCESS_REQUIRED','INVALID_VERIFICATION_TYPE','TRUCK_AUTHORIZATION_DETAILS_REQUIRED','BUSINESS_MANAGER_NAME_REQUIRED','VERIFICATION_SUBJECT_CHANGED',
  'VERIFICATION_DOCUMENT_REQUIRED','VERIFICATION_ALREADY_SUBMITTED','VERIFICATION_ALREADY_REVIEWED','INVALID_STATUS','NOT_FOUND'];

function managedError(fallback,error){
  const message=String(error?.message||'');
  return new Error(ERRORS.find(code=>message.includes(code))||fallback,{cause:error});
}
export async function getSupabaseVerificationCenter(user){
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('managed_verification_center',{actor_user_id:user.id});
  if(error)throw managedError('SUPABASE_VERIFICATION_CENTER_FAILED',error);
  const requests=data?.requests||[];
  const subjects=data?.subjects||[];
  // The center has authorized each subject. Never expand that scope while
  // reading current facts, and do not fall back to historical approval on error.
  const truckIds=[...new Set(subjects.filter(subject=>subject.subject_type==='VEHICLE').map(subject=>subject.subject_id))];
  const authority=new Map();
  for(let offset=0;offset<truckIds.length;offset+=100){
    const current=await getTruckAuthorities(client,truckIds.slice(offset,offset+100));
    for(const [vehicleId,facts] of current)authority.set(vehicleId,facts);
  }
  if(truckIds.some(id=>!authority.has(id)))throw new Error('SUPABASE_VERIFICATION_AUTHORITY_FAILED');
  return {subjects:subjects.map(subject=>projectVerificationSubject(subject.subject_type==='VEHICLE'
    ?{...subject,authority:authority.get(subject.subject_id)}:subject,requests,
    {driverPairingAuthorization:user.driver_kind==='COMPANY'})),requests};
}

export async function submitSupabaseVerification(user,input,file){
  const stored=await storePrivateUpload(file,'verification');
  if(!stored)throw new Error('VERIFICATION_DOCUMENT_REQUIRED');
  const client=createSupabaseAdminClient();
  const data=await commitPrivateUpload(stored,async()=>{
    const {data,error}=await client.rpc('submit_managed_verification',{actor_user_id:user.id,command:{
    subject_type:String(input.subjectType||''),subject_id:String(input.subjectId||''),
    verification_type:String(input.verificationType||''),related_vehicle_id:String(input.relatedVehicleId||''),
    expires_on:String(input.expiresOn||''),document_name:String(input.documentName||''),
    storage_path:stored.path,original_name:stored.originalName,mime_type:stored.mimeType
  }});
    if(error)throw managedError('SUPABASE_VERIFICATION_SUBMIT_FAILED',error);
    return data;
  },removePrivateUpload);
  return data;
}

export async function getSupabaseVerificationFile(user,id){
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('managed_verification_file',{actor_user_id:user.id,request_id:id});
  if(error)throw managedError('SUPABASE_VERIFICATION_FILE_FAILED',error);
  return data?{...data,file_path:data.storage_path}:null;
}

export async function listSupabaseVerificationRequests(user,options={}){
  const client=createSupabaseAdminClient();
  const result=await readWindowedPage(async(offset,limit)=>{
    const {data,error}=await client.rpc('managed_verification_review_page',{actor_user_id:user.id,
      requested_status:String(options.status||'ALL'),search_text:String(options.q||''),
      requested_offset:offset,requested_limit:limit});
    if(error)throw managedError('SUPABASE_VERIFICATION_REVIEW_PAGE_FAILED',error);
    return data||[];
  },options);
  const ids=result.items.map(item=>item.id);
  if(!ids.length)return result;
  const {data,error}=await client.rpc('managed_provider_authority_review_context',{actor_user_id:user.id,requested_request_ids:ids});
  if(error)throw managedError('SUPABASE_VERIFICATION_REVIEW_CONTEXT_FAILED',error);
  const byRequest=new Map((data||[]).map(item=>[item.requestId,item]));
  return {...result,items:result.items.map(item=>({...item,authority_context:byRequest.get(item.id)||null}))};
}

export async function reviewSupabaseVerification(user,id,status,note=''){
  const client=createSupabaseAdminClient();
  const {error}=await client.rpc('review_managed_verification',{actor_user_id:user.id,request_id:id,
    review_status:String(status||''),review_note:String(note||'')});
  if(error)throw managedError('SUPABASE_VERIFICATION_REVIEW_FAILED',error);
}
