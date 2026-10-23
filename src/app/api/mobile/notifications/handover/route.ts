import {mobileActor,mobileBody,mobileJson,mobileFailure,MobileError} from '@/lib/mobile/server';
import {readHandoverAlerts,acknowledgeHandoverAlert} from '@/lib/handover-alert-server';
import {limitMobileChatAlerts} from '@/lib/mobile/chat-read-server';
async function respond(request:Request){try{
 const user=await mobileActor(request,true);await limitMobileChatAlerts(user.id);
 return mobileJson(request.method==='GET'?await readHandoverAlerts(user.id):await acknowledgeHandoverAlert(user.id,await mobileBody(request)));
 }catch(error){const code=error instanceof Error?error.message:'';
  return mobileFailure(['FORBIDDEN','HANDOVER_ALERT_CHANGED','INVALID_HANDOVER_ALERT'].includes(code)?new MobileError(code==='FORBIDDEN'?403:code==='HANDOVER_ALERT_CHANGED'?409:400,code,'This update is not available. Refresh your updates.'):error);
 }}
export const GET=respond;export const POST=respond;
