import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { publishCapacity, saveUpload } from '@/lib/repository.js';
import { errorMessage } from '@/lib/errors';
import { redirectWith, text, checked } from '@/lib/redirects';

export const runtime='nodejs';
function placeValues(form:FormData,labelName:string,refName:string){const labels=form.getAll(labelName).map(String),refs=form.getAll(refName).map(String);return labels.map((label,index)=>({label,placeRef:refs[index]||''}));}
export async function POST(request:NextRequest){
 const user=await getCurrentUser(); if(!user) return NextResponse.redirect(new URL('/login',request.url),303);
 const form=await request.formData();
 const vehicleId=text(form,'vehicleId');
 const returnTo=user.role==='TRANSPORTER'&&vehicleId?`/app/fleet/${vehicleId}`:'/app/home';
 try{
   const file=form.get('photo'); const upload=file && typeof file!=='string' && file.size ? await saveUpload(file,'capacity') : null;
   publishCapacity(user,{vehicleId,status:text(form,'status'),acceptedLoads:text(form,'acceptedLoads'),availabilityGeometry:text(form,'availabilityGeometry'),movementScope:'BOTH',locationArea:text(form,'locationArea'),approximateLat:text(form,'approximateLat'),approximateLng:text(form,'approximateLng'),locationPrecisionKm:text(form,'locationPrecisionKm'),locationSource:text(form,'locationSource'),currentRoutePlaces:placeValues(form,'currentRoutePlace','currentRoutePlaceRef'),capacityAreaCenter:text(form,'capacityAreaCenter'),capacityAreaCenterPlaceRef:text(form,'capacityAreaCenterPlaceRef'),capacityAreaBoundaryPlaces:placeValues(form,'capacityAreaBoundary','capacityAreaBoundaryPlaceRef'),visibility:text(form,'visibility'),acceptsMultiPick:checked(form,'acceptsMultiPick'),acceptsMultiDrop:checked(form,'acceptsMultiDrop')},upload);
   return redirectWith(request,returnTo,'success','Capacity and location updated.');
 }catch(error){return redirectWith(request,returnTo,'error',errorMessage(error));}
}
