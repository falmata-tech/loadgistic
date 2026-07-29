import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { updateCompanyPage } from '@/lib/repository.js';
import { errorMessage } from '@/lib/errors';
import { redirectWith, text, checked } from '@/lib/redirects';

export async function POST(request:NextRequest){
 const user=await getCurrentUser(); if(!user) return NextResponse.redirect(new URL('/login',request.url),303);
 const form=await request.formData();
 const origins=form.getAll('routeOrigin').map(String); const destinations=form.getAll('routeDestination').map(String);
 const areaRefs=form.getAll('serviceAreaPlaceRef').map(String); const areaLabels=form.getAll('serviceAreaPlaceLabel').map(String); const areaRadii=form.getAll('serviceAreaRadiusKm').map(String);
 try{updateCompanyPage(user,{headline:text(form,'headline'),about:text(form,'about'),services:text(form,'services'),routes:origins.map((origin,index)=>({origin,destination:destinations[index]||''})),serviceAreas:areaLabels.map((placeLabel,index)=>({placeRef:areaRefs[index]||'',placeLabel,radiusKm:areaRadii[index]||''})),operatingRegions:text(form,'operatingRegions'),contactPhone:text(form,'contactPhone'),showContactPhoneOnLoads:checked(form,'showContactPhoneOnLoads'),contactEmail:text(form,'contactEmail'),published:checked(form,'published')});return redirectWith(request,'/app/company-page','success','Profile updated.');}
 catch(error){return redirectWith(request,'/app/company-page','error',errorMessage(error));}
}
