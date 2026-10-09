import {createHash} from 'node:crypto';
import {NextRequest,NextResponse} from 'next/server.js';
import {getCurrentUser} from '@/lib/auth';
import {getTransportChatAuthority} from '@/lib/transport-chat';
import {readChatAlerts} from '@/lib/chat-read-server';
import {chatReadFailure} from '@/lib/chat-read-http';
import {checkRateLimit,requestKey} from '@/lib/rate-limit';
const headers={'Cache-Control':'private, no-store','Vary':'Cookie, Authorization'};
export async function GET(request:NextRequest){
 try{
  const scope=request.nextUrl.searchParams.get('scope');if(scope!==null&&scope!=='VISITOR')throw Error('FORBIDDEN');
  const actor=scope==='VISITOR'?null:await getCurrentUser({allowLimited:true}),visitor=scope==='VISITOR'?await getTransportChatAuthority():null;
  if(scope!=='VISITOR'&&!actor)throw Error('FORBIDDEN');
  const rate=await checkRateLimit(requestKey(request,'chat-alerts')+':'+(actor?.id||visitor?.requestId||'none'),120,60000);
  if(!rate.allowed)return NextResponse.json({error:'Please wait a moment.'},{status:429,headers});
  const data=scope==='VISITOR'&&!visitor?{unreadCount:0,waitingCount:0,items:[]}:await readChatAlerts(actor?.id||null,visitor||undefined);
  const etag='"'+createHash('sha256').update(JSON.stringify(data)).digest('hex')+'"';
  return request.headers.get('if-none-match')===etag?new NextResponse(null,{status:304,headers:{...headers,etag}}):NextResponse.json(data,{headers:{...headers,etag}});
 }catch(error){return chatReadFailure(error);}
}
