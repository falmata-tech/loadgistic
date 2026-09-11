import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { updateCompanyPage } from '@/lib/provider-profile.js';
import { errorMessage } from '@/lib/errors';
import { redirectWith, text, checked } from '@/lib/redirects';

export async function POST(request:NextRequest){
 const user=await getCurrentUser(); if(!user) return NextResponse.redirect(new URL('/login',request.url),303);
 const form=await request.formData();
 try{await updateCompanyPage(user,{headline:text(form,'headline'),about:text(form,'about'),services:text(form,'services'),basePlaceRef:text(form,'basePlaceRef'),basePlaceLabel:text(form,'basePlaceLabel'),baseRegionCode:text(form,'baseRegionCode'),contactPhone:text(form,'contactPhone'),contactWhatsapp:text(form,'contactWhatsapp'),contactEmail:text(form,'contactEmail'),contactWebsite:text(form,'contactWebsite'),showContactPhone:checked(form,'showContactPhone'),showContactWhatsapp:checked(form,'showContactWhatsapp'),showContactEmail:checked(form,'showContactEmail'),showContactWebsite:checked(form,'showContactWebsite'),published:checked(form,'published')});return redirectWith(request,'/app/company-page','success','Provider information updated.');}
 catch(error){return redirectWith(request,'/app/company-page','error',errorMessage(error));}
}
