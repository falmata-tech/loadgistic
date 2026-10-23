import {NextRequest,NextResponse} from 'next/server.js';
import {getCurrentUser} from '@/lib/auth';
import {submitProviderTrackingAppeal} from '@/lib/provider-tracking.js';
import {redirectWith,text} from '@/lib/redirects';
import {errorMessage} from '@/lib/errors';
export const runtime='nodejs';
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const user=await getCurrentUser({allowLimited:true});if(!user)return NextResponse.redirect(new URL('/login',request.url),303);
 const {id}=await params;
 try{await submitProviderTrackingAppeal(user,id,text(await request.formData(),'reason'));
  return redirectWith(request,`/app/provider-shipments/${id}`,'success','Your appeal is saved. The team can review this shipment and its proof.');
 }catch(error){return redirectWith(request,`/app/provider-shipments/${id}`,'error',errorMessage(error));}
}
