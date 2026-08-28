import {removePrivateUpload,storePrivateUpload} from '../private-storage.js';
import {createSupabaseAdminClient} from '../supabase-adapter.js';
import {truckAuthorizationBadgeFromApproved,verificationBadgesFromApproved} from '../verification-summary.js';

const ERRORS=['FORBIDDEN','SUBSCRIPTION_ACCESS_REQUIRED','INVALID_VERIFICATION_TYPE','TRUCK_AUTHORIZATION_DETAILS_REQUIRED',
  'VERIFICATION_DOCUMENT_REQUIRED','VERIFICATION_ALREADY_SUBMITTED','VERIFICATION_ALREADY_REVIEWED','INVALID_STATUS','NOT_FOUND'];

function managedError(fallback,error){
  const message=String(error?.message||'');
  return new Error(ERRORS.find(code=>message.includes(code))||fallback,{cause:error});
}

function pageFromRows(rows,options={}){
  const pageSize=Math.max(1,Math.min(50,Number(options.pageSize)||12));
  const page=Math.max(1,Number(options.page)||1);
  const items=(rows||[]).map(row=>row?.payload||row);
  const total=Number(rows?.[0]?.total_count||0);
  return {items,total,page,pageSize,pageCount:Math.max(1,Math.ceil(total/pageSize))};
}

function projectSubject(subject){
  const documents=subject.approved_documents||[];
  const badges=verificationBadgesFromApproved(subject.subject_type,documents);
  const verificationTypes=subject.verification_types||[];
  const pairingBadges=verificationTypes.includes('VEHICLE_AUTHORIZATION')
    ?(subject.vehicles||[]).map(vehicle=>truckAuthorizationBadgeFromApproved(documents,vehicle.id,vehicle.label)):[];
  const verifiedTypes=new Set(badges.filter(badge=>badge.verified).map(badge=>badge.type));
  const allowedTypes=verificationTypes.filter(type=>type==='VEHICLE_AUTHORIZATION'
    ?pairingBadges.some(badge=>!badge.verified):!verifiedTypes.has(type));
  return {...subject,verification_types:undefined,approved_documents:undefined,
    allowed_types:allowedTypes,badges:[...badges,...pairingBadges]};
}

export async function getSupabaseVerificationCenter(user){
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('managed_verification_center',{actor_user_id:user.id});
  if(error)throw managedError('SUPABASE_VERIFICATION_CENTER_FAILED',error);
  return {subjects:(data?.subjects||[]).map(projectSubject),requests:data?.requests||[]};
}

export async function submitSupabaseVerification(user,input,file){
  const stored=await storePrivateUpload(file,'verification');
  if(!stored)throw new Error('VERIFICATION_DOCUMENT_REQUIRED');
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('submit_managed_verification',{actor_user_id:user.id,command:{
    subject_type:String(input.subjectType||''),subject_id:String(input.subjectId||''),
    verification_type:String(input.verificationType||''),related_vehicle_id:String(input.relatedVehicleId||''),
    expires_on:String(input.expiresOn||''),document_name:String(input.documentName||''),
    storage_path:stored.path,original_name:stored.originalName,mime_type:stored.mimeType
  }});
  if(error){
    await removePrivateUpload(stored.path).catch(()=>undefined);
    throw managedError('SUPABASE_VERIFICATION_SUBMIT_FAILED',error);
  }
  return data;
}

export async function getSupabaseVerificationFile(user,id){
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('managed_verification_file',{actor_user_id:user.id,request_id:id});
  if(error)throw managedError('SUPABASE_VERIFICATION_FILE_FAILED',error);
  return data?{...data,file_path:data.storage_path}:null;
}

export async function listSupabaseVerificationRequests(user,options={}){
  const pageSize=Math.max(1,Math.min(50,Number(options.pageSize)||12));
  const page=Math.max(1,Number(options.page)||1);
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('managed_verification_review_page',{actor_user_id:user.id,
    requested_status:String(options.status||'ALL'),search_text:String(options.q||''),
    requested_offset:(page-1)*pageSize,requested_limit:pageSize});
  if(error)throw managedError('SUPABASE_VERIFICATION_REVIEW_PAGE_FAILED',error);
  return pageFromRows(data,{page,pageSize});
}

export async function reviewSupabaseVerification(user,id,status,note=''){
  const client=createSupabaseAdminClient();
  const {error}=await client.rpc('review_managed_verification',{actor_user_id:user.id,request_id:id,
    review_status:String(status||''),review_note:String(note||'')});
  if(error)throw managedError('SUPABASE_VERIFICATION_REVIEW_FAILED',error);
}
