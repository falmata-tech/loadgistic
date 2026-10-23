import {mobileActor,mobileBody,mobileFailure,mobileJson,MobileError} from '@/lib/mobile/server';
import {setProviderDrivingMode} from '@/lib/provider-driving-mode';
import {errorMessage} from '@/lib/errors';
export async function POST(request:Request){
  try{
    const user=await mobileActor(request);
    try{await setProviderDrivingMode(user,await mobileBody(request));}
    catch(error){
      if(error instanceof MobileError)throw error;
      const code=error instanceof Error?error.message:'';
      if(['FORBIDDEN','INVALID_DRIVING_MODE','DRIVER_ASSIGNED'].includes(code))throw new MobileError(code==='FORBIDDEN'?403:409,code,errorMessage(error));
      throw error;
    }
    return mobileJson({ok:true});
  }catch(error){return mobileFailure(error);}
}
