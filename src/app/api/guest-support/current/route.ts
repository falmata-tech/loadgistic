import {NextRequest,NextResponse} from 'next/server.js';
import {getGuestSupportSession} from '@/lib/auth';
import {getAssistedMatchingAvailability,getGuestSupportConversationForGuest} from '@/lib/support.js';

import {supportConversationRevision} from '@/lib/support/revision.js';
import {supportRevisionTag,supportRevisionMatches} from '@/lib/support-polling.js';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(request:NextRequest){
  const presence=await getAssistedMatchingAvailability();
  const session=await getGuestSupportSession();
  if(!session)return NextResponse.json({conversation:null,presence},{headers:{'Cache-Control':'private, no-store'}});
  try{
    const markRead=new URL(request.url).searchParams.get('markRead')==='1';
    const beforeMessageId=new URL(request.url).searchParams.get('before');
    const revision=await supportConversationRevision({conversationId:session.conversationId,guest:true,emailDigest:session.emailDigest,markRead:markRead&&!beforeMessageId});
    const tag=supportRevisionTag([revision,presence,beforeMessageId,markRead]);
    if(supportRevisionMatches(request.headers.get('if-none-match'),tag))return new NextResponse(null,{status:304,headers:{'Cache-Control':'private, no-store',ETag:tag}});
    const conversation=await getGuestSupportConversationForGuest(session.conversationId,session.emailDigest,{markRead,beforeMessageId});
    return NextResponse.json({conversation,presence},{headers:{'Cache-Control':'private, no-store',ETag:tag}});
  }catch(error){
    if(error instanceof Error&&error.message==='INVALID_SUPPORT_CURSOR')return NextResponse.json({error:'This message history is unavailable. Return to the latest messages.'},{status:400,headers:{'Cache-Control':'private, no-store'}});
    if(error instanceof Error&&error.message==='NOT_FOUND')return NextResponse.json({conversation:null,presence},{headers:{'Cache-Control':'private, no-store'}});
    return NextResponse.json({error:'Conversation updates are temporarily unavailable.'},{status:503,headers:{'Cache-Control':'private, no-store'}});
  }
}
