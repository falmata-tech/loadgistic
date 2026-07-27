import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { publishCapacity, saveUpload } from '@/lib/repository.js';
import { errorMessage } from '@/lib/errors';
import { redirectWith, text, checked } from '@/lib/redirects';

export const runtime='nodejs';
export async function POST(request:NextRequest){
 const user=await getCurrentUser(); if(!user) return NextResponse.redirect(new URL('/login',request.url),303);
 const form=await request.formData();
 try{
   const file=form.get('photo'); const upload=file && typeof file!=='string' && file.size ? await saveUpload(file,'capacity') : null;
   const origin=text(form,'origin'); const destination=text(form,'destination');
   publishCapacity(user,{vehicleId:text(form,'vehicleId'),status:text(form,'status'),availablePercent:text(form,'availablePercent'),acceptedLoads:text(form,'acceptedLoads'),locationArea:text(form,'locationArea'),approximateLat:text(form,'approximateLat'),approximateLng:text(form,'approximateLng'),locationPrecisionKm:text(form,'locationPrecisionKm'),locationSource:text(form,'locationSource'),origin,destination,corridor:origin&&destination?`${origin} ↔ ${destination}`:'',travelDate:text(form,'travelDate'),nextAvailable:text(form,'nextAvailable'),visibility:text(form,'visibility'),openToContractLanes:checked(form,'openToContractLanes'),acceptsMultiStop:checked(form,'acceptsMultiStop')},upload);
   return redirectWith(request,'/app/home','success','Capacity and location updated.');
 }catch(error){return redirectWith(request,'/app/home','error',errorMessage(error));}
}
