import {businessActorIdentity,businessFailure,businessJson,businessLimit,businessBody,BusinessHttpError} from '../business-workspaces/http';
import {CargoPhotoError,cargoPhotoService} from './server.js';
import {readMobileMultipart} from '../mobile/file-contract.js';

export {businessJson};
const uploadInputCodes=new Set(['PHOTO_IMAGE_INVALID','PHOTO_REQUIRED','FILE_TOO_LARGE','INVALID_UPLOAD','MULTIPART_REQUIRED']);
export function photoFailure(error:unknown):Response{
 if(error instanceof CargoPhotoError){
  const status=error.code==='CARGO_PHOTO_INVALID'||error.code==='PHOTO_IMAGE_INVALID'||error.code==='PHOTO_REQUIRED'||error.code==='INVALID_UPLOAD'||error.code==='MULTIPART_REQUIRED'?400:
   error.code==='FILE_TOO_LARGE'?413:error.code==='CARGO_PHOTO_RATE_LIMITED'?429:
   error.code==='CARGO_PHOTO_FORBIDDEN'?403:error.code==='CARGO_PHOTO_NOT_FOUND'?404:503;
  const message=status===429?'A new photo was requested recently.':status===413?'Choose a smaller photo.':
   status===400?'Choose a supported photo and try again.':status===403?'You do not have access to this photo.':
   status===404?'This photo is no longer available.':'The photo is temporarily unavailable.';
  return businessJson({error:{code:status===503?'CARGO_PHOTO_UNAVAILABLE':error.code,message}},status);
 }
 if(error instanceof Error&&uploadInputCodes.has(error.message)){
  return photoFailure(new CargoPhotoError(error.message));
 }
 return businessFailure(error);
}
export async function photoActor(request:Request,scope:string,limit=60){
 const actor=await businessActorIdentity(request);
 await businessLimit(actor.id,scope,limit);
 return actor.id;
}
export async function photoUploadInput(request:Request){
 try{return await readMobileMultipart(request);}
 catch(error){throw new CargoPhotoError(error instanceof Error&&uploadInputCodes.has(error.message)?error.message:'CARGO_PHOTO_UNAVAILABLE');}
}
export async function photoRequestInput(request:Request){
 return await businessBody(request);
}
export function photoService(){return cargoPhotoService();}
export function oneId(value:string|null){
 if(!value)throw new BusinessHttpError(400,'INVALID_BUSINESS_INPUT');
 return value;
}
