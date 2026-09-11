import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { submitPaymentProof } from '@/lib/billing.js';
import { errorMessage } from '@/lib/errors';
import { redirectWith,text } from '@/lib/redirects';

export const runtime='nodejs';
export async function POST(request:NextRequest){const user=await getCurrentUser({allowLimited:true});if(!user)return NextResponse.redirect(new URL('/login',request.url),303);const form=await request.formData();try{const file=form.get('file');await submitPaymentProof(user,text(form,'amountEtb'),text(form,'reference'),file&&typeof file!=='string'?file:null);return redirectWith(request,'/app/more','success','Payment submitted for review.');}catch(error){return redirectWith(request,'/app/more','error',errorMessage(error));}}
