import {photoActor,photoFailure,photoService,photoRequestInput,businessJson} from '@/lib/cargo-space-photo/http';
export const runtime='nodejs';

export async function POST(request:Request,{params}:{params:Promise<{workspaceId:string}>}){
 try{
  const actor=await photoActor(request,'cargo-photo-request',10);
  const body=await photoRequestInput(request);
  const value=await photoService().request(actor,(await params).workspaceId,
   body.vehicleId as string,body.idempotencyKey as string);
  return businessJson(value,value.created?201:200);
 }catch(error){return photoFailure(error);}
}
