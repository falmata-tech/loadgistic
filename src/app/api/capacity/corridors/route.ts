import { NextRequest, NextResponse } from 'next/server.js';
import { getCurrentUser } from '@/lib/auth';
import { addProviderRegularCapacity, removeProviderRegularCapacity } from '@/lib/provider-capacity.js';
import { errorMessage } from '@/lib/errors';
import { redirectWith, text } from '@/lib/redirects';

export const runtime='nodejs';
function destination(form:FormData){const value=text(form,'returnTo');return value.startsWith('/app/')?value:'/app/home';}
function routePlaces(form:FormData){const labels=form.getAll('routePlace').map(String),refs=form.getAll('routePlaceRef').map(String);return labels.map((label,index)=>({label,placeRef:refs[index]||''}));}
function areaBoundaryPlaces(form:FormData){const labels=form.getAll('areaBoundaryPlace').map(String),refs=form.getAll('areaBoundaryPlaceRef').map(String);return labels.map((label,index)=>({label,placeRef:refs[index]||''}));}
export async function POST(request:NextRequest){
  const wantsJson=request.headers.get('accept')?.includes('application/json');
  const json=(body:{ok?:boolean;error?:string},status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
  const user=await getCurrentUser();
  if(!user)return wantsJson?json({error:'Sign in again to save regular service.'},401):NextResponse.redirect(new URL('/login',request.url),303);
  const form=await request.formData();const back=destination(form);
  try{
    if(text(form,'action')==='REMOVE')await removeProviderRegularCapacity(user,text(form,'id'));
    else await addProviderRegularCapacity(user,{geometry:text(form,'geometry'),routePlaces:routePlaces(form),areaCenter:text(form,'areaCenter'),areaCenterPlaceRef:text(form,'areaCenterPlaceRef'),areaBoundaryPlaces:areaBoundaryPlaces(form)},text(form,'action')==='UPDATE'?text(form,'id'):null);
    return wantsJson?json({ok:true}):redirectWith(request,back,'success',text(form,'action')==='REMOVE'?'Regular service removed.':'Regular service published.');
  }catch(error){return wantsJson?json({error:errorMessage(error)},400):redirectWith(request,back,'error',errorMessage(error));}
}
