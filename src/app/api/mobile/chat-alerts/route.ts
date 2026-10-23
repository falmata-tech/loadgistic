import {mobileActor,mobileJson} from '@/lib/mobile/server';
import {readChatAlerts} from '@/lib/chat-read-server';
import {mobileChatReadFailure,limitMobileChatAlerts} from '@/lib/mobile/chat-read-server';
export async function GET(request:Request){try{const user=await mobileActor(request,true);await limitMobileChatAlerts(user.id);return mobileJson(await readChatAlerts(user.id));}catch(error){return mobileChatReadFailure(error);}}
