import {
 CARGO_PHOTO_CLEANUP_PATH,CARGO_PHOTO_BACKGROUND_PATH,
 CARGO_PHOTO_TIMESTAMP_HEADER,CARGO_PHOTO_SIGNATURE_HEADER,
 cargoPhotoWorkerEnabled,createCargoPhotoSignature
} from '../../src/lib/cargo-photo-worker-auth.js';

export async function dispatchCargoPhotoCleanup({invocationUrl,environment=process.env,
 fetchImpl=fetch,now=Date.now()}={}){
 if(!cargoPhotoWorkerEnabled(environment))return {enabled:false};
 let invocation;
 try{invocation=new URL(String(invocationUrl||''));}catch{throw Error('CARGO_PHOTO_DISPATCH_INVALID');}
 if(invocation.origin!==new URL(environment.LOADGISTIC_CARGO_PHOTO_SITE_ORIGIN).origin
  ||invocation.pathname!==CARGO_PHOTO_CLEANUP_PATH||invocation.search||invocation.hash){
  throw Error('CARGO_PHOTO_DISPATCH_INVALID');
 }
 const target=new URL(CARGO_PHOTO_BACKGROUND_PATH,invocation.origin);
 const timestamp=String(now);
 const response=await fetchImpl(target,{
  method:'POST',redirect:'error',headers:{
   [CARGO_PHOTO_TIMESTAMP_HEADER]:timestamp,
   [CARGO_PHOTO_SIGNATURE_HEADER]:createCargoPhotoSignature({timestamp,url:target.href},environment)
  },signal:AbortSignal.timeout(8000)
 });
 if(!response.ok)throw Error('CARGO_PHOTO_DISPATCH_FAILED');
 return {enabled:true,status:response.status};
}

export async function executeCargoPhotoCleanupDispatch(request,options={}){
 try{
  const result=await dispatchCargoPhotoCleanup({invocationUrl:request?.url,...options});
  if(!result.enabled)return new Response(null,{status:204});
  console.info(JSON.stringify({event:'cargo-photo-cleanup-dispatch',ok:true,status:result.status}));
  return new Response(null,{status:202});
 }catch{
  console.error(JSON.stringify({event:'cargo-photo-cleanup-dispatch',ok:false,error:'DISPATCH_FAILED'}));
  return new Response(null,{status:500});
 }
}

export default async function(request){return executeCargoPhotoCleanupDispatch(request);}
export const config={schedule:'*/15 * * * *'};
