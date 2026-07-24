import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { addLocation } from '@/lib/repository.js';
import { errorMessage } from '@/lib/errors';
import { redirectWith,text,checked } from '@/lib/redirects';

export async function POST(request:NextRequest){const user=await getCurrentUser();if(!user)return NextResponse.redirect(new URL('/login',request.url),303);const form=await request.formData();try{addLocation(user,{name:text(form,'name'),city:text(form,'city'),details:text(form,'details'),phone:text(form,'phone'),businessHours:text(form,'businessHours'),acceptsDropoff:checked(form,'acceptsDropoff'),receiverPickup:checked(form,'receiverPickup'),supportsTransfer:checked(form,'supportsTransfer'),directDelivery:checked(form,'directDelivery')});return redirectWith(request,'/app/routes-centers','success','Center added.');}catch(error){return redirectWith(request,'/app/routes-centers','error',errorMessage(error));}}
