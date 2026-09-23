import {NextRequest,NextResponse} from 'next/server.js';
import {getCurrentUser} from '@/lib/auth';
import {addFleetDriver} from '@/lib/fleet-driver-management';
import {fleetReturnPath} from '@/lib/fleet-navigation.js';
import {errorMessage} from '@/lib/errors';
import {redirectWith,text} from '@/lib/redirects';
import {checkRateLimit} from '@/lib/rate-limit';

export async function POST(request:NextRequest){
  const user=await getCurrentUser();
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  const form=await request.formData();
  const returnTo=fleetReturnPath(text(form,'returnTo'),'/app/fleet#driver-access');
  try{
    if(user.role!=='TRANSPORTER')throw new Error('FORBIDDEN');
    const rate=await checkRateLimit(`fleet-driver-add:${user.id}`,20,10*60_000);
    if(!rate.allowed)return redirectWith(request,returnTo,'error','Please wait before adding more drivers.');
    await addFleetDriver(user.id,{email:text(form,'email'),name:text(form,'name'),phone:text(form,'phone')});
    return redirectWith(request,returnTo,'success','Driver added. You can assign a truck now; email verification happens when they log in.');
  }catch(error){return redirectWith(request,returnTo,'error',errorMessage(error));}
}
