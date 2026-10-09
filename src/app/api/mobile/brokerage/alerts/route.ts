import {mobileJson} from '@/lib/mobile/server';
import {readNativeBrokerage} from '@/lib/mobile/brokerage-contract.js';
import {readChatAlerts} from '@/lib/chat-read-server';
import {mobileChatReadFailure,limitMobileChatAlerts} from '@/lib/mobile/chat-read-server';
export async function GET(request:Request){try{const visitor=readNativeBrokerage(request.headers.get('authorization'));if(!visitor)throw Error('FORBIDDEN');await limitMobileChatAlerts('visitor:'+visitor.requestId);return mobileJson(await readChatAlerts(null,visitor));}catch(error){return mobileChatReadFailure(error);}}
