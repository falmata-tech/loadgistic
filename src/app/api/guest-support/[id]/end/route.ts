import {NextRequest,NextResponse} from 'next/server.js';
import {getGuestSupportSession} from '@/lib/auth';
import {endGuestSupportConversation} from '@/lib/repository.js';
import {checkRateLimit,requestKey} from '@/lib/rate-limit';
import {errorMessage} from '@/lib/errors';

export const runtime='nodejs';

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const session=await getGuestSupportSession(id);
  if(!session)return NextResponse.json({ok:false,error:'Conversation access is required.'},{status:401});
  const rate=checkRateLimit(`${requestKey(request,'guest-support-end')}:${session.emailDigest}`,5,60_000);
  if(!rate.allowed)return NextResponse.json({ok:false,error:'Wait a moment and try again.'},{status:429});
  try{await endGuestSupportConversation(id,session.emailDigest);return NextResponse.json({ok:true});}
  catch(error){return NextResponse.json({ok:false,error:errorMessage(error)},{status:400});}
}
