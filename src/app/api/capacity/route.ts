import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { publishCapacity, saveUpload } from '@/lib/repository.js';
import { errorMessage } from '@/lib/errors';
import { redirectWith, text, checked } from '@/lib/redirects';

export const runtime='nodejs';
export async function POST(request:NextRequest){
 const user=await getCurrentUser(); if(!user) return NextResponse.redirect(new URL('/login',request.url),303);
 const form=await request.formData();
 const vehicleId=text(form,'vehicleId');
 const returnTo=user.role==='TRANSPORTER'&&vehicleId?`/app/fleet/${vehicleId}`:'/app/home';
 try{
   const file=form.get('photo'); const upload=file && typeof file!=='string' && file.size ? await saveUpload(file,'capacity') : null;
   const origin=text(form,'origin'); const destination=text(form,'destination');
   publishCapacity(user,{vehicleId,status:text(form,'status'),availablePercent:text(form,'availablePercent'),availableAgainDate:text(form,'availableAgainDate'),availableAgainPlaceRef:text(form,'availableAgainPlaceRef'),availableAgainPlaceLabel:text(form,'availableAgainPlaceLabel'),acceptedLoads:text(form,'acceptedLoads'),movementScope:text(form,'movementScope')||'INTERCITY',localRadiusKm:text(form,'localRadiusKm'),locationArea:text(form,'locationArea'),approximateLat:text(form,'approximateLat'),approximateLng:text(form,'approximateLng'),locationPrecisionKm:text(form,'locationPrecisionKm'),locationSource:text(form,'locationSource'),routeIntent:text(form,'routeIntent'),origin,originPlaceRef:text(form,'originPlaceRef'),destination,destinationPlaceRef:text(form,'destinationPlaceRef'),currentRouteOrigin:text(form,'currentRouteOrigin'),currentOriginPlaceRef:text(form,'currentOriginPlaceRef'),currentRouteDestination:text(form,'currentRouteDestination'),currentDestinationPlaceRef:text(form,'currentDestinationPlaceRef'),travelDate:text(form,'travelDate'),visibility:text(form,'visibility'),openToContractLanes:checked(form,'openToContractLanes'),acceptsMultiPick:checked(form,'acceptsMultiPick'),acceptsMultiDrop:checked(form,'acceptsMultiDrop')},upload);
   return redirectWith(request,returnTo,'success','Capacity and location updated.');
 }catch(error){return redirectWith(request,returnTo,'error',errorMessage(error));}
}
