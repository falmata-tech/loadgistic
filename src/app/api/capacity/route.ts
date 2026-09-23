import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { publishProviderCapacity } from '@/lib/provider-capacity.js';
import { removePrivateUpload, storePrivateUpload } from '@/lib/private-storage.js';
import { errorMessage } from '@/lib/errors';
import { redirectWith, text, checked } from '@/lib/redirects';

export const runtime='nodejs';
function placeValues(form:FormData,labelName:string,refName:string){const labels=form.getAll(labelName).map(String),refs=form.getAll(refName).map(String);return labels.map((label,index)=>({label,placeRef:refs[index]||''}));}
export async function POST(request:NextRequest){
 const wantsJson=request.headers.get('accept')?.includes('application/json');
 const json=(body:{ok?:boolean;error?:string},status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
 const user=await getCurrentUser(); if(!user) return wantsJson?json({error:'Sign in again to save this truck.'},401):NextResponse.redirect(new URL('/login',request.url),303);
 const form=await request.formData();
 const vehicleId=text(form,'vehicleId');
 const returnTo=user.role==='TRANSPORTER'&&vehicleId?`/app/fleet/${vehicleId}`:'/app/home';
 let upload:Awaited<ReturnType<typeof storePrivateUpload>>=null;
 try{
   const file=form.get('photo'); upload=file && typeof file!=='string' && file.size ? await storePrivateUpload(file,'capacity') : null;
   await publishProviderCapacity(user,{vehicleId,status:text(form,'status'),acceptedLoads:text(form,'acceptedLoads'),availabilityGeometry:text(form,'availabilityGeometry'),movementScope:'BOTH',locationArea:text(form,'locationArea'),approximateLat:text(form,'approximateLat'),approximateLng:text(form,'approximateLng'),locationPrecisionKm:text(form,'locationPrecisionKm'),locationSource:text(form,'locationSource'),currentRoutePlaces:placeValues(form,'currentRoutePlace','currentRoutePlaceRef'),capacityAreaCenter:text(form,'capacityAreaCenter'),capacityAreaCenterPlaceRef:text(form,'capacityAreaCenterPlaceRef'),capacityAreaBoundaryPlaces:placeValues(form,'capacityAreaBoundary','capacityAreaBoundaryPlaceRef'),visibility:text(form,'visibility'),acceptsMultiPick:checked(form,'acceptsMultiPick'),acceptsMultiDrop:checked(form,'acceptsMultiDrop')},upload);
   return wantsJson?json({ok:true}):redirectWith(request,returnTo,'success','Capacity updated.');
 }catch(error){if(upload?.path)try{await removePrivateUpload(upload.path);}catch{/* orphan cleanup can be retried operationally */}return wantsJson?json({error:errorMessage(error)},400):redirectWith(request,returnTo,'error',errorMessage(error));}
}
