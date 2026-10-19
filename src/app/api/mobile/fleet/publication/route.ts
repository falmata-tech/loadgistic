import {z} from 'zod';
import {mobileActor,mobileBody,mobileFailure,mobileJson,MobileError} from '@/lib/mobile/server';
import {getProviderPublication,setProviderVehiclePublication} from '@/lib/provider-authority.js';
const command=z.object({vehicleId:z.string().uuid(),state:z.enum(['LIVE','DRAFT'])}).strict();
export async function GET(request:Request){
  try{return mobileJson(await getProviderPublication(await mobileActor(request)));}
  catch(error){return mobileFailure(error instanceof Error&&error.message==='FORBIDDEN'
    ?new MobileError(403,'FORBIDDEN','Only a transport provider owner can manage vehicle publication.'):error);}
}
export async function POST(request:Request){
  try{const user=await mobileActor(request),parsed=command.safeParse(await mobileBody(request));
    if(!parsed.success)throw new MobileError(400,'INVALID_INPUT','Choose the vehicle and whether to take it live.');
    try{return mobileJson(await setProviderVehiclePublication(user,parsed.data.vehicleId,parsed.data.state));}
    catch(error){const code=error instanceof Error?error.message:'';
      if(code==='PROVIDER_VERIFICATION_REQUIRED')throw new MobileError(409,code,'One vehicle can go live without reviewed documents. Verify ownership or an eligible operating licence before taking more vehicles live.');
      if(['FORBIDDEN','NOT_FOUND'].includes(code))throw new MobileError(403,'FORBIDDEN','This vehicle is not available to your account.');throw error;}
  }catch(error){return mobileFailure(error);}
}
