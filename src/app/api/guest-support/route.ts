import {NextRequest,NextResponse} from 'next/server.js';
import {setGuestSupportSession} from '@/lib/auth';
import {createGuestSupportConversation} from '@/lib/support.js';
import {checkRateLimit,requestKey} from '@/lib/rate-limit';
import {errorMessage} from '@/lib/errors';
import {redirectWith,text} from '@/lib/redirects';
import {deliverPendingAccessEmails} from '@/lib/email-delivery';

export const runtime='nodejs';

export async function POST(request:NextRequest){
  const json=request.headers.get('accept')?.includes('application/json');
  const rate=await checkRateLimit(requestKey(request,'guest-support-create'),5,60_000);
  if(!rate.allowed)return json?NextResponse.json({ok:false,error:`Too many requests. Try again in ${rate.retryAfterSeconds} seconds.`},{status:429}):redirectWith(request,'/help','error',`Too many requests. Try again in ${rate.retryAfterSeconds} seconds.`);
  const form=await request.formData();
  try{
    const file=form.get('file');
    const upload=file&&typeof file!=='string'&&file.size?file:null;
    const result=await createGuestSupportConversation({email:text(form,'email'),phone:text(form,'phone'),body:text(form,'body')},upload);
    await setGuestSupportSession(result.id,result.emailDigest);
    await deliverPendingAccessEmails();
    return json?NextResponse.json({ok:true,conversationId:result.id}):redirectWith(request,`/help/${result.id}`,'success','Conversation started.');
  }catch(error){return json?NextResponse.json({ok:false,error:errorMessage(error)},{status:400}):redirectWith(request,'/help','error',errorMessage(error));}
}
