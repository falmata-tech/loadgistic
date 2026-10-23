import {NextRequest,NextResponse} from 'next/server.js';
import {getCurrentUser} from '@/lib/auth';
import {readHandoverAlerts,acknowledgeHandoverAlert} from '@/lib/handover-alert-server';
import {checkRateLimit} from '@/lib/rate-limit';
const headers={'Cache-Control':'private, no-store',Vary:'Cookie, Authorization'};
async function respond(request:NextRequest){try{
 const user=await getCurrentUser({allowLimited:true});if(!user)throw Error('FORBIDDEN');
 if(!(await checkRateLimit('handover-alert:'+user.id,120,60000)).allowed)return NextResponse.json({error:'Please wait a moment.'},{status:429,headers});
 let data;if(request.method==='GET')data=await readHandoverAlerts(user.id);
 else {if(!request.headers.get('content-type')?.startsWith('application/json'))throw Error('INVALID_HANDOVER_ALERT');
  // Bound even chunked input before parsing.
  const reader=request.body?.getReader();if(!reader)throw Error('INVALID_HANDOVER_ALERT');let body='',size=0;
  try{for(;;){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.byteLength;if(size>256){await reader.cancel();throw Error('INVALID_HANDOVER_ALERT');}body+=new TextDecoder().decode(chunk.value);}}finally{reader.releaseLock();}
  let input:unknown;try{input=JSON.parse(body);}catch{throw Error('INVALID_HANDOVER_ALERT');}data=await acknowledgeHandoverAlert(user.id,input);
 }return NextResponse.json(data,{headers});
 }catch(error){const code=error instanceof Error?error.message:'';return NextResponse.json({error:'This update is not available. Refresh your updates.'},{status:code==='FORBIDDEN'?403:code==='INVALID_HANDOVER_ALERT'?400:code==='HANDOVER_ALERT_CHANGED'?409:503,headers});}}
export const GET=respond;export const POST=respond;
