import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { addProof, saveUpload } from '@/lib/repository.js';
import { errorMessage } from '@/lib/errors';
import { redirectWith, text } from '@/lib/redirects';

export const runtime='nodejs';
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const user=await getCurrentUser(); if(!user) return NextResponse.redirect(new URL('/login',request.url),303);
 const {id}=await params; const form=await request.formData();
 try{
   const file=form.get('file');
   const upload=await saveUpload(file,'proof');
   addProof(user,id,text(form,'proofType'),upload,text(form,'note'));
   return redirectWith(request,`/app/shipments/${id}`,'success','Proof uploaded.');
 }catch(error){return redirectWith(request,`/app/shipments/${id}`,'error',errorMessage(error));}
}
