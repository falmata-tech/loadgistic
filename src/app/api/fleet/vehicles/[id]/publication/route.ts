import {NextRequest,NextResponse} from 'next/server.js';
import {getCurrentUser} from '@/lib/auth';
import {setProviderVehiclePublication} from '@/lib/provider-authority.js';
import {fleetReturnPath} from '@/lib/fleet-navigation.js';
import {redirectWith,text} from '@/lib/redirects';
import {errorMessage} from '@/lib/errors';
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const user=await getCurrentUser({allowLimited:true});
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  const form=await request.formData(),returnTo=fleetReturnPath(text(form,'returnTo'));
  try{const {id}=await params;await setProviderVehiclePublication(user,id,text(form,'state') as 'LIVE'|'DRAFT');
    return redirectWith(request,returnTo,'success',text(form,'state')==='LIVE'?'Vehicle is live.':'Vehicle saved as a draft.');
  }catch(error){return redirectWith(request,returnTo,'error',errorMessage(error));}
}
