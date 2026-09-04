import {createHash} from 'node:crypto';
import {
  accessEmailDeliveryIsDeliverable,
  claimAccessEmailDelivery,
  listPendingAccessEmailDeliveries,
  recordAccessEmailDeliveryAttempt
} from './access-email.js';
import {buildEmailMessage} from './email-templates.js';
import {emailDeliveryStatus,sendManagedEmail} from './email-provider.js';
import {listPendingEmailDeliveries,recordEmailDeliveryAttempt} from './provider-tracking.js';
import {guestSupportAccessCode,providerTrackingOtpCode,reviewAccessCode,sharedCapacityOtpCode,trackingAccessCode} from './security.js';

export function emailDeliveryConfigured(environment=process.env){
  return emailDeliveryStatus(environment).configured;
}

export function localAccessCodeForDevelopment(challenge,delivery,environment=process.env.NODE_ENV){
  return environment!=='production'&&!delivery.configured&&challenge.deliveryQueued&&challenge.accessCode?challenge.accessCode:null;
}

const SHARED_CAPACITY_REQUEST_MESSAGE='Check your email for a one-time code.';
const SHARED_CAPACITY_NO_SHARE_MESSAGE='No transporter has shared capacity with this email yet. Ask a transporter to share capacity with this email address.';
const TRACKING_OTP_REQUEST_MESSAGE='Request received. A one-time code is sent only when this exact email is approved for that shipment. If no code arrives, confirm the email and Tracking code with your transporter.';

export function sharedCapacityOtpRequestResponse(challenge,{
  configured=emailDeliveryConfigured(),
  environment=process.env.NODE_ENV
}={}){
  if(!challenge.deliveryQueued){
    return {ok:true,verificationRequired:false,message:SHARED_CAPACITY_NO_SHARE_MESSAGE};
  }
  const localTestCode=localAccessCodeForDevelopment(challenge,{configured},environment);
  return localTestCode
    ?{ok:true,verificationRequired:true,message:'Email delivery is not configured in this local environment. Use the local test code below.',localTestCode}
    :{ok:true,verificationRequired:true,message:SHARED_CAPACITY_REQUEST_MESSAGE};
}

export function providerTrackingOtpRequestResponse(challenge,{
  configured=emailDeliveryConfigured(),
  environment=process.env.NODE_ENV
}={}){
  const localTestCode=localAccessCodeForDevelopment(challenge,{configured},environment);
  return localTestCode
    ?{ok:true,challengeId:challenge.challengeId,message:'Email delivery is not configured in this local environment. Use the local test code below.',localTestCode}
    :{ok:true,challengeId:challenge.challengeId,message:TRACKING_OTP_REQUEST_MESSAGE};
}

function publicUrl(path){
  return new URL(path,process.env.APP_URL||'http://127.0.0.1:3000').toString();
}

function idempotencyKey(scope,id){
  const digest=createHash('sha256').update(`${scope}:${String(id||'')}`).digest('hex');
  return `loadgistic/${scope}/${digest}`;
}

function safeFailure(error){
  const message=error instanceof Error?error.message:'DELIVERY_FAILED';
  return /^[A-Z0-9_:-]{1,120}$/.test(message)?message:'DELIVERY_FAILED';
}

export async function deliverPendingShipmentEmails(limit=10){
  const configuration=emailDeliveryStatus();
  if(!configuration.configured)return {configured:false,provider:'none',attempted:0,sent:0,failed:0,skipped:0};
  const deliveries=await listPendingEmailDeliveries(limit);
  let sent=0;
  for(const delivery of deliveries){
    try{
      const payload={
        template:delivery.delivery_kind==='TRACKING_ACCESS'?'tracking-started':'tracking-completed',
        to:delivery.recipient_email,
        customerRole:delivery.party_role==='SHIPPER'?'OWNER':'TRACKING_PARTY',
        tracking:delivery.delivery_kind==='TRACKING_ACCESS'?{url:publicUrl('/track'),code:trackingAccessCode(delivery.shipment_id)}:undefined,
        review:delivery.delivery_kind==='COMPLETION'?{url:publicUrl('/track'),code:reviewAccessCode(delivery.shipment_id)}:undefined,
        shipment:{
          code:delivery.code,providerName:delivery.provider_name,origin:delivery.origin,
          destination:delivery.destination,cargoSummary:delivery.cargo_summary,
          completedAt:delivery.completed_at,events:Array.isArray(delivery.events)?delivery.events:[]
        }
      };
      await sendManagedEmail(buildEmailMessage(payload),idempotencyKey('tracking',delivery.id));
      await recordEmailDeliveryAttempt(delivery.id,{sent:true});
      sent+=1;
    }catch(error){
      await recordEmailDeliveryAttempt(delivery.id,{sent:false,error:safeFailure(error)});
    }
  }
  return {configured:true,provider:configuration.provider,attempted:deliveries.length,sent,failed:deliveries.length-sent,skipped:0};
}

