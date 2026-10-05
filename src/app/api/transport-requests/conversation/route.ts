import {NextRequest,NextResponse} from 'next/server.js';
import {getTransportChatAuthority,clearTransportChat,endTransportChat,readTransportChat} from '@/lib/transport-chat';
import {checkRateLimit} from '@/lib/rate-limit';
import {transportChatGet,transportChatPost,transportChatError} from '@/lib/transport-chat-http';
export async function GET(request:NextRequest){const authority=await getTransportChatAuthority();return authority?transportChatGet(request,authority):NextResponse.json(null,{headers:{'Cache-Control':'private, no-store'}});}
export async function POST(request:NextRequest){const authority=await getTransportChatAuthority();return authority?transportChatPost(request,authority):NextResponse.json({error:'This conversation is no longer available in this browser.'},{status:403,headers:{'Cache-Control':'private, no-store'}});}
export async function DELETE(){await clearTransportChat();return NextResponse.json({ok:true},{headers:{'Cache-Control':'private, no-store'}});}

// Visitor authority comes exclusively from the signed same-browser capability.
export async function PATCH(){
 try{const authority=await getTransportChatAuthority();if(!authority)throw new Error('FORBIDDEN');
  const rate=await checkRateLimit(`transport-chat-end:${authority.requestId}`,10,60000);
  if(!rate.allowed)return NextResponse.json({error:'Please wait a moment.'},{status:429,headers:{'Cache-Control':'private, no-store','Retry-After':String(rate.retryAfterSeconds)}});
  await endTransportChat(authority);const snapshot=await readTransportChat(authority);
  return NextResponse.json({ok:true,snapshot},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return transportChatError(error);}
}
