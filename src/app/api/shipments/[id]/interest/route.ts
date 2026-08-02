import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { expressInterest } from '@/lib/repository.js';
import { errorMessage } from '@/lib/errors';
import { redirectWith } from '@/lib/redirects';

export async function POST(request: NextRequest,{params}:{params:Promise<{id:string}>}) {
  const user=await getCurrentUser();
  if(!user) return NextResponse.redirect(new URL('/login',request.url),303);
  const {id}=await params;
  try { expressInterest(user,id,''); return redirectWith(request,'/app/loads','success','Interest sent to the business.'); }
  catch(error){ return redirectWith(request,'/app/loads','error',errorMessage(error)); }
}
