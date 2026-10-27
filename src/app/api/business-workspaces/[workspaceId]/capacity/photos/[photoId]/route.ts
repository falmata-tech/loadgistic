import {NextResponse} from 'next/server.js';
import {photoActor,photoFailure,photoService,businessJson} from '@/lib/cargo-space-photo/http';
import {privateDocumentHeaders} from '@/lib/private-storage.js';
import {privateFilePayload} from '@/lib/mobile/file-contract.js';
import {CargoPhotoError} from '@/lib/cargo-space-photo/server.js';
export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(request:Request,{params}:{params:Promise<{workspaceId:string;photoId:string}>}){
 try{
  const actor=await photoActor(request,'cargo-photo-file-read',60);
  const {workspaceId,photoId}=await params;
  const format=new URL(request.url).searchParams.get('format');
  if(format&&format!=='base64')throw new CargoPhotoError('CARGO_PHOTO_INVALID');
  const file=await photoService().businessFile(actor,workspaceId,photoId);
  if(format==='base64')return businessJson({...privateFilePayload(file.bytes,file.mimeType),receivedAt:file.receivedAt});
  return new NextResponse(file.bytes,{headers:{...privateDocumentHeaders('image/jpeg','cargo-space.jpg'),
   'CDN-Cache-Control':'no-store','Netlify-CDN-Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow, noimageindex'}});
 }catch(error){return photoFailure(error);}
}
