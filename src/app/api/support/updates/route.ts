import {NextRequest,NextResponse} from 'next/server.js';
import {getCurrentUser,getGuestSupportSession} from '@/lib/auth';
import {supportConversationRevision} from '@/lib/support/revision.js';
import {supportRevisionTag,supportRevisionMatches} from '@/lib/support-polling.js';
import {listSupportInbox,listGuestSupportInbox} from '@/lib/support.js';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
 const headers={'Cache-Control':'private, no-store'};
 try{
  const query=new URL(request.url).searchParams;const guest=query.get('kind')==='GUEST';const conversationId=query.get('conversation');
  const user=await getCurrentUser({allowLimited:true});let state:unknown;
  if(conversationId){
   if(!/^[0-9a-f-]{36}$/.test(conversationId))return NextResponse.json({error:'Updates unavailable.'},{status:400,headers});
   const session=guest&&query.get('participant')==='GUEST'?await getGuestSupportSession():null;
   if(session?.conversationId!==conversationId&&!user)return NextResponse.json({error:'Access required.'},{status:401,headers});
   state=await supportConversationRevision({actorId:user?.id||null,conversationId,guest,emailDigest:session?.conversationId===conversationId?session.emailDigest:null});
  }else{
   if(!user)return NextResponse.json({error:'Access required.'},{status:401,headers});
   const options={page:Number(query.get('page'))||1,pageSize:15};const view=query.get('view')||'ASSIGNED';
   state=guest?await listGuestSupportInbox(user,view,options):await listSupportInbox(user,view,options);
  }
  const tag=supportRevisionTag(state);const responseHeaders={...headers,ETag:tag};
  if(supportRevisionMatches(request.headers.get('if-none-match'),tag))return new NextResponse(null,{status:304,headers:responseHeaders});
  return NextResponse.json({revision:tag},{headers:responseHeaders});
 }catch(error){return NextResponse.json({error:'Updates unavailable.'},{status:error instanceof Error&&['NOT_FOUND','FORBIDDEN'].includes(error.message)?403:503,headers});}
}
