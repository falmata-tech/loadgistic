import {removePrivateUpload,storePrivateUpload} from '../private-storage.js';
import {createSupabaseAdminClient} from '../supabase-adapter.js';

const ERRORS=['FORBIDDEN','SUBSCRIPTION_NOT_FOUND','PAYMENT_NOT_REQUIRED','INVALID_ETB_AMOUNT',
  'INVALID_PRIVATE_STORAGE_REFERENCE','PAYMENT_PROOF_ALREADY_REVIEWED','INVALID_STATUS','NOT_FOUND'];

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

export async function getSupabaseBillingSummary(user,options={}){
  const pageSize=Math.max(1,Math.min(50,Number(options.pageSize)||10));
  const page=Math.max(1,Number(options.page)||1);
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('managed_billing_summary',{actor_user_id:user.id,
    requested_offset:(page-1)*pageSize,requested_limit:pageSize});
  if(error)throw managedError('SUPABASE_BILLING_SUMMARY_FAILED',error);
  const total=Number(data?.proof_total||0);
  return {...data,proofPage:{items:data?.proofs||[],total,page,pageSize,pageCount:Math.max(1,Math.ceil(total/pageSize))}};
}

export async function submitSupabasePaymentProof(user,amountEtb,reference,file){
  const amount=Number(amountEtb);
  if(!Number.isFinite(amount)||amount<=0)throw new Error('INVALID_ETB_AMOUNT');
  const stored=file&&typeof file.arrayBuffer==='function'&&file.size?await storePrivateUpload(file,'payment'):null;
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('submit_managed_payment_proof',{actor_user_id:user.id,command:{
    amount_minor:Math.round(amount*100),reference:String(reference||''),storage_path:stored?.path||'',
    original_name:stored?.originalName||'',mime_type:stored?.mimeType||''
  }});
  if(error){
    if(stored)await removePrivateUpload(stored.path).catch(()=>undefined);
    throw managedError('SUPABASE_PAYMENT_SUBMIT_FAILED',error);
  }
  return data;
}

export async function getSupabasePaymentProofFile(user,id){
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('managed_payment_proof_file',{actor_user_id:user.id,proof_id:id});
  if(error)throw managedError('SUPABASE_PAYMENT_FILE_FAILED',error);
  return data?{...data,file_path:data.storage_path}:null;
}

export async function listSupabasePaymentProofs(user,options={}){
  const pageSize=Math.max(1,Math.min(50,Number(options.pageSize)||12));
  const page=Math.max(1,Number(options.page)||1);
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('managed_payment_review_page',{actor_user_id:user.id,
    requested_status:String(options.status||'ALL'),search_text:String(options.q||''),
    requested_offset:(page-1)*pageSize,requested_limit:pageSize});
  if(error)throw managedError('SUPABASE_PAYMENT_REVIEW_PAGE_FAILED',error);
  return pageFromRows(data,{page,pageSize});
}

export async function reviewSupabasePaymentProof(user,id,status){
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('review_managed_payment_proof',{actor_user_id:user.id,proof_id:id,review_status:String(status||'')});
  if(error)throw managedError('SUPABASE_PAYMENT_REVIEW_FAILED',error);
  return data;
}
