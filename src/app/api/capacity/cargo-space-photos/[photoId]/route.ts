import {photoActor,photoFailure,photoService,businessJson} from '@/lib/cargo-space-photo/http';
import {NextResponse} from 'next/server.js';
import {privateDocumentHeaders} from '@/lib/private-storage.js';
import {privateFilePayload} from '@/lib/mobile/file-contract.js';
import {CargoPhotoError} from '@/lib/cargo-space-photo/server.js';
export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(request:Request,{params}:{params:Promise<{photoId:string}>}){
 try{
  const actor=await photoActor(request,'cargo-photo-provider-file',60);
  const format=new URL(request.url).searchParams.get('format');
  if(format&&format!=='base64')throw new CargoPhotoError('CARGO_PHOTO_INVALID');
  const file=await photoService().providerFile(actor,(await params).photoId);
  if(format==='base64')return businessJson({...privateFilePayload(file.bytes,file.mimeType),receivedAt:file.receivedAt});
  return new NextResponse(file.bytes,{headers:{...privateDocumentHeaders('image/jpeg','cargo-space.jpg'),
   'CDN-Cache-Control':'no-store','Netlify-CDN-Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow, noimageindex'}});
 }catch(error){return photoFailure(error);}
}

export async function DELETE(request:Request,{params}:{params:Promise<{photoId:string}>}){
 try{
  const actor=await photoActor(request,'cargo-photo-remove',12);
  return businessJson(await photoService().remove(actor,(await params).photoId));
 }catch(error){return photoFailure(error);}
}
