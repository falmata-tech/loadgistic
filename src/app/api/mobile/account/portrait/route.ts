import { mobileActor,mobileBody,mobileFailure,mobileJson,MobileError } from '@/lib/mobile/server';
import { mobileUpload,fileFailure } from '@/lib/mobile/file-server';
import { portraitUpload,portraitRemove } from '@/lib/mobile/portrait-contract.js';
import { getDriverPortraitWorkspace,updateDriverPortrait,removeDriverPortrait } from '@/lib/driver-portrait-storage.js';
import { publicAsset } from '@/lib/mobile/public-contract.js';
import { checkRateLimit } from '@/lib/rate-limit';
export const runtime='nodejs';
async function driver(request:Request){const actor=await mobileActor(request,true);if(actor.role!=='DRIVER')throw new MobileError(403,'FORBIDDEN','Only a driver can manage their own public photo.');return actor;}
export async function GET(request:Request){try{const actor=await driver(request),data=await getDriverPortraitWorkspace(actor);return mobileJson({image:publicAsset(data.imageUrl),hasPortrait:data.hasPortrait});}catch(error){return mobileFailure(error);}}
export async function POST(request:Request){try{
 const actor=await driver(request),rate=await checkRateLimit(`mobile-driver-portrait:${actor.id}`,8,600000);if(!rate.allowed)throw new MobileError(429,'PLEASE_WAIT','Please wait before changing your photo again.');
 try{
  if(request.headers.get('content-type')?.startsWith('multipart/form-data')){const upload=await mobileUpload(request);if(!portraitUpload.safeParse(upload.command).success)throw new MobileError(400,'CONSENT_REQUIRED','Confirm that this photo may appear publicly.');await updateDriverPortrait(actor,upload.file,true);}
  else{if(!portraitRemove.safeParse(await mobileBody(request)).success)throw new MobileError(400,'CONFIRM_REQUIRED','Confirm removal of your public photo.');await removeDriverPortrait(actor);}
 }catch(error){if(error instanceof Error&&['PORTRAIT_IMAGE_INVALID','PORTRAIT_REQUIRED'].includes(error.message))throw new MobileError(400,'INVALID_IMAGE','Choose a valid JPG, PNG or WebP photo.');if(error instanceof Error&&error.message==='PORTRAIT_UPLOAD_BUSY')throw new MobileError(409,'PLEASE_WAIT','Your previous photo is still being saved. Refresh before trying again.');fileFailure(error);}
 return mobileJson({ok:true});
}catch(error){return mobileFailure(error);}}
