import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { removeNextTrip, upsertNextTrip } from '@/lib/repository.js';
import { errorMessage } from '@/lib/errors';
import { redirectWith, text } from '@/lib/redirects';

export const runtime='nodejs';
function destination(form:FormData){const value=text(form,'returnTo');return value.startsWith('/app/')?value:'/app/home';}
export async function POST(request:NextRequest){const user=await getCurrentUser();if(!user)return NextResponse.redirect(new URL('/login',request.url),303);const form=await request.formData();const back=destination(form);try{if(text(form,'action')==='REMOVE')removeNextTrip(user,text(form,'vehicleId'));else upsertNextTrip(user,{vehicleId:text(form,'vehicleId'),origin:text(form,'origin'),originPlaceRef:text(form,'originPlaceRef'),destination:text(form,'destination'),destinationPlaceRef:text(form,'destinationPlaceRef'),travelDate:text(form,'travelDate'),spaceStatus:text(form,'spaceStatus'),availablePercent:text(form,'availablePercent')});return redirectWith(request,back,'success',text(form,'action')==='REMOVE'?'Next trip removed.':'Next trip published.');}catch(error){return redirectWith(request,back,'error',errorMessage(error));}}
