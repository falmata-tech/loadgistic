import {createHash} from 'node:crypto';
import nodemailer from 'nodemailer';

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

function localMailpitEndpoint(environment){
  if(!new Set(['development','test']).has(String(environment.NODE_ENV||'')))return null;
  try{
    const url=new URL(String(environment.LOADGISTIC_LOCAL_MAILPIT_URL||'').trim());
    const loopback=new Set(['127.0.0.1','localhost','::1','[::1]']);
    if(url.protocol!=='http:'||!loopback.has(url.hostname)||url.username||url.password||url.search||url.hash)return null;
    if(url.pathname&&url.pathname!=='/')return null;
    return new URL('/api/v1/send',url.origin);
  }catch{return null;}
}

function validSmtpHost(value){
  const host=cleanHeader(value,253);
  if(!host||!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(host))return null;
  return host.toLowerCase();
}

function smtpConfiguration(environment){
  const host=validSmtpHost(environment.LOADGISTIC_SMTP_HOST);
  const portText=cleanHeader(environment.LOADGISTIC_SMTP_PORT,5);
  const port=portText&&/^(465|587)$/.test(portText)?Number(portText):null;
  const user=cleanHeader(environment.LOADGISTIC_SMTP_USER,320);
  const password=cleanHeader(environment.LOADGISTIC_SMTP_PASSWORD,512);
  const from=cleanHeader(environment.LOADGISTIC_EMAIL_FROM,320);
  if(!host||!port||!user||!password||!from||!from.includes('@'))return null;
  return {host,port,user,password,from};
}

function senderDomain(from){
  const match=String(from).match(/@([^\s>]+)>?\s*$/);
  return validSmtpHost(match?.[1])||'loadgistic.invalid';
}

export function emailDeliveryStatus(environment=process.env){
  if(localMailpitEndpoint(environment))return {configured:true,provider:'mailpit'};
  const resendKey=cleanHeader(environment.RESEND_API_KEY,512);
  const from=cleanHeader(environment.LOADGISTIC_EMAIL_FROM,320);
  if(resendKey&&from&&from.includes('@'))return {configured:true,provider:'resend'};
  if(smtpConfiguration(environment))return {configured:true,provider:'smtp'};
  const webhook=validHttpsUrl(environment.LOADGISTIC_EMAIL_WEBHOOK_URL);
  if(webhook)return {configured:true,provider:'webhook'};
  return {configured:false,provider:'none'};
}

async function sendThroughLocalMailpit(message,idempotencyKey,environment,fetchImpl){
  const endpoint=localMailpitEndpoint(environment);
  if(!endpoint)throw new Error('EMAIL_PROVIDER_NOT_CONFIGURED');
  const idempotencyDigest=createHash('sha256').update(idempotencyKey,'utf8').digest('hex');
  try{
    const response=await fetchImpl(endpoint,{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        From:{Email:'local@loadgistic.local',Name:'Loadgistic local'},
        To:[{Email:message.to}],Subject:message.subject,Text:message.text,HTML:message.html,
        Headers:{'X-Loadgistic-Idempotency-Key':idempotencyDigest},Tags:['loadgistic-local']
      }),
      signal:AbortSignal.timeout(8000)
    });
    if(!response.ok)throw new Error('MAILPIT_HTTP_REJECTED');
  }catch{
    throw new Error('EMAIL_PROVIDER_MAILPIT_FAILED');
  }
  return {provider:'mailpit'};
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

async function sendThroughSmtp(message,idempotencyKey,environment,createTransportImpl){
  const configuration=smtpConfiguration(environment);
  if(!configuration)throw new Error('EMAIL_PROVIDER_NOT_CONFIGURED');
  const replyTo=cleanHeader(environment.LOADGISTIC_EMAIL_REPLY_TO,320);
  const idempotencyDigest=createHash('sha256').update(idempotencyKey,'utf8').digest('hex');
  const messageId=`<loadgistic-${idempotencyDigest}@${senderDomain(configuration.from)}>`;
  try{
    const transport=createTransportImpl({
      host:configuration.host,
      port:configuration.port,
      secure:configuration.port===465,
      requireTLS:configuration.port===587,
      pool:false,
      logger:false,
      debug:false,
      connectionTimeout:8000,
      greetingTimeout:8000,
      socketTimeout:8000,
      dnsTimeout:8000,
      disableFileAccess:true,
      disableUrlAccess:true,
      auth:{user:configuration.user,pass:configuration.password},
      tls:{minVersion:'TLSv1.2',rejectUnauthorized:true}
    });
    if(!transport||typeof transport.sendMail!=='function')throw new Error('INVALID_SMTP_TRANSPORT');
    await transport.sendMail({
      from:configuration.from,
      to:message.to,
      subject:message.subject,
      text:message.text,
      html:message.html,
      messageId,
      headers:{'X-Loadgistic-Idempotency-Key':idempotencyDigest},
      ...(replyTo&&replyTo.includes('@')?{replyTo}:{})
    });
  }catch{
    throw new Error('EMAIL_PROVIDER_SMTP_FAILED');
  }
  return {provider:'smtp'};
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

export async function sendManagedEmail(message,idempotencyKey,{
  environment=process.env,
  fetchImpl=fetch,
  createTransportImpl=options=>nodemailer.createTransport(options)
}={}){
  const key=cleanHeader(idempotencyKey,256);
  const to=cleanHeader(message?.to,320);
  const subject=cleanHeader(message?.subject,200);
  if(!key||!to||!to.includes('@')||!subject||!message?.text||!message?.html)throw new Error('INVALID_EMAIL_MESSAGE');
  const normalized={...message,to,subject};
  const status=emailDeliveryStatus(environment);
  if(status.provider==='mailpit')return sendThroughLocalMailpit(normalized,key,environment,fetchImpl);
  if(status.provider==='resend')return sendThroughResend(normalized,key,environment,fetchImpl);
  if(status.provider==='smtp')return sendThroughSmtp(normalized,key,environment,createTransportImpl);
  if(status.provider==='webhook')return sendThroughWebhook(normalized,key,environment,fetchImpl);
  throw new Error('EMAIL_PROVIDER_NOT_CONFIGURED');
}
