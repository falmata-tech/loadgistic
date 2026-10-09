import {readNativeBrokerage} from '@/lib/mobile/brokerage-contract.js';
import {mobileChatReadResponse,mobileChatReadFailure} from '@/lib/mobile/chat-read-server';
async function handle(request:Request){
 const visitor=readNativeBrokerage(request.headers.get('authorization'));if(!visitor)return mobileChatReadFailure(Error('FORBIDDEN'));
 return mobileChatReadResponse(request,{kind:'BROKERAGE',id:visitor.requestId,actorId:null,digest:visitor.digest});
}
export const GET=handle;export const POST=handle;
