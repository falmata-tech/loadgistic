import { mobileBody,mobileJson,MobileError } from '@/lib/mobile/server';
import { nativeBrokerageCommand,readNativeBrokerage,nativeBrokerageSnapshot } from '@/lib/mobile/brokerage-contract.js';
import { brokerageFailure } from '@/lib/mobile/brokerage-server';
import { readTransportChat,sendTransportMessage,endTransportChat } from '@/lib/transport-chat';
import { checkRateLimit,requestKey } from '@/lib/rate-limit';
export const runtime='nodejs';
function authority(request:Request){const value=readNativeBrokerage(request.headers.get('authorization'));if(!value)throw Error('FORBIDDEN');return value;}
export async function GET(request:Request){try{const actor=authority(request),rate=await checkRateLimit(requestKey(request,'transport-chat-read'),120,60000);if(!rate.allowed)throw new MobileError(429,'PLEASE_WAIT','Please wait a moment.');
 const before=new URL(request.url).searchParams.get('before');if(before!==null&&!/^[1-9]\d{0,14}$/.test(before))throw Error('INVALID_TRANSPORT_MESSAGE');
 return mobileJson(nativeBrokerageSnapshot(await readTransportChat(actor,0,before===null?null:Number(before)),actor.requestId));
}catch(error){return brokerageFailure(error);}}
export async function POST(request:Request){try{const actor=authority(request),input=nativeBrokerageCommand(await mobileBody(request));const rate=await checkRateLimit(`transport-chat-write:${actor.requestId}`,20,60000);if(!rate.allowed)throw new MobileError(429,'PLEASE_WAIT','Please wait before sending another message.');
 if(input.action==='END')await endTransportChat(actor);else await sendTransportMessage(actor,input);
 return mobileJson(nativeBrokerageSnapshot(await readTransportChat(actor),actor.requestId));
}catch(error){return brokerageFailure(error);}}
