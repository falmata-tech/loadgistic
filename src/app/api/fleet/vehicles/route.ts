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
      cargoConfiguration:text(form,'cargoConfiguration'),plate:text(form,'plate'),
      trailerInterchangeable:text(form,'vehicleKind')==='INTERCHANGEABLE_TRACTOR',
      useBasis:text(form,'useBasis'),replaceVehicleId:text(form,'replaceVehicleId'),replacementConfirmed:text(form,'replacementConfirmed')==='on',
      supportedTrailerConfigurations:form.getAll('supportedTrailerConfigurations').map(String)
    });
    return redirectWith(request,`/app/fleet/${vehicle.id}`,'success',text(form,'replaceVehicleId')?'Truck changed. Add fresh location and capacity for this truck.':'Truck added. Complete its capacity and document details when ready.');
  }catch(error){
    const replacement=text(form,'replaceVehicleId');
    return redirectWith(request,'/app/fleet/new'+(/^[0-9a-f-]{36}$/i.test(replacement)?'?replace='+replacement:''),'error',errorMessage(error));
  }
}
