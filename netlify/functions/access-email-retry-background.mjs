import {deliverPendingAccessEmails} from '../../src/lib/email-delivery.js';
import {
  MANAGED_OPERATIONS_SIGNATURE_HEADER,
  MANAGED_OPERATIONS_TIMESTAMP_HEADER,
  verifyManagedOperationsSignature
} from '../../src/lib/managed-operations-auth.js';

function safeSummary(result={}){
  return {
    configured:Boolean(result.configured),
    provider:['resend','smtp','webhook','none'].includes(result.provider)?result.provider:'none',
    attempted:Math.max(0,Number(result.attempted)||0),
    sent:Math.max(0,Number(result.sent)||0),
    failed:Math.max(0,Number(result.failed)||0),
    skipped:Math.max(0,Number(result.skipped)||0)
  };
}

export async function executeAccessEmailRetry(request,{
  environment=process.env,deliver=deliverPendingAccessEmails,now=Date.now()
}={}){
  const authorized=request?.method==='POST'&&verifyManagedOperationsSignature({
    timestamp:request.headers.get(MANAGED_OPERATIONS_TIMESTAMP_HEADER),
    signature:request.headers.get(MANAGED_OPERATIONS_SIGNATURE_HEADER),
    audience:request.url
  },environment,now);
  if(!authorized){
    console.warn(JSON.stringify({event:'access-email-retry-background',ok:false,error:'UNAUTHORIZED'}));
    return new Response(null,{status:401});
  }
  try{
    const result=safeSummary(await deliver(2));
    console.info(JSON.stringify({event:'access-email-retry-background',ok:true,...result}));
  }catch{
    console.error(JSON.stringify({event:'access-email-retry-background',ok:false,error:'OPERATION_FAILED'}));
  }
  return new Response(null,{status:204});
}

export default async function(request){
  return executeAccessEmailRetry(request);
}

export const config={background:true};
