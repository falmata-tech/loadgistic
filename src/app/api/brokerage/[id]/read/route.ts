import {NextRequest} from 'next/server.js';
import {getCurrentUser} from '@/lib/auth';
import {chatReadResponse,chatReadFailure} from '@/lib/chat-read-http';
async function handle(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const user=await getCurrentUser({allowLimited:true});if(!user||(user.role!=='ADMIN'&&!(user.role==='SUPPORT'&&user.can_manage_brokerage)))return chatReadFailure(Error('FORBIDDEN'));
 return chatReadResponse(request,{kind:'BROKERAGE',id:(await params).id,actorId:user.id});
}
export const GET=handle;export const POST=handle;
