import {mobileActor} from '@/lib/mobile/server';
import {mobileChatReadResponse,mobileChatReadFailure} from '@/lib/mobile/chat-read-server';
async function handle(request:Request,{params}:{params:Promise<{id:string}>}){
 try{const user=await mobileActor(request,true);return mobileChatReadResponse(request,{kind:'SUPPORT',id:(await params).id,actorId:user.id});}
 catch(error){return mobileChatReadFailure(error);}
}
export const GET=handle;export const POST=handle;
