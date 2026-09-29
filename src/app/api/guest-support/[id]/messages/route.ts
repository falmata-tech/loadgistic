import {PUBLIC_SUPPORT_CLOSED_MESSAGE} from '@/lib/support-policy.js';
import {NextRequest,NextResponse} from 'next/server.js';
import {getCurrentUser} from '@/lib/auth';
import {sendGuestSupportMessage} from '@/lib/support.js';
import {checkRateLimit,requestKey} from '@/lib/rate-limit';
import {errorMessage} from '@/lib/errors';
import {redirectWith,text} from '@/lib/redirects';

export const runtime='nodejs';

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const json=request.headers.get('accept')?.includes('application/json');
  const {id}=await params;const user=await getCurrentUser({allowLimited:true});
  if(!user||!['ADMIN','SUPPORT'].includes(user.role))return NextResponse.json({ok:false,error:PUBLIC_SUPPORT_CLOSED_MESSAGE},{status:410});
  const rate=await checkRateLimit(`${requestKey(request,'guest-support-message')}:${user.id}`,20,60_000);
  if(!rate.allowed)return json?NextResponse.json({ok:false,error:'Too many messages. Wait a minute and try again.'},{status:429}):redirectWith(request,`/support/assisted/${id}`,'error','Too many messages. Wait a minute and try again.');
  const form=await request.formData();
  try{
    const file=form.get('file');
    const upload=file&&typeof file!=='string'&&file.size?file:null;
    await sendGuestSupportMessage(user,id,text(form,'body'),null,upload);
    return json?NextResponse.json({ok:true}):redirectWith(request,`/support/assisted/${id}`,'success','Message sent.');
  }catch(error){return json?NextResponse.json({ok:false,error:errorMessage(error)},{status:400}):redirectWith(request,`/support/assisted/${id}`,'error',errorMessage(error));}
}
