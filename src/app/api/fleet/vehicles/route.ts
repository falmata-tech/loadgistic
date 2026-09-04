import {NextRequest,NextResponse} from 'next/server.js';
import {getCurrentUser} from '@/lib/auth';
import {createProviderVehicle} from '@/lib/fleet.js';
import {errorMessage} from '@/lib/errors';
import {redirectWith,text} from '@/lib/redirects';

export async function POST(request:NextRequest){
  const user=await getCurrentUser();
  if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
  const form=await request.formData();
  try{
    const vehicle=await createProviderVehicle(user,{
      make:text(form,'make'),model:text(form,'model'),
      cargoConfiguration:text(form,'cargoConfiguration'),plate:text(form,'plate')
    });
    return redirectWith(request,`/app/fleet/${vehicle.id}`,'success','Truck added. Complete its capacity and document details when ready.');
  }catch(error){
    return redirectWith(request,'/app/fleet/new','error',errorMessage(error));
  }
}
