import {NextRequest,NextResponse} from 'next/server.js';
import {getCurrentUser} from '@/lib/auth';
import {setVehicleLifecycle} from '@/lib/lifecycle.js';
import {canManageProviderVehicles} from '@/lib/fleet.js';
import {errorMessage} from '@/lib/errors';
import {redirectWith,text} from '@/lib/redirects';
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const user=await getCurrentUser({allowLimited:true});if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
 const {id}=await params;
 try{
  if(!canManageProviderVehicles(user))throw new Error('FORBIDDEN');
  const form=await request.formData();const action=text(form,'action');
  if(!['RETIRE','RESTORE'].includes(action)||text(form,'confirm')!==action)throw new Error('LIFECYCLE_CONFIRMATION_REQUIRED');
  await setVehicleLifecycle(user,id,{active:action==='RESTORE',reason:text(form,'reason')});
  return redirectWith(request,'/app/fleet','success',action==='RETIRE'?'Truck retired. Its history is retained.':'Truck restored. Assign a Driver and publish fresh capacity when ready.');
 }catch(error){return redirectWith(request,'/app/fleet','error',errorMessage(error));}
}
