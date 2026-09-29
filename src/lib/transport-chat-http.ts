import 'server-only';
import {createHash} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server.js';
import {checkRateLimit,requestKey} from './rate-limit';
import {readTransportChat,sendTransportMessage,type TransportChatAuthority} from './transport-chat';
const headers={'Cache-Control':'private, no-store'};
export function transportChatError(error:unknown){
 const code=error instanceof Error?error.message:'';
 const status=code==='FORBIDDEN'?403:['TRANSPORT_CHAT_CLOSED','TRANSPORT_CHAT_ENDED'].includes(code)?409:code==='INVALID_TRANSPORT_MESSAGE'||error instanceof SyntaxError?400:503;
 return NextResponse.json({error:status===403?'This conversation is no longer available in this browser.':status===409?(code==='TRANSPORT_CHAT_ENDED'?'This chat has ended. Our team can still call you.':'This conversation is closed.'):status===400?'Enter a message of up to 2,000 characters.':'Conversation updates are temporarily unavailable. Retrying…'},{status,headers});
}
export async function transportChatGet(request:NextRequest,authority:TransportChatAuthority){
 try{
  const rate=await checkRateLimit(requestKey(request,'transport-chat-read'),120,60000);
  if(!rate.allowed)return NextResponse.json({error:'Please wait a moment.'},{status:429,headers:{...headers,'Retry-After':String(rate.retryAfterSeconds)}});
  const after=Number(request.nextUrl.searchParams.get('after')||0),before=request.nextUrl.searchParams.has('before')?Number(request.nextUrl.searchParams.get('before')):null;
  if(!Number.isSafeInteger(after)||after<0||before!==null&&(!Number.isSafeInteger(before)||before<1))throw new Error('INVALID_TRANSPORT_MESSAGE');
  const data=await readTransportChat(authority,after,before),etag='"'+createHash('sha256').update(JSON.stringify(data)).digest('hex')+'"';
  return request.headers.get('if-none-match')===etag?new NextResponse(null,{status:304,headers:{...headers,etag}}):NextResponse.json(data,{headers:{...headers,etag}});
 }catch(error){return transportChatError(error);}
}
export async function transportChatPost(request:NextRequest,authority:TransportChatAuthority){
 try{
  const rate=await checkRateLimit(`transport-chat-write:${authority.actorId||authority.requestId}`,20,60000);
  if(!rate.allowed)return NextResponse.json({error:'Please wait a moment before sending another message.'},{status:429,headers:{...headers,'Retry-After':String(rate.retryAfterSeconds)}});
  const reader=request.body?.getReader();if(!reader)throw new Error('INVALID_TRANSPORT_MESSAGE');let raw='',size=0;const decoder=new TextDecoder();
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>12000){await reader.cancel();throw new Error('INVALID_TRANSPORT_MESSAGE');}raw+=decoder.decode(value,{stream:true});}
  raw+=decoder.decode();await sendTransportMessage(authority,JSON.parse(raw));return NextResponse.json({ok:true},{headers});
 }catch(error){return transportChatError(error);}
}
