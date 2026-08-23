import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { addRecurringCorridor, removeRecurringCorridor } from '@/lib/repository.js';
import { errorMessage } from '@/lib/errors';
import { redirectWith, text } from '@/lib/redirects';

export const runtime='nodejs';
function destination(form:FormData){const value=text(form,'returnTo');return value.startsWith('/app/')?value:'/app/home';}
function routePlaces(form:FormData){const labels=form.getAll('routePlace').map(String),refs=form.getAll('routePlaceRef').map(String);return labels.map((label,index)=>({label,placeRef:refs[index]||''}));}
function areaBoundaryPlaces(form:FormData){const labels=form.getAll('areaBoundaryPlace').map(String),refs=form.getAll('areaBoundaryPlaceRef').map(String);return labels.map((label,index)=>({label,placeRef:refs[index]||''}));}
export async function POST(request:NextRequest){const user=await getCurrentUser();if(!user)return NextResponse.redirect(new URL('/login',request.url),303);const form=await request.formData();const back=destination(form);try{if(text(form,'action')==='REMOVE')await removeRecurringCorridor(user,text(form,'id'));else await addRecurringCorridor(user,{geometry:text(form,'geometry'),routePlaces:routePlaces(form),areaCenter:text(form,'areaCenter'),areaCenterPlaceRef:text(form,'areaCenterPlaceRef'),areaBoundaryPlaces:areaBoundaryPlaces(form)});return redirectWith(request,back,'success',text(form,'action')==='REMOVE'?'Regular service removed.':'Regular service published.');}catch(error){return redirectWith(request,back,'error',errorMessage(error));}}
