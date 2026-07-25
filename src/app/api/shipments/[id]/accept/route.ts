import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { acceptDirectedShipment } from '@/lib/repository.js';
import { errorMessage } from '@/lib/errors';
import { redirectWith } from '@/lib/redirects';

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const user=await getCurrentUser(); if(!user) return NextResponse.redirect(new URL('/login',request.url),303);
  const {id}=await params;
  try{acceptDirectedShipment(user,id);return redirectWith(request,`/app/shipments/${id}`,'success','Direct request accepted.');}
  catch(error){return redirectWith(request,`/app/shipments/${id}`,'error',errorMessage(error));}
}
