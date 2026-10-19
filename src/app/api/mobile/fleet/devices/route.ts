import {getTelematicsWorkspace} from '@/lib/telematics.js';
import {mobileActor,mobileBody,mobileJson,mobileFailure} from '@/lib/mobile/server';
import {mutateTelematics,telematicsFailure} from '@/lib/telematics-http';
export const runtime='nodejs';
export async function GET(request:Request){
 try{return mobileJson(await getTelematicsWorkspace(await mobileActor(request),{page:Number(new URL(request.url).searchParams.get('page'))||1}));}
 catch(error){return mobileFailure(telematicsFailure(error));}
}
export async function POST(request:Request){
 try{return mobileJson({ok:true,result:await mutateTelematics(await mobileActor(request),await mobileBody(request))});}
 catch(error){return mobileFailure(telematicsFailure(error));}
}
