import {NextRequest,NextResponse} from 'next/server.js';
import {getCurrentUser} from '@/lib/auth';
import {updateProviderVehicleDetails} from '@/lib/fleet.js';
import {errorMessage} from '@/lib/errors';
import {redirectWith,text} from '@/lib/redirects';

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const user=await getCurrentUser();
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  const {id}=await params;const form=await request.formData();
  try{
    await updateProviderVehicleDetails(user,id,{make:text(form,'make'),model:text(form,'model'),
      plate:text(form,'plate'),cargoConfiguration:text(form,'cargoConfiguration')});
    return redirectWith(request,`/app/fleet/${id}`,'success','Truck details updated.');
  }catch(error){return redirectWith(request,`/app/fleet/${id}`,'error',errorMessage(error));}
}
