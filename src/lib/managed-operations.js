import {cleanupSupportAttachments} from './support-attachments.js';
import {deliverPendingAccessEmails,deliverPendingShipmentEmails} from './email-delivery.js';
import {purgeExpiredSharedCapacityAccess} from './access-email.js';
import {purgeExpiredProviderShipmentGuests} from './provider-tracking.js';
import {purgeExpiredRateLimits} from './rate-limit.js';
import {prepareAutomaticFeaturedDays} from './featured-automation.js';
import {cleanupDriverPortraitUploads} from './driver-portrait-storage.js';

async function run(name,operation){
  try{return {name,ok:true,result:operationResult(name,await operation())};}
  catch(error){return {name,ok:false,error:safeOperationError(error)};}
}

function safeOperationError(error){
  const message=error instanceof Error?error.message:'OPERATION_FAILED';
  return /^[A-Z0-9_:-]{1,120}$/.test(message)?message:'OPERATION_FAILED';
}

function operationResult(name,result){
  if(name==='driver-portrait-cleanup'||name==='support-attachment-cleanup')return {attempted:Math.max(0,Number(result?.attempted)||0),deleted:Math.max(0,Number(result?.deleted)||0),failed:Math.max(0,Number(result?.failed)||0)};
  if(name==='featured-rosters')return {created:Math.max(0,Number(result?.created)||0),skipped:Math.max(0,Number(result?.skipped)||0),empty:Math.max(0,Number(result?.empty)||0)};
  if(name==='shared-capacity-cleanup'){
    return {
      otpCount:Math.max(0,Number(result?.otpCount)||0),
      deliveryCount:Math.max(0,Number(result?.deliveryCount)||0)
    };
  }
  if(name==='tracking-guest-cleanup'||name==='rate-limit-cleanup'){
    const count=typeof result==='number'?result:result?.count;
    return {count:Math.max(0,Number(count)||0)};
  }
  return {
    configured:Boolean(result?.configured),
    provider:String(result?.provider||'none'),
    attempted:Math.max(0,Number(result?.attempted)||0),
    sent:Math.max(0,Number(result?.sent)||0),
    failed:Math.max(0,Number(result?.failed)||0),
    skipped:Math.max(0,Number(result?.skipped)||0)
  };
}

const operationNames=new Set([
  'tracking-email','access-email','tracking-guest-cleanup','shared-capacity-cleanup','rate-limit-cleanup','featured-rosters','driver-portrait-cleanup','support-attachment-cleanup'
]);

export function managedOperationsSummary(result){
  const operations=Array.isArray(result?.operations)?result.operations:[];
  const safeOperations=operations.map(operation=>{
    const name=operationNames.has(operation?.name)?operation.name:'unknown';
    if(name==='unknown')return {name,ok:false,error:'OPERATION_FAILED'};
    if(!operation?.ok)return {name,ok:false,error:safeOperationError(new Error(String(operation?.error||'OPERATION_FAILED')))};
    return {name,ok:true,result:operationResult(name,operation?.result)};
  });
  return {ok:Boolean(result?.ok)&&safeOperations.every(operation=>operation.ok),operations:safeOperations};
}

export async function runManagedOperations({
  emailLimit=25,cleanupLimit=100,
  deliverShipment=deliverPendingShipmentEmails,
  deliverAccess=deliverPendingAccessEmails,
  purgeGuests=purgeExpiredProviderShipmentGuests,
  purgeSharedCapacity=purgeExpiredSharedCapacityAccess,
  purgeRateLimits=purgeExpiredRateLimits,
  prepareFeatured=prepareAutomaticFeaturedDays,
  purgeAttachments=cleanupSupportAttachments,purgePortraits=cleanupDriverPortraitUploads
}={}){
  const boundedEmail=Math.max(1,Math.min(100,Number(emailLimit)||25));
  const boundedCleanup=Math.max(1,Math.min(500,Number(cleanupLimit)||100));
  const operations=[];
  operations.push(await run('tracking-email',()=>deliverShipment(boundedEmail)));
  operations.push(await run('access-email',()=>deliverAccess(boundedEmail)));
  operations.push(await run('tracking-guest-cleanup',()=>purgeGuests(boundedCleanup)));
  operations.push(await run('shared-capacity-cleanup',()=>purgeSharedCapacity(boundedCleanup)));
  operations.push(await run('rate-limit-cleanup',()=>purgeRateLimits(boundedCleanup)));
  operations.push(await run('featured-rosters',()=>prepareFeatured()));
  operations.push(await run('driver-portrait-cleanup',()=>purgePortraits(boundedCleanup)));
  operations.push(await run('support-attachment-cleanup',()=>purgeAttachments(20)));
  return managedOperationsSummary({ok:operations.every(operation=>operation.ok),operations});
}
