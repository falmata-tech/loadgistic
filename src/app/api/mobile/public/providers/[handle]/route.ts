import { getPublicProvider } from '@/lib/public-provider.js';
import { nativePublicProvider } from '@/lib/mobile/public-contract.js';
import { vehicleConfigurationImage } from '@/lib/vehicle-configurations';
import { mobileFailure, mobileJson, MobileError } from '@/lib/mobile/server';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{handle:string}>}){try{
 const {handle}=await params, page=new URL(request.url).searchParams.get('page')||'1';
 if(!/^[a-z0-9][a-z0-9_-]{1,63}$/i.test(handle)||!/^[1-9]\d{0,5}$/.test(page))throw new MobileError(400,'INVALID_INPUT','Check the transporter address or page.');
 const provider=nativePublicProvider(await getPublicProvider(handle,{truckPage:Number(page)}));
 if(!provider)throw new MobileError(404,'NOT_FOUND','This transporter profile is not available.');
 return mobileJson({...provider,trucks:provider.trucks.map(truck=>({...truck,image:vehicleConfigurationImage(truck.configuration)}))});
}catch(error){return mobileFailure(error);}}
