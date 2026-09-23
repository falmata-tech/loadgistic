import {NextRequest,NextResponse} from 'next/server.js';
import {getCurrentUser} from '@/lib/auth';
import {inviteFleetDriver,sendFleetInvitation,cancelFleetInvitation} from '@/lib/fleet-driver-management';
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
    const action=text(form,'action');
    if(action==='cancel'){
      await cancelFleetInvitation(user.id,text(form,'invitationId'));
      return redirectWith(request,returnTo,'success','Invitation cancelled.');
    }
    const rate=await checkRateLimit(`fleet-driver-invite:${user.id}`,20,10*60_000);
    if(!rate.allowed)return redirectWith(request,returnTo,'error','Please wait before sending more invitations.');
    const id=action==='resend'?text(form,'invitationId'):await inviteFleetDriver(user.id,{
      email:text(form,'email'),name:text(form,'name'),phone:text(form,'phone')
    });
    const delivery=await sendFleetInvitation(user.id,id);
    if(delivery==='failed')return redirectWith(request,returnTo,'error','Invitation saved, but the email could not be delivered. Retry email, or ask the driver to log in with the invited email.');
    return redirectWith(request,returnTo,'success',delivery==='sent'
      ?'Invitation sent. After the driver accepts, assign their truck here.'
      :'Invitation is pending. The driver can log in with the invited email. Wait a minute before retrying email.');
  }catch(error){return redirectWith(request,returnTo,'error',errorMessage(error));}
}
