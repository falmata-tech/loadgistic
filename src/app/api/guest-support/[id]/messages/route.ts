import {NextRequest,NextResponse} from 'next/server.js';
import {getCurrentUser,getGuestSupportSession} from '@/lib/auth';
import {sendGuestSupportMessage} from '@/lib/support.js';
import {checkRateLimit,requestKey} from '@/lib/rate-limit';
import {errorMessage} from '@/lib/errors';
import {redirectWith,text} from '@/lib/redirects';

export const runtime='nodejs';

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const json=request.headers.get('accept')?.includes('application/json');
  const {id}=await params;const session=await getGuestSupportSession(id);const user=session?null:await getCurrentUser({allowLimited:true});
  if(!session&&!user)return json?NextResponse.json({ok:false,error:'Conversation access is required.'},{status:401}):NextResponse.redirect(new URL('/help',request.url),303);
  const rate=await checkRateLimit(`${requestKey(request,'guest-support-message')}:${session?.emailDigest||user?.id}`,20,60_000);
  if(!rate.allowed)return json?NextResponse.json({ok:false,error:'Too many messages. Wait a minute and try again.'},{status:429}):redirectWith(request,session?`/help/${id}`:`/support/assisted/${id}`,'error','Too many messages. Wait a minute and try again.');
  const form=await request.formData();
  try{
    const file=form.get('file');
    const upload=file&&typeof file!=='string'&&file.size?file:null;
    await sendGuestSupportMessage(user,id,text(form,'body'),session?.emailDigest||null,upload);
    return json?NextResponse.json({ok:true}):redirectWith(request,session?`/help/${id}`:`/support/assisted/${id}`,'success','Message sent.');
  }catch(error){return json?NextResponse.json({ok:false,error:errorMessage(error)},{status:400}):redirectWith(request,session?`/help/${id}`:`/support/assisted/${id}`,'error',errorMessage(error));}
}
