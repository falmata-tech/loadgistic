import {createHash} from 'node:crypto';
import {z} from 'zod';
import {mobileActor,mobileBody,mobileFailure,mobileJson,MobileError} from '@/lib/mobile/server';
import {mobileBearer} from '@/lib/mobile/identity-policy.js';
import {readNativeBrokerage} from '@/lib/mobile/brokerage-contract.js';
import {createSupabaseAdminClient} from '@/lib/supabase-adapter.js';
import {nativePushCommand} from '@/lib/native-push-policy.js';
import {checkRateLimit} from '@/lib/rate-limit';
export const runtime='nodejs';
export async function POST(request:Request){
 try{
  const parsed=nativePushCommand.safeParse(await mobileBody(request));
  if(!parsed.success)throw new MobileError(400,'INVALID_INPUT','Could not confirm phone alerts.');
  const input=parsed.data,digest=createHash('sha256').update('loadgistic-native-installation:'+input.secret).digest('hex');
  const client=createSupabaseAdminClient();
  let identity=input.installationId,actorId:string|null=null,sessionId:string|null=null,visitor:null|{requestId:string;digest:string}=null;
  if(input.action==='REGISTER'){
   visitor=readNativeBrokerage(request.headers.get('authorization'));
   if(visitor)identity=visitor.requestId;
   else{
    const actor=await mobileActor(request,true);if(!['DRIVER','TRANSPORTER'].includes(actor.role))throw new MobileError(403,'FORBIDDEN','Phone alerts are available to transport providers and chat visitors.');
    actorId=actor.id;identity=actor.id;
    // getUser/mobileActor verifies the JWT before its session claim is used.
    const token=mobileBearer(request.headers.get('authorization'));if(!token)throw new MobileError(401,'SIGN_IN_REQUIRED','Sign in to continue.');
    const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8')) as {session_id?:unknown};
    const session=z.string().uuid().safeParse(claims.session_id);if(!session.success)throw new MobileError(403,'FORBIDDEN','Could not confirm phone alerts.');sessionId=session.data;
   }
  }
  const rate=await checkRateLimit('native-push:'+identity,30,60000);if(!rate.allowed)throw new MobileError(429,'PLEASE_WAIT','Please wait a moment.');
  const {data,error}=input.action==='REMOVE'
   ?await client.rpc('remove_native_push_binding',{installation_id:input.installationId,installation_digest:digest,remove_scope:input.scope})
   :await client.rpc('register_native_push_binding',{installation_id:input.installationId,installation_digest:digest,push_token:input.token,preferred_locale:input.locale,
    actor_user_id:actorId,session_id:sessionId,visitor_request_id:visitor?.requestId||null,visitor_digest:visitor?.digest||null});
  if(error){if(['FORBIDDEN','PUSH_DEVICE_LIMIT'].includes(error.message))throw new MobileError(403,'FORBIDDEN','Could not confirm phone alerts.');if(error.message==='INVALID_PUSH_INPUT')throw new MobileError(400,'INVALID_INPUT','Could not confirm phone alerts.');throw Error('PUSH_REGISTRATION_UNAVAILABLE');}
  if(data!==true)throw Error('PUSH_REGISTRATION_UNAVAILABLE');
  return mobileJson({ok:true,deliveryEnabled:process.env.LOADGISTIC_NATIVE_PUSH_ENABLED==='true'});
 }catch(error){return mobileFailure(error);}
}
