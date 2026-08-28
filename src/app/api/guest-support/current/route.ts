import {NextRequest,NextResponse} from 'next/server.js';
import {getGuestSupportSession} from '@/lib/auth';
import {getAssistedMatchingAvailability,getGuestSupportConversationForGuest} from '@/lib/support.js';

export const runtime='nodejs';
export const dynamic='force-dynamic';

export async function GET(request:NextRequest){
  const presence=await getAssistedMatchingAvailability();
  const session=await getGuestSupportSession();
  if(!session)return NextResponse.json({conversation:null,presence},{headers:{'Cache-Control':'private, no-store'}});
  try{
    const markRead=new URL(request.url).searchParams.get('markRead')==='1';
    const conversation=await getGuestSupportConversationForGuest(session.conversationId,session.emailDigest,{markRead});
    return NextResponse.json({conversation,presence},{headers:{'Cache-Control':'private, no-store'}});
  }catch{
    return NextResponse.json({conversation:null,presence},{headers:{'Cache-Control':'private, no-store'}});
  }
}
