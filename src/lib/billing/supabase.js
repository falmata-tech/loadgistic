import {readWindowedPage} from '../pagination.js';
import {createSupabaseAdminClient} from '../supabase-adapter.js';

const ERRORS=['FORBIDDEN','SUBSCRIPTION_NOT_FOUND','PAYMENT_NOT_REQUIRED','INVALID_ETB_AMOUNT',
  'INVALID_PRIVATE_STORAGE_REFERENCE','PAYMENT_PROOF_ALREADY_REVIEWED','INVALID_STATUS','NOT_FOUND'];

function managedError(fallback,error){
  const message=String(error?.message||'');
  return new Error(ERRORS.find(code=>message.includes(code))||fallback,{cause:error});
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

export async function submitSupabasePaymentProof(_user,_amountEtb,_reference,_file){
  throw new Error('BILLING_RETIRED');
}

export async function getSupabasePaymentProofFile(user,id){
  const client=createSupabaseAdminClient();
  const {data,error}=await client.rpc('managed_payment_proof_file',{actor_user_id:user.id,proof_id:id});
  if(error)throw managedError('SUPABASE_PAYMENT_FILE_FAILED',error);
  return data?{...data,file_path:data.storage_path}:null;
}

export async function listSupabasePaymentProofs(user,options={}){
  const client=createSupabaseAdminClient();
  return readWindowedPage(async(offset,limit)=>{
    const {data,error}=await client.rpc('managed_payment_review_page',{actor_user_id:user.id,
      requested_status:String(options.status||'ALL'),search_text:String(options.q||''),
      requested_offset:offset,requested_limit:limit});
    if(error)throw managedError('SUPABASE_PAYMENT_REVIEW_PAGE_FAILED',error);
    return data||[];
  },options);
}

export async function reviewSupabasePaymentProof(_user,_id,_status){
  throw new Error('BILLING_RETIRED');
}
