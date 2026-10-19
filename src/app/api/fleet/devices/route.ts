import {getCurrentUser} from '@/lib/auth';
import {getTelematicsWorkspace} from '@/lib/telematics.js';
import {mobileBody,mobileJson,mobileFailure,MobileError} from '@/lib/mobile/server';
import {mutateTelematics,telematicsFailure} from '@/lib/telematics-http';
export const runtime='nodejs';
export async function GET(request:Request){
 try{const user=await getCurrentUser();if(!user)throw new MobileError(401,'SIGN_IN_REQUIRED','Sign in to continue.');
  return mobileJson(await getTelematicsWorkspace(user,{page:Number(new URL(request.url).searchParams.get('page'))||1}));
 }catch(error){return mobileFailure(telematicsFailure(error));}
}
export async function POST(request:Request){
 try{const user=await getCurrentUser();if(!user)throw new MobileError(401,'SIGN_IN_REQUIRED','Sign in to continue.');
  return mobileJson({ok:true,result:await mutateTelematics(user,await mobileBody(request))});
 }catch(error){return mobileFailure(telematicsFailure(error));}
}
