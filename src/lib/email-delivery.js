import { listPendingAccessEmailDeliveries, recordAccessEmailDeliveryAttempt } from './repository.js';
import { listPendingEmailDeliveries, recordEmailDeliveryAttempt } from './provider-tracking.js';
import { guestSupportAccessCode, reviewAccessCode, sharedCapacityOtpCode, trackingAccessCode } from './security.js';

export function emailDeliveryConfigured(){
  return Boolean(process.env.LOADGISTIC_EMAIL_WEBHOOK_URL);
}

export function localAccessCodeForDevelopment(challenge,delivery,environment=process.env.NODE_ENV){
  return environment!=='production'&&!delivery.configured&&challenge.deliveryQueued&&challenge.accessCode?challenge.accessCode:null;
}

function publicUrl(path){
  return new URL(path,process.env.APP_URL||'http://127.0.0.1:3000').toString();
}

export async function deliverPendingShipmentEmails(limit=10){
  const endpoint=process.env.LOADGISTIC_EMAIL_WEBHOOK_URL;
  if(!endpoint)return {configured:false,attempted:0,sent:0};
  const deliveries=await listPendingEmailDeliveries(limit);
  let sent=0;
  for(const delivery of deliveries){
    try{
      const response=await fetch(endpoint,{
        method:'POST',
        headers:{
          'content-type':'application/json',
          'idempotency-key':delivery.idempotency_key,
          ...(process.env.LOADGISTIC_EMAIL_WEBHOOK_TOKEN?{authorization:`Bearer ${process.env.LOADGISTIC_EMAIL_WEBHOOK_TOKEN}`}:{})
        },
        body:JSON.stringify({
          template:delivery.delivery_kind==='TRACKING_ACCESS'?'tracking-started':'tracking-completed',
          to:delivery.recipient_email,
          customerRole:'OWNER',
          tracking:delivery.delivery_kind==='TRACKING_ACCESS'?{url:publicUrl('/track'),code:trackingAccessCode(delivery.shipment_id)}:undefined,
          review:delivery.delivery_kind==='COMPLETION'?{url:publicUrl('/track'),code:reviewAccessCode(delivery.shipment_id)}:undefined,
          shipment:{code:delivery.code,providerName:delivery.provider_name,origin:delivery.origin,destination:delivery.destination,cargoSummary:delivery.cargo_summary,completedAt:delivery.completed_at}
        }),
        signal:AbortSignal.timeout(8000)
      });
      if(!response.ok)throw new Error(`HTTP_${response.status}`);
      await recordEmailDeliveryAttempt(delivery.id,{sent:true});
      sent+=1;
    }catch(error){
      await recordEmailDeliveryAttempt(delivery.id,{sent:false,error:error instanceof Error?error.message:'DELIVERY_FAILED'});
    }
  }
  return {configured:true,attempted:deliveries.length,sent};
}

export async function deliverPendingAccessEmails(limit=10){
  const endpoint=process.env.LOADGISTIC_EMAIL_WEBHOOK_URL;
  if(!endpoint)return {configured:false,attempted:0,sent:0};
  const deliveries=await listPendingAccessEmailDeliveries(limit);
  let sent=0;
  for(const delivery of deliveries){
    const shared=delivery.delivery_kind==='SHARED_CAPACITY';
    try{
      const response=await fetch(endpoint,{
        method:'POST',
        headers:{
          'content-type':'application/json',
          'idempotency-key':`access:${delivery.delivery_kind}:${delivery.entity_id}:${delivery.recipient_email}`,
          ...(process.env.LOADGISTIC_EMAIL_WEBHOOK_TOKEN?{authorization:`Bearer ${process.env.LOADGISTIC_EMAIL_WEBHOOK_TOKEN}`}:{})
        },
        body:JSON.stringify({
          template:shared?'shared-capacity-access':'assisted-matching-access',
          to:delivery.recipient_email,
          access:{
            url:publicUrl(shared?'/shared-capacity':'/help'),
            code:shared?sharedCapacityOtpCode(delivery.entity_id):guestSupportAccessCode(delivery.entity_id)
          }
        }),
        signal:AbortSignal.timeout(8000)
      });
      if(!response.ok)throw new Error(`HTTP_${response.status}`);
      await recordAccessEmailDeliveryAttempt(delivery.id,{sent:true});
      sent+=1;
    }catch(error){
      await recordAccessEmailDeliveryAttempt(delivery.id,{sent:false,error:error instanceof Error?error.message:'DELIVERY_FAILED'});
    }
  }
  return {configured:true,attempted:deliveries.length,sent};
}
