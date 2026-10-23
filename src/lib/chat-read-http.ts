import 'server-only';
import {createHash} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server.js';
import {acknowledgeChatRead,readChatReceipts} from './chat-read-server';
import type {ChatReadAuthority} from './chat-alert-contract';
import {checkRateLimit} from './rate-limit';
const headers={'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'};
export function chatReadFailure(error:unknown){
 const denied=error instanceof Error&&error.message==='FORBIDDEN',invalid=error instanceof Error&&error.message==='INVALID_CHAT_READ',changed=error instanceof Error&&error.message==='CHAT_ASSIGNMENT_CHANGED';
 return NextResponse.json({error:denied?'This chat is not available to you.':changed?'This chat assignment changed. Refresh the chat.':invalid?'This read position is not available.':'Chat updates are temporarily unavailable.'},{status:denied?403:changed?409:invalid?400:503,headers});
}
export async function chatReadResponse(request:NextRequest,authority:ChatReadAuthority){
 try{
  const rate=await checkRateLimit(`chat-read:${authority.kind}:${authority.actorId||authority.id}`,120,60000);
  if(!rate.allowed)return NextResponse.json({error:'Please wait a moment.'},{status:429,headers});
  if(request.method==='GET'){
   const state=await readChatReceipts(authority),etag='"'+createHash('sha256').update(JSON.stringify(state)).digest('hex')+'"';
   return request.headers.get('if-none-match')===etag?new NextResponse(null,{status:304,headers:{...headers,etag}}):NextResponse.json(state,{headers:{...headers,etag}});
  }
  if(!request.headers.get('content-type')?.startsWith('application/json'))throw Error('INVALID_CHAT_READ');
  const reader=request.body?.getReader();if(!reader)throw Error('INVALID_CHAT_READ');let count=0;const chunks:Uint8Array[]=[];
  try{for(;;){const {done,value}=await reader.read();if(done)break;count+=value.length;if(count>256){await reader.cancel();throw Error('INVALID_CHAT_READ');}chunks.push(value);}}
  finally{reader.releaseLock();}
  const bytes=new Uint8Array(count);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  let input:unknown;try{input=JSON.parse(new TextDecoder().decode(bytes));}catch{throw Error('INVALID_CHAT_READ');}
  return NextResponse.json(await acknowledgeChatRead(authority,input),{headers});
 }catch(error){return chatReadFailure(error);}
}
