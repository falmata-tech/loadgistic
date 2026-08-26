import {createHash} from 'node:crypto';
import {listPendingAccessEmailDeliveries,recordAccessEmailDeliveryAttempt} from './access-email.js';
import {buildEmailMessage} from './email-templates.js';
import {emailDeliveryStatus,sendManagedEmail} from './email-provider.js';
import {listPendingEmailDeliveries,recordEmailDeliveryAttempt} from './provider-tracking.js';
import {guestSupportAccessCode,reviewAccessCode,sharedCapacityOtpCode,trackingAccessCode} from './security.js';

export function emailDeliveryConfigured(environment=process.env){
  return emailDeliveryStatus(environment).configured;
}

export function localAccessCodeForDevelopment(challenge,delivery,environment=process.env.NODE_ENV){
  return environment!=='production'&&!delivery.configured&&challenge.deliveryQueued&&challenge.accessCode?challenge.accessCode:null;
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
  if(!configuration.configured)return {configured:false,provider:'none',attempted:0,sent:0,failed:0};
  const deliveries=await listPendingEmailDeliveries(limit);
  let sent=0;
  for(const delivery of deliveries){
    try{
      const payload={
        template:delivery.delivery_kind==='TRACKING_ACCESS'?'tracking-started':'tracking-completed',
        to:delivery.recipient_email,
        customerRole:'OWNER',
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
  return {configured:true,provider:configuration.provider,attempted:deliveries.length,sent,failed:deliveries.length-sent};
}

export async function deliverPendingAccessEmails(limit=10){
  const configuration=emailDeliveryStatus();
  if(!configuration.configured)return {configured:false,provider:'none',attempted:0,sent:0,failed:0};
  const deliveries=await listPendingAccessEmailDeliveries(limit);
  let sent=0;
  for(const delivery of deliveries){
    const shared=delivery.delivery_kind==='SHARED_CAPACITY';
    try{
      const payload={
        template:shared?'shared-capacity-access':'assisted-matching-access',
        to:delivery.recipient_email,
        access:{
          url:publicUrl(shared?'/shared-capacity':'/help'),
          code:shared?sharedCapacityOtpCode(delivery.entity_id):guestSupportAccessCode(delivery.entity_id)
        }
      };
      await sendManagedEmail(buildEmailMessage(payload),idempotencyKey('access',delivery.id));
      await recordAccessEmailDeliveryAttempt(delivery.id,{sent:true});
      sent+=1;
    }catch(error){
      await recordAccessEmailDeliveryAttempt(delivery.id,{sent:false,error:safeFailure(error)});
    }
  }
  return {configured:true,provider:configuration.provider,attempted:deliveries.length,sent,failed:deliveries.length-sent};
}
