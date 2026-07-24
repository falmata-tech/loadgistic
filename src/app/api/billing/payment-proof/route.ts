import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { submitPaymentProof, saveUpload } from '@/lib/repository.js';
import { errorMessage } from '@/lib/errors';
import { redirectWith,text } from '@/lib/redirects';

export const runtime='nodejs';
export async function POST(request:NextRequest){const user=await getCurrentUser();if(!user)return NextResponse.redirect(new URL('/login',request.url),303);const form=await request.formData();try{const file=form.get('file');const upload=file&&typeof file!=='string'&&file.size?await saveUpload(file,'payment'):null;submitPaymentProof(user,text(form,'amountEtb'),text(form,'reference'),upload);return redirectWith(request,'/app/more','success','Payment proof submitted for review.');}catch(error){return redirectWith(request,'/app/more','error',errorMessage(error));}}
