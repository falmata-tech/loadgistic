function cleanHeader(value,maxLength){
  const text=String(value||'').trim();
  if(!text||text.length>maxLength||/[\r\n]/.test(text))return null;
  return text;
}

function validHttpsUrl(value){
  try{
    const url=new URL(String(value||''));
    return url.protocol==='https:'?url:null;
  }catch{return null;}
}

export function emailDeliveryStatus(environment=process.env){
  const resendKey=cleanHeader(environment.RESEND_API_KEY,512);
  const from=cleanHeader(environment.LOADGISTIC_EMAIL_FROM,320);
  if(resendKey&&from&&from.includes('@'))return {configured:true,provider:'resend'};
  const webhook=validHttpsUrl(environment.LOADGISTIC_EMAIL_WEBHOOK_URL);
  if(webhook)return {configured:true,provider:'webhook'};
  return {configured:false,provider:'none'};
}

async function sendThroughResend(message,idempotencyKey,environment,fetchImpl){
  const from=cleanHeader(environment.LOADGISTIC_EMAIL_FROM,320);
  const replyTo=cleanHeader(environment.LOADGISTIC_EMAIL_REPLY_TO,320);
  const apiKey=cleanHeader(environment.RESEND_API_KEY,512);
  if(!from||!apiKey)throw new Error('EMAIL_PROVIDER_NOT_CONFIGURED');
  const response=await fetchImpl('https://api.resend.com/emails',{
    method:'POST',
    headers:{
      authorization:`Bearer ${apiKey}`,
      'content-type':'application/json',
      'idempotency-key':idempotencyKey,
      'user-agent':'Loadgistic/1.0'
    },
    body:JSON.stringify({
      from,to:[message.to],subject:message.subject,text:message.text,html:message.html,
      ...(replyTo&&replyTo.includes('@')?{reply_to:replyTo}:{})
    }),
    signal:AbortSignal.timeout(8000)
  });
  if(!response.ok)throw new Error(`EMAIL_PROVIDER_HTTP_${response.status}`);
  return {provider:'resend'};
}

async function sendThroughWebhook(message,idempotencyKey,environment,fetchImpl){
  const endpoint=validHttpsUrl(environment.LOADGISTIC_EMAIL_WEBHOOK_URL);
  if(!endpoint)throw new Error('EMAIL_PROVIDER_NOT_CONFIGURED');
  const token=cleanHeader(environment.LOADGISTIC_EMAIL_WEBHOOK_TOKEN,512);
  const response=await fetchImpl(endpoint,{
    method:'POST',
    headers:{
      'content-type':'application/json','idempotency-key':idempotencyKey,
      ...(token?{authorization:`Bearer ${token}`}:{})
    },
    body:JSON.stringify(message),
    signal:AbortSignal.timeout(8000)
  });
  if(!response.ok)throw new Error(`EMAIL_PROVIDER_HTTP_${response.status}`);
  return {provider:'webhook'};
}

export async function sendManagedEmail(message,idempotencyKey,{environment=process.env,fetchImpl=fetch}={}){
  const key=cleanHeader(idempotencyKey,256);
  const to=cleanHeader(message?.to,320);
  const subject=cleanHeader(message?.subject,200);
  if(!key||!to||!to.includes('@')||!subject||!message?.text||!message?.html)throw new Error('INVALID_EMAIL_MESSAGE');
  const normalized={...message,to,subject};
  const status=emailDeliveryStatus(environment);
  if(status.provider==='resend')return sendThroughResend(normalized,key,environment,fetchImpl);
  if(status.provider==='webhook')return sendThroughWebhook(normalized,key,environment,fetchImpl);
  throw new Error('EMAIL_PROVIDER_NOT_CONFIGURED');
}
