import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { updateCompanyPage } from '@/lib/repository.js';
import { errorMessage } from '@/lib/errors';
import { redirectWith, text, checked } from '@/lib/redirects';

export async function POST(request:NextRequest){
 const user=await getCurrentUser(); if(!user) return NextResponse.redirect(new URL('/login',request.url),303);
 const form=await request.formData();
 try{updateCompanyPage(user,{headline:text(form,'headline'),about:text(form,'about'),services:text(form,'services'),corridors:text(form,'corridors'),contactPhone:text(form,'contactPhone'),contactEmail:text(form,'contactEmail'),published:checked(form,'published')});return redirectWith(request,'/app/company-page','success','Company page updated.');}
 catch(error){return redirectWith(request,'/app/company-page','error',errorMessage(error));}
}
