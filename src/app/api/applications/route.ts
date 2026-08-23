import { NextRequest } from 'next/server.js';
import { createBusinessApplication } from '@/lib/repository.js';
import { errorMessage } from '@/lib/errors';
import { redirectWith,text } from '@/lib/redirects';
import { checkRateLimit, requestKey } from '@/lib/rate-limit';

export async function POST(request:NextRequest){const rate=checkRateLimit(requestKey(request,'application'),5,60_000);if(!rate.allowed)return redirectWith(request,'/apply','error',`Too many submissions. Try again in ${rate.retryAfterSeconds} seconds.`);const form=await request.formData();try{await createBusinessApplication({name:text(form,'name'),businessName:text(form,'businessName'),email:text(form,'email'),phone:text(form,'phone'),password:text(form,'password'),applicationType:text(form,'applicationType'),notes:text(form,'notes')});return redirectWith(request,'/login','success','Account ready. Log in to start your 7-day trial.');}catch(error){return redirectWith(request,'/apply','error',errorMessage(error));}}
