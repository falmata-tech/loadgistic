import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { publishCapacity, saveUpload } from '@/lib/repository.js';
import { errorMessage } from '@/lib/errors';
import { redirectWith, text } from '@/lib/redirects';

export const runtime='nodejs';
export async function POST(request:NextRequest){
 const user=await getCurrentUser(); if(!user) return NextResponse.redirect(new URL('/login',request.url),303);
 const form=await request.formData();
 try{
   const file=form.get('photo'); const upload=file && typeof file!=='string' && file.size ? await saveUpload(file,'capacity') : null;
   publishCapacity(user,{vehicleId:text(form,'vehicleId'),status:text(form,'status'),availablePercent:text(form,'availablePercent'),origin:text(form,'origin'),destination:text(form,'destination'),corridor:text(form,'corridor'),travelDate:text(form,'travelDate'),nextAvailable:text(form,'nextAvailable'),visibility:text(form,'visibility')},upload);
   return redirectWith(request,'/app/capacity','success','Capacity updated.');
 }catch(error){return redirectWith(request,'/app/capacity','error',errorMessage(error));}
}
