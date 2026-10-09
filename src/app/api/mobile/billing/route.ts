import {mobileActor,mobileFailure,mobileJson} from '@/lib/mobile/server';
export const runtime='nodejs';
async function retired(request:Request){
 try{await mobileActor(request,true);return mobileJson({error:{code:'BILLING_RETIRED',message:'Platform payment plans are not offered.'}},410);}
 catch(error){return mobileFailure(error);}
}
export const GET=retired;
export const POST=retired;
