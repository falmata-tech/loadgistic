import {workspaceFormReturnPath} from '@/lib/workspace-form-navigation.js';
import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { updateCompanyPage } from '@/lib/provider-profile.js';
import { errorMessage } from '@/lib/errors';
import { redirectWith, text, checked } from '@/lib/redirects';

export async function POST(request:NextRequest){
 const user=await getCurrentUser(); if(!user) return NextResponse.redirect(new URL('/login',request.url),303);
 const form=await request.formData();
 const returnTo=workspaceFormReturnPath(text(form,'returnTo'),'/app/company-page');
 const input:Record<string,string|boolean>={basePlaceRef:text(form,'basePlaceRef'),baseRegionCode:text(form,'baseRegionCode'),published:checked(form,'published')};
 for(const key of ['accountName','handle','headline','about','contactPhone','contactWhatsapp','contactEmail','contactWebsite'])if(form.has(key))input[key]=text(form,key);
 for(const [key,contact] of [['showContactPhone','contactPhone'],['showContactWhatsapp','contactWhatsapp'],['showContactEmail','contactEmail'],['showContactWebsite','contactWebsite']]){
  if(user.role==='TRANSPORTER'||form.has(key)||form.has(contact))input[key]=checked(form,key);
 }
 try{await updateCompanyPage(user,input);return redirectWith(request,returnTo,'success','Provider information updated.');}
 catch(error){return redirectWith(request,returnTo,'error',errorMessage(error));}
}
