import {NextRequest,NextResponse} from 'next/server.js';
import {getCurrentUser} from '@/lib/auth';
import {updateFleetDriverContact,removeFleetDriver} from '@/lib/fleet-driver-management';
import {fleetReturnPath} from '@/lib/fleet-navigation.js';
import {errorMessage} from '@/lib/errors';
import {redirectWith,text} from '@/lib/redirects';

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const user=await getCurrentUser();
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  const {id}=await params;const form=await request.formData();
  const returnTo=fleetReturnPath(text(form,'returnTo'),'/app/fleet#driver-access');
  try{
    if(text(form,'action')==='remove'){
      if(text(form,'confirm')!=='on')return redirectWith(request,returnTo,'error','Confirm removal before continuing.');
      await removeFleetDriver(user.id,id);
      return redirectWith(request,returnTo,'success','Driver removed. Their assignments and fleet access have ended; history is retained.');
    }
    await updateFleetDriverContact(user.id,id,{name:text(form,'name'),phone:text(form,'phone')});
    return redirectWith(request,returnTo,'success','Driver contact updated.');
  }catch(error){return redirectWith(request,returnTo,'error',errorMessage(error));}
}
