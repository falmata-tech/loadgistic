import {
  createManagedOperationsSignature,
  MANAGED_OPERATIONS_SIGNATURE_HEADER,
  MANAGED_OPERATIONS_TIMESTAMP_HEADER
} from '../../src/lib/managed-operations-auth.js';

function dispatchOrigin(invocationUrl,environment){
  let url;
  try{url=new URL(String(invocationUrl||''));}catch{throw new Error('ACCESS_EMAIL_RETRY_ORIGIN_INVALID');}
  const local=url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname)&&environment.NODE_ENV!=='production';
  if(url.protocol!=='https:'&&!local)throw new Error('ACCESS_EMAIL_RETRY_ORIGIN_INVALID');
  return new URL(url.origin);
}

export async function dispatchAccessEmailRetry({
  invocationUrl,environment=process.env,fetchImpl=fetch,now=Date.now()
}={}){
  const timestamp=String(now);
  const target=new URL('/.netlify/functions/access-email-retry-background',dispatchOrigin(invocationUrl,environment));
  const response=await fetchImpl(target,{
    method:'POST',
    headers:{
      [MANAGED_OPERATIONS_TIMESTAMP_HEADER]:timestamp,
      [MANAGED_OPERATIONS_SIGNATURE_HEADER]:createManagedOperationsSignature({timestamp,audience:target.origin},environment)
    },
    signal:AbortSignal.timeout(8000)
  });
  if(!response.ok)throw new Error(`ACCESS_EMAIL_RETRY_DISPATCH_HTTP_${response.status}`);
  return {ok:true,status:response.status};
}

export async function executeAccessEmailRetryDispatch(request,{
  environment=process.env,fetchImpl=fetch,now=Date.now()
}={}){
  try{
    const result=await dispatchAccessEmailRetry({invocationUrl:request?.url,environment,fetchImpl,now});
    console.info(JSON.stringify({event:'access-email-retry-dispatch',ok:true,status:result.status}));
    return new Response(null,{status:202});
  }catch{
    console.error(JSON.stringify({event:'access-email-retry-dispatch',ok:false,error:'DISPATCH_FAILED'}));
    return new Response(null,{status:500});
  }
}

export default async function(request){
  return executeAccessEmailRetryDispatch(request);
}

export const config={schedule:'*/2 * * * *'};
