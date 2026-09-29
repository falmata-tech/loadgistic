import {NextRequest,NextResponse} from 'next/server.js';
import {getCurrentUser} from '@/lib/auth';
import {transportChatGet,transportChatPost} from '@/lib/transport-chat-http';
async function handle(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const user=await getCurrentUser({allowLimited:true});
 if(!user||(user.role!=='ADMIN'&&!(user.role==='SUPPORT'&&user.can_manage_brokerage)))return NextResponse.json({error:'Access denied.'},{status:403,headers:{'Cache-Control':'private, no-store'}});
 const {id}=await params;if(!/^[a-f0-9-]{36}$/.test(id))return NextResponse.json({error:'Not found.'},{status:404});
 const authority={requestId:id,digest:null,actorId:user.id};return request.method==='POST'?transportChatPost(request,authority):transportChatGet(request,authority);
}
export const GET=handle;export const POST=handle;
