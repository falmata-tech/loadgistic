import {NextRequest} from 'next/server.js';
import {getTransportChatAuthority} from '@/lib/transport-chat';
import {chatReadResponse,chatReadFailure} from '@/lib/chat-read-http';
async function handle(request:NextRequest){
 const visitor=await getTransportChatAuthority();if(!visitor)return chatReadFailure(Error('FORBIDDEN'));
 return chatReadResponse(request,{kind:'BROKERAGE',id:visitor.requestId,actorId:null,digest:visitor.digest});
}
export const GET=handle;export const POST=handle;
