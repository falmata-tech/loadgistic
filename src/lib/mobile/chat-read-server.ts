import {MobileError,mobileBody,mobileFailure,mobileJson} from './server';
import {acknowledgeChatRead,readChatReceipts} from '../chat-read-server';
import type {ChatReadAuthority} from '../chat-alert-contract';
import {checkRateLimit} from '../rate-limit';
export function mobileChatReadFailure(error:unknown){
 const code=error instanceof Error?error.message:'';
 if(code==='FORBIDDEN')return mobileFailure(new MobileError(403,'CHAT_UNAVAILABLE','This chat is not available to you.'));
 if(code==='INVALID_CHAT_READ')return mobileFailure(new MobileError(400,'INVALID_INPUT','This read position is not available.'));
 if(code==='CHAT_ASSIGNMENT_CHANGED')return mobileFailure(new MobileError(409,code,'This chat assignment changed. Refresh the chat.'));
 return mobileFailure(error);
}
export async function limitMobileChatAlerts(identity:string){
 const rate=await checkRateLimit(`chat-alerts:${identity}`,120,60000);
 if(!rate.allowed)throw new MobileError(429,'PLEASE_WAIT','Please wait a moment.');
}
export async function mobileChatReadResponse(request:Request,authority:ChatReadAuthority){
 try{
  const rate=await checkRateLimit(`chat-read:${authority.kind}:${authority.actorId||authority.id}`,120,60000);
  if(!rate.allowed)throw new MobileError(429,'PLEASE_WAIT','Please wait a moment.');
  return mobileJson(request.method==='GET'?await readChatReceipts(authority):await acknowledgeChatRead(authority,await mobileBody(request)));
 }catch(error){return mobileChatReadFailure(error);}
}
