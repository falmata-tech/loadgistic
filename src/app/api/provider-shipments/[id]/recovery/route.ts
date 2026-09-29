import {NextRequest,NextResponse} from 'next/server.js';
import {getCurrentUser} from '@/lib/auth';
import {recoverTracking} from '@/lib/lifecycle.js';
import {errorMessage} from '@/lib/errors';
import {redirectWith,text} from '@/lib/redirects';
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const user=await getCurrentUser({allowLimited:true});if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
 const {id}=await params;const returnTo=['ADMIN','SUPPORT'].includes(user.role)?`/admin/operations/tracking/${id}`:`/app/provider-shipments/${id}`;
 try{
  const form=await request.formData();const keys=[...form.keys()];
  if(keys.length!==new Set(keys).size||[...form.values()].some(value=>typeof value!=='string'))throw new Error('INVALID_LIFECYCLE_COMMAND');
  await recoverTracking(user,id,Object.fromEntries(form));
  return redirectWith(request,returnTo,'success',text(form,'action')==='CANCEL'?'Tracking cancelled. Guest access has ended.':'Tracking updated. Earlier events are retained.');
 }catch(error){return redirectWith(request,returnTo,'error',errorMessage(error));}
}
