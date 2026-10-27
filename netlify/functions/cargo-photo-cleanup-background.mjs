import {cargoPhotoService} from '../../src/lib/cargo-space-photo/server.js';
import {
 CARGO_PHOTO_TIMESTAMP_HEADER,CARGO_PHOTO_SIGNATURE_HEADER,verifyCargoPhotoSignature
} from '../../src/lib/cargo-photo-worker-auth.js';

export async function executeCargoPhotoCleanup(request,{environment=process.env,
 serviceFactory=cargoPhotoService,now=Date.now()}={}){
 const authorized=request?.method==='POST'&&verifyCargoPhotoSignature({
  timestamp:request.headers.get(CARGO_PHOTO_TIMESTAMP_HEADER),
  signature:request.headers.get(CARGO_PHOTO_SIGNATURE_HEADER),url:request.url
 },environment,now);
 if(!authorized)return new Response(null,{status:401});
 try{
  const result=await serviceFactory().cleanup(5);
  console.info(JSON.stringify({event:'cargo-photo-cleanup',ok:true,
   attempted:result.attempted,deleted:result.deleted}));
  return new Response(null,{status:204});
 }catch{
  console.error(JSON.stringify({event:'cargo-photo-cleanup',ok:false,error:'CLEANUP_FAILED'}));
  return new Response(null,{status:500});
 }
}

export default async function(request){return executeCargoPhotoCleanup(request);}
export const config={background:true};
