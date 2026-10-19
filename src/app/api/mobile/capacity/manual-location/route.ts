import {mobileActor,mobileJson,mobileFailure,MobileError} from '@/lib/mobile/server';
import {getCapacityLocationEditor} from '@/lib/telematics.js';
import {telematicsFailure} from '@/lib/telematics-http';
export const runtime='nodejs';
export async function GET(request:Request){
 try{
  const user=await mobileActor(request);
  const vehicleId=new URL(request.url).searchParams.get('vehicleId');
  if(!vehicleId||!(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).test(vehicleId))
   throw new MobileError(400,'INVALID_INPUT','Choose a vehicle.');
  return mobileJson(await getCapacityLocationEditor(user,vehicleId));
 }catch(error){return mobileFailure(telematicsFailure(error));}
}
