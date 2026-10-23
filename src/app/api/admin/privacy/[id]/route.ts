import {NextRequest} from 'next/server.js';
import {z} from 'zod';
import {getCurrentUser} from '@/lib/auth';
import {eraseRequestedAccount} from '@/lib/privacy/account-deletion';
import {checkRateLimit,requestKey} from '@/lib/rate-limit';
import {redirectWith} from '@/lib/redirects';
export const runtime='nodejs';
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const user=await getCurrentUser({allowLimited:true}),{id}=await params;
 if(!user||user.role!=='ADMIN'||!z.string().uuid().safeParse(id).success)return redirectWith(request,'/admin/privacy','error','You do not have access to that request.');
 const rate=await checkRateLimit(requestKey(request,'admin-account-erasure')+':'+user.id,6,60000);
 if(!rate.allowed)return redirectWith(request,'/admin/privacy','error','Please wait before trying again.');
 const body=await request.formData();if(body.get('reviewed')!=='yes'||body.get('confirmation')!=='DELETE')return redirectWith(request,'/admin/privacy','error','Review the exact request and confirm DELETE.');
 try{const result=await eraseRequestedAccount(user.id,id);return redirectWith(request,'/admin/privacy','success',result.status==='COMPLETED'?'Deletion completed.':result.status==='HELD'?'The request is held while its active work is resolved.':'Cleanup is in progress. Continue to process the remaining files.');}
 catch{return redirectWith(request,'/admin/privacy','error','Cleanup was not completed. Review its saved state before continuing.');}
}
