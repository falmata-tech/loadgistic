import {getCurrentUser} from '@/lib/auth';
import {adminProvisionDevice} from '@/lib/telematics.js';
import {mobileBody,mobileJson,mobileFailure,MobileError} from '@/lib/mobile/server';
import {telematicsFailure} from '@/lib/telematics-http';
import {checkRateLimit} from '@/lib/rate-limit.js';
export const runtime='nodejs';
export async function POST(request:Request){
 try{const user=await getCurrentUser();if(!user||user.role!=='ADMIN'||!user.active)throw new MobileError(403,'FORBIDDEN','Administrator access is required.');
  if(!(await checkRateLimit(`device-provision:${user.id}`,10,60000)).allowed)throw new MobileError(429,'PLEASE_WAIT','Please wait before adding more devices.');
  const body=await mobileBody(request);
  // Synthetic hardware profiles are created by the isolated simulator, never an admin form.
  if(body.synthetic===true||body.modelProfile&&body.modelProfile!=='UNVERIFIED')throw new MobileError(400,'INVALID_INPUT','Demo devices use the separate local setup.');
  return mobileJson({ok:true,result:await adminProvisionDevice(user,{...body,synthetic:false,modelProfile:'UNVERIFIED'})});
 }catch(error){return mobileFailure(telematicsFailure(error));}
}
