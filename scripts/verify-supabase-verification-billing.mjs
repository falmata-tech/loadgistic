import crypto from 'node:crypto';
import {createClient} from '@supabase/supabase-js';

const url=String(process.env.SUPABASE_SEED_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'').trim();
const serviceRoleKey=String(process.env.SUPABASE_SEED_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'').trim();
const anonKey=String(process.env.SUPABASE_SEED_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||'').trim();
if(!url||!serviceRoleKey||!anonKey)throw new Error('SUPABASE_VERIFICATION_BILLING_VERIFY_CONFIG_MISSING');
if(!new Set(['127.0.0.1','localhost','::1']).has(new URL(url).hostname))throw new Error('REMOTE_VERIFICATION_BILLING_VERIFY_REFUSED');
const service=createClient(url,serviceRoleKey,{auth:{autoRefreshToken:false,persistSession:false}});
const anon=createClient(url,anonKey,{auth:{autoRefreshToken:false,persistSession:false}});

async function expectRpcError(call,code){
  const {error}=await call();
  if(!error||!String(error.message).includes(code))throw new Error(`EXPECTED_RPC_REJECTION_MISSING:${code}`);
}

const suffix=crypto.randomUUID().slice(0,12);
const email=`managed-verify-${suffix}@loadgistic.local`;
let actorId;let organizationId;let subscriptionId;let verificationId;let proofId;
try{
  const {data:created,error:createError}=await service.auth.admin.createUser({email,password:crypto.randomBytes(24).toString('base64url'),email_confirm:true});
  if(createError||!created.user)throw new Error('VERIFICATION_BILLING_TEST_ACTOR_CREATE_FAILED');
  actorId=created.user.id;organizationId=crypto.randomUUID();subscriptionId=crypto.randomUUID();
  const {data:plan,error:planError}=await service.from('plans').select('id').eq('audience','TRANSPORTER').eq('active',true).limit(1).maybeSingle();
  if(planError||!plan)throw new Error('VERIFICATION_BILLING_PLAN_MISSING');
  const now=new Date();const endsAt=new Date(now.getTime()+7*86400000).toISOString();
  for(const [table,rows] of [
    ['profiles',[{id:actorId,email,full_name:'Managed Verification Test',role:'TRANSPORTER',active:true}]],
    ['organizations',[{id:organizationId,name:'Managed Verification Test Fleet',handle:`managed-verify-${suffix}`,type:'TRANSPORT_COMPANY'}]],
    ['organization_members',[{id:crypto.randomUUID(),user_id:actorId,organization_id:organizationId,membership_role:'OWNER'}]],
    ['applications',[{id:crypto.randomUUID(),user_id:actorId,business_name:'Managed Verification Test Fleet',application_type:'TRANSPORT_COMPANY',status:'APPROVED',sponsored_free:false}]],
    ['subscriptions',[{id:subscriptionId,organization_id:organizationId,plan_id:plan.id,status:'TRIAL',billing_model:'FLAT_MONTHLY',starts_at:now.toISOString(),ends_at:endsAt}]]
  ]){
    const operation=table==='profiles'?service.from(table).upsert(rows,{onConflict:'id'}):service.from(table).insert(rows);
    const {error}=await operation;if(error)throw new Error(`VERIFICATION_BILLING_FIXTURE_${table.toUpperCase()}_FAILED`);
  }
  const {data:admin,error:adminError}=await service.from('profiles').select('id').eq('role','ADMIN').eq('active',true).limit(1).maybeSingle();
  if(adminError||!admin)throw new Error('VERIFICATION_BILLING_ADMIN_MISSING');

  const {data:center,error:centerError}=await service.rpc('managed_verification_center',{actor_user_id:actorId});
  if(centerError||center?.subjects?.length!==1||JSON.stringify(center).includes('storage_path'))throw new Error('VERIFICATION_CENTER_PROJECTION_INVALID');
  const {data:submitted,error:submitError}=await service.rpc('submit_managed_verification',{actor_user_id:actorId,command:{
    subject_type:'ORGANIZATION',subject_id:organizationId,verification_type:'IDENTITY',document_name:'National ID',
    storage_path:`supabase://verification/verification/${new Date().toISOString().slice(0,10)}/${suffix}.pdf`,
    original_name:'national-id.pdf',mime_type:'application/pdf'
  }});
  if(submitError||!submitted)throw new Error(`VERIFICATION_SUBMISSION_FAILED:${String(submitError?.message||'EMPTY_RESULT').slice(0,180)}`);
  verificationId=submitted;
  const {data:ownerFile,error:ownerFileError}=await service.rpc('managed_verification_file',{actor_user_id:actorId,request_id:verificationId});
  if(ownerFileError||!ownerFile?.storage_path)throw new Error('VERIFICATION_OWNER_FILE_DENIED');
  const {data:reviewRows,error:reviewPageError}=await service.rpc('managed_verification_review_page',{actor_user_id:admin.id,requested_status:'PENDING',search_text:'Managed Verification',requested_offset:0,requested_limit:5});
  if(reviewPageError||reviewRows?.length!==1||JSON.stringify(reviewRows).includes('storage_path'))throw new Error('VERIFICATION_REVIEW_PAGE_INVALID');
  const {error:reviewError}=await service.rpc('review_managed_verification',{actor_user_id:admin.id,request_id:verificationId,review_status:'APPROVED',review_note:'Verifier test'});
  if(reviewError)throw new Error(`VERIFICATION_REVIEW_FAILED:${String(reviewError.message||'UNKNOWN').slice(0,180)}`);
  await expectRpcError(()=>service.rpc('review_managed_verification',{actor_user_id:admin.id,request_id:verificationId,review_status:'REJECTED',review_note:''}),'VERIFICATION_ALREADY_REVIEWED');

  const {data:billing,error:billingError}=await service.rpc('managed_billing_summary',{actor_user_id:actorId,requested_offset:0,requested_limit:5});
  if(billingError||billing?.subscription?.id!==subscriptionId||JSON.stringify(billing).includes('file_path'))throw new Error('BILLING_SUMMARY_INVALID');
  const {data:submittedProof,error:proofError}=await service.rpc('submit_managed_payment_proof',{actor_user_id:actorId,command:{
    amount_minor:10000,reference:'VERIFIER',storage_path:`supabase://payment-proof/payment/${new Date().toISOString().slice(0,10)}/${suffix}.pdf`,
    original_name:'payment.pdf',mime_type:'application/pdf'
  }});
  if(proofError||!submittedProof)throw new Error('PAYMENT_PROOF_SUBMISSION_FAILED');
  proofId=submittedProof;
  const {data:proofFile,error:proofFileError}=await service.rpc('managed_payment_proof_file',{actor_user_id:actorId,proof_id:proofId});
  if(proofFileError||!proofFile?.storage_path)throw new Error('PAYMENT_PROOF_OWNER_FILE_DENIED');
  const {data:paymentRows,error:paymentPageError}=await service.rpc('managed_payment_review_page',{actor_user_id:admin.id,requested_status:'PENDING',search_text:'VERIFIER',requested_offset:0,requested_limit:5});
  if(paymentPageError||paymentRows?.length!==1||JSON.stringify(paymentRows).includes('file_path'))throw new Error('PAYMENT_REVIEW_PAGE_INVALID');
  const {error:paymentReviewError}=await service.rpc('review_managed_payment_proof',{actor_user_id:admin.id,proof_id:proofId,review_status:'APPROVED'});
  if(paymentReviewError)throw new Error('PAYMENT_REVIEW_FAILED');
  await expectRpcError(()=>service.rpc('review_managed_payment_proof',{actor_user_id:admin.id,proof_id:proofId,review_status:'REJECTED'}),'PAYMENT_PROOF_ALREADY_REVIEWED');

  for(const [name,args] of [
    ['managed_verification_center',{actor_user_id:actorId}],
    ['managed_verification_file',{actor_user_id:actorId,request_id:verificationId}],
    ['managed_billing_summary',{actor_user_id:actorId,requested_offset:0,requested_limit:5}],
    ['managed_payment_proof_file',{actor_user_id:actorId,proof_id:proofId}]
  ]){
    const {error}=await anon.rpc(name,args);if(!error)throw new Error(`ANONYMOUS_RPC_ALLOWED:${name}`);
  }
  process.stdout.write('Supabase Verification/Billing ownership, private-file authorization, bounded review, terminal review, safe projection, and browser denial checks passed.\n');
}finally{
  if(verificationId)await service.from('verification_requests').delete().eq('id',verificationId);
  if(proofId)await service.from('payment_proofs').delete().eq('id',proofId);
  if(actorId)await service.from('audit_logs').delete().eq('actor_user_id',actorId);
  if(subscriptionId)await service.from('subscriptions').delete().eq('id',subscriptionId);
  if(organizationId)await service.from('organizations').delete().eq('id',organizationId);
  if(actorId)await service.auth.admin.deleteUser(actorId);
}
