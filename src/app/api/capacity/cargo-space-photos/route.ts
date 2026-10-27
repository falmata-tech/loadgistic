import {photoActor,photoFailure,photoService,photoUploadInput,businessJson,oneId} from '@/lib/cargo-space-photo/http';
export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(request:Request){
 try{
  const actor=await photoActor(request,'cargo-photo-provider-read',90);
  const vehicleId=oneId(new URL(request.url).searchParams.get('vehicleId'));
  return businessJson(await photoService().providerState(actor,vehicleId));
 }catch(error){return photoFailure(error);}
}

export async function POST(request:Request){
 try{
  const actor=await photoActor(request,'cargo-photo-upload',3);
  const {command,file}=await photoUploadInput(request);
  return businessJson({photo:await photoService().upload(actor,command,file)},201);
 }catch(error){return photoFailure(error);}
}
