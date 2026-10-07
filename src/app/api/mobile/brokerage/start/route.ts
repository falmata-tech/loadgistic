import { mobileBody,mobileJson,MobileError } from '@/lib/mobile/server';
import { nativeBrokerageIntake,nativeBrokerageToken,nativeBrokerageSnapshot } from '@/lib/mobile/brokerage-contract.js';
import { brokerageFailure } from '@/lib/mobile/brokerage-server';
import { createSupabaseAdminClient } from '@/lib/supabase-adapter.js';
import { readTransportChat } from '@/lib/transport-chat';
import { checkRateLimit,requestKey } from '@/lib/rate-limit';
export const runtime='nodejs';
export async function POST(request:Request){try{
 const rate=await checkRateLimit(requestKey(request,'transport-request'),5,60000);if(!rate.allowed)throw new MobileError(429,'PLEASE_WAIT','Please wait before starting another chat.');
 const {input,digest}=nativeBrokerageIntake(await mobileBody(request)),{requestId,...command}=input;
 const phoneRate=await checkRateLimit(`transport-request-phone:${input.phone}`,10,3600000);if(!phoneRate.allowed)throw new MobileError(429,'PLEASE_WAIT','Please try again later.');
 const {error}=await createSupabaseAdminClient().rpc('create_transport_chat_request',{request_id:requestId,command,access_digest:digest});
 if(error)throw Error(error.message==='FORBIDDEN'?'FORBIDDEN':'TRANSPORT_REQUEST_UNAVAILABLE');
 const authority={requestId,digest,actorId:null},snapshot=nativeBrokerageSnapshot(await readTransportChat(authority),requestId);
 return mobileJson({token:nativeBrokerageToken(authority,snapshot.request.expiresAt),expiresAt:snapshot.request.expiresAt,issuedAt:Date.now(),snapshot},201);
}catch(error){return brokerageFailure(error);}}
