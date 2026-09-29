import {NextRequest,NextResponse} from 'next/server.js';
import {beginTransportChat} from '@/lib/transport-chat';
import {createTransportRequest} from '@/lib/transport-requests';
import {validateTransportRequest} from '@/lib/domain.js';
import {checkRateLimit,requestKey} from '@/lib/rate-limit';
import {errorMessage} from '@/lib/errors';

export async function POST(request:NextRequest){
  const rate=await checkRateLimit(requestKey(request,'transport-request'),5,60_000);
  if(!rate.allowed)return NextResponse.json({ok:false,error:'Too many requests. Please wait a minute and try again.'},{status:429,headers:{'Retry-After':String(rate.retryAfterSeconds)}});
  // Stream-limit the body; Content-Length is optional and untrusted.
  const reader=request.body?.getReader();if(!reader)return NextResponse.json({ok:false,error:'Check your route, name and phone number.'},{status:400});
  let raw='',size=0;const decoder=new TextDecoder();
  try{
    for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();return NextResponse.json({ok:false,error:'The request is too long.'},{status:413});}raw+=decoder.decode(value,{stream:true});}
    raw+=decoder.decode();const body=JSON.parse(raw),input=validateTransportRequest(body);
    const contactRate=await checkRateLimit(`transport-request-phone:${input.phone}`,10,3600_000);
    if(!contactRate.allowed)return NextResponse.json({ok:false,error:'Too many requests. Please try again later.'},{status:429});
    if(body.chatSecret!==undefined)await beginTransportChat(input,String(body.chatSecret));else await createTransportRequest(input);
    return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
  }catch(error){
    const invalid=error instanceof SyntaxError||error instanceof Error&&error.message==='INVALID_TRANSPORT_REQUEST';
    return NextResponse.json({ok:false,error:invalid?'Check your route, name and phone number.':errorMessage(error)},{status:invalid?400:503});
  }
}