export async function deliverPendingAccessEmails(limit=10,{
  deliveryStatus=emailDeliveryStatus,
  listDeliveries=listPendingAccessEmailDeliveries,
  recordAttempt=recordAccessEmailDeliveryAttempt,
  recheckDelivery=accessEmailDeliveryIsDeliverable,
  sendEmail=sendManagedEmail
}={}){
  const configuration=deliveryStatus();
  if(!configuration.configured)return {configured:false,provider:'none',attempted:0,sent:0,failed:0,skipped:0};
  const boundedLimit=Math.max(1,Math.min(100,Number(limit)||10));
  const result={configured:true,provider:configuration.provider,attempted:0,sent:0,failed:0,skipped:0};
  for(let claimed=0;claimed<boundedLimit;claimed+=1){
    const deliveries=await listDeliveries(1);
    const delivery=Array.isArray(deliveries)?deliveries[0]:null;
    if(!delivery)break;
    const rowResult=await deliverAccessEmailRows([delivery],{configuration,recordAttempt,recheckDelivery,sendEmail});
    result.attempted+=rowResult.attempted;
    result.sent+=rowResult.sent;
    result.failed+=rowResult.failed;
    result.skipped+=rowResult.skipped;
  }
  return result;
}

export async function deliverTargetedAccessEmail(kind,entityId,{
  deliveryStatus=emailDeliveryStatus,
  claimDelivery=claimAccessEmailDelivery,
  recordAttempt=recordAccessEmailDeliveryAttempt,
  recheckDelivery=accessEmailDeliveryIsDeliverable,
  sendEmail=sendManagedEmail
}={}){
  const configuration=deliveryStatus();
  if(!configuration.configured)return {configured:false,provider:'none',attempted:0,sent:0,failed:0,skipped:0};
  const delivery=await claimDelivery(kind,entityId);
  return deliverAccessEmailRows(delivery?[delivery]:[],{configuration,recordAttempt,recheckDelivery,sendEmail});
}

async function deliverAccessEmailRows(deliveries,{configuration,recordAttempt,recheckDelivery,sendEmail}){
  let attempted=0,sent=0,failed=0,skipped=0;
  for(const delivery of deliveries){
    const leaseToken=delivery.lease_token;
    if(!leaseToken){
      skipped+=1;
      continue;
    }
    const shared=delivery.delivery_kind==='SHARED_CAPACITY';
    const tracking=delivery.delivery_kind==='TRACKING_OTP';
    const shortLived=shared||tracking;
    if(shortLived){
      const expiresAt=new Date(delivery.challenge_expires_at||0).getTime();
      if(!Number.isFinite(expiresAt)||expiresAt<=Date.now()+30_000){
        skipped+=1;
        continue;
      }
    }
    try{
      if(!await recheckDelivery(delivery.id,leaseToken)){
        skipped+=1;
        continue;
      }
    }catch{
      skipped+=1;
      continue;
    }
    attempted+=1;
    const payload={
      template:shared?'shared-capacity-access':tracking?'tracking-access-code':'assisted-matching-access',
      to:delivery.recipient_email,
      access:{
        url:publicUrl(shared?'/shared-capacity':tracking?'/track':'/help'),
        code:shared?sharedCapacityOtpCode(delivery.entity_id):tracking?providerTrackingOtpCode(delivery.entity_id):guestSupportAccessCode(delivery.entity_id)
      }
    };
    try{
      await sendEmail(buildEmailMessage(payload),idempotencyKey('access',delivery.id));
    }catch(error){
      let recorded=false;
      try{recorded=await recordAttempt(delivery.id,{leaseToken,sent:false,error:safeFailure(error)});}catch{
        throw new Error('ACCESS_EMAIL_FAILURE_RECORD_FAILED');
      }
      if(!recorded)throw new Error('ACCESS_EMAIL_FAILURE_RECORD_REJECTED');
      failed+=1;
      continue;
    }
    let recorded=false;
    try{recorded=await recordAttempt(delivery.id,{leaseToken,sent:true});}catch{
      throw new Error('ACCESS_EMAIL_SUCCESS_RECORD_FAILED');
    }
    if(!recorded)throw new Error('ACCESS_EMAIL_SUCCESS_RECORD_REJECTED');
    sent+=1;
  }
  return {configured:true,provider:configuration.provider,attempted,sent,failed,skipped};
}
