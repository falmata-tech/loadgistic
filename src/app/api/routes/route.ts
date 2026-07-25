import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { addRoute } from '@/lib/repository.js';
import { errorMessage } from '@/lib/errors';
import { redirectWith,text,checked } from '@/lib/redirects';

export async function POST(request:NextRequest){const user=await getCurrentUser();if(!user)return NextResponse.redirect(new URL('/login',request.url),303);const form=await request.formData();try{addRoute(user,{originLocationId:text(form,'originLocationId'),destinationLocationId:text(form,'destinationLocationId'),serviceDays:text(form,'serviceDays'),estimatedTime:text(form,'estimatedTime'),branchDropoff:checked(form,'branchDropoff'),receiverPickup:checked(form,'receiverPickup'),directDelivery:checked(form,'directDelivery'),publicVisibility:checked(form,'publicVisibility')});return redirectWith(request,'/app/routes-centers','success','Route added.');}catch(error){return redirectWith(request,'/app/routes-centers','error',errorMessage(error));}}
