import {photoActor,photoFailure,photoService,businessJson,oneId} from '@/lib/cargo-space-photo/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(request:Request,{params}:{params:Promise<{workspaceId:string}>}){
 try{
  const actor=await photoActor(request,'cargo-photo-business-read',120);
  const vehicleId=oneId(new URL(request.url).searchParams.get('vehicleId'));
  return businessJson(await photoService().businessState(actor,(await params).workspaceId,vehicleId));
 }catch(error){return photoFailure(error);}
}
