import { listPendingEmailDeliveries, recordEmailDeliveryAttempt } from './repository.js';

type PendingDelivery={
  id:string;
  idempotency_key:string;
  recipient_email:string;
  party_role:'SHIPPER'|'RECEIVER';
  code:string;
  provider_name:string;
  origin:string;
  destination:string;
  cargo_summary:string;
  completed_at:string|null;
};

export function emailDeliveryConfigured(){
  return Boolean(process.env.LOADGISTIC_EMAIL_WEBHOOK_URL);
}

export async function deliverPendingShipmentEmails(limit=10){
  const endpoint=process.env.LOADGISTIC_EMAIL_WEBHOOK_URL;
  if(!endpoint)return {configured:false,attempted:0,sent:0};
  const deliveries=listPendingEmailDeliveries(limit) as PendingDelivery[];
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
          template:'shipment-completed',
          to:delivery.recipient_email,
          partyRole:delivery.party_role,
          shipment:{code:delivery.code,providerName:delivery.provider_name,origin:delivery.origin,destination:delivery.destination,cargoSummary:delivery.cargo_summary,completedAt:delivery.completed_at}
        }),
        signal:AbortSignal.timeout(8000)
      });
      if(!response.ok)throw new Error(`HTTP_${response.status}`);
      recordEmailDeliveryAttempt(delivery.id,{sent:true});
      sent+=1;
    }catch(error){
      recordEmailDeliveryAttempt(delivery.id,{sent:false,error:error instanceof Error?error.message:'DELIVERY_FAILED'});
    }
  }
  return {configured:true,attempted:deliveries.length,sent};
}
