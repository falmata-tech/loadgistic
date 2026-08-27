import {deliverPendingAccessEmails,deliverPendingShipmentEmails} from './email-delivery.js';
import {purgeExpiredProviderShipmentGuests} from './provider-tracking.js';
import {purgeExpiredRateLimits} from './rate-limit.js';

async function run(name,operation){
  try{return {name,ok:true,result:operationResult(name,await operation())};}
  catch(error){return {name,ok:false,error:safeOperationError(error)};}
}

function safeOperationError(error){
  const message=error instanceof Error?error.message:'OPERATION_FAILED';
  return /^[A-Z0-9_:-]{1,120}$/.test(message)?message:'OPERATION_FAILED';
}

function operationResult(name,result){
  if(name==='tracking-guest-cleanup'||name==='rate-limit-cleanup'){
    const count=typeof result==='number'?result:result?.count;
    return {count:Math.max(0,Number(count)||0)};
  }
  return {
    configured:Boolean(result?.configured),
    provider:String(result?.provider||'none'),
    attempted:Math.max(0,Number(result?.attempted)||0),
    sent:Math.max(0,Number(result?.sent)||0),
    failed:Math.max(0,Number(result?.failed)||0)
  };
}

export async function runManagedOperations({
  emailLimit=25,cleanupLimit=100,
  deliverShipment=deliverPendingShipmentEmails,
  deliverAccess=deliverPendingAccessEmails,
  purgeGuests=purgeExpiredProviderShipmentGuests,
  purgeRateLimits=purgeExpiredRateLimits
}={}){
  const boundedEmail=Math.max(1,Math.min(100,Number(emailLimit)||25));
  const boundedCleanup=Math.max(1,Math.min(500,Number(cleanupLimit)||100));
  const operations=[];
  operations.push(await run('tracking-email',()=>deliverShipment(boundedEmail)));
  operations.push(await run('access-email',()=>deliverAccess(boundedEmail)));
  operations.push(await run('tracking-guest-cleanup',()=>purgeGuests(boundedCleanup)));
  operations.push(await run('rate-limit-cleanup',()=>purgeRateLimits(boundedCleanup)));
  return {ok:operations.every(operation=>operation.ok),operations};
}
