import {z} from 'zod';
import {mobileActor,mobileBody,mobileFailure,mobileJson,MobileError} from '@/lib/mobile/server';
import {trackingFailure} from '@/lib/mobile/tracking-server';
import {submitProviderTrackingAppeal} from '@/lib/provider-tracking.js';
export const runtime='nodejs';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
 try{const user=await mobileActor(request,true),id=z.string().uuid().safeParse((await params).id),command=z.object({reason:z.string().trim().min(5).max(1000)}).strict().safeParse(await mobileBody(request));
  if(!id.success||!command.success)throw new MobileError(400,'INVALID_INPUT','Explain the approval problem in 5 to 1,000 characters.');
  try{await submitProviderTrackingAppeal(user,id.data,command.data.reason);}catch(error){trackingFailure(error);}
  return mobileJson({ok:true});
 }catch(error){return mobileFailure(error);}
}
