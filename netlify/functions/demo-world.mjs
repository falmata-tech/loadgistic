import {
  createDemoWorldSignature,demoWorldOrigin,demoWorldWorkerEnabled,
  DEMO_WORLD_BACKGROUND_PATH,DEMO_WORLD_SIGNATURE_HEADER,DEMO_WORLD_TIMESTAMP_HEADER
} from '../../src/lib/demo-world-worker-auth.js';

export async function dispatchDemoWorld({invocationUrl,environment=process.env,fetchImpl=fetch,now=Date.now()}={}){
  if(!demoWorldWorkerEnabled(environment))return {enabled:false};
  let incoming;
  try{incoming=new URL(String(invocationUrl||''));}catch{throw Error('DEMO_WORLD_DISPATCH_ORIGIN_INVALID');}
  if(incoming.origin!==demoWorldOrigin(environment)
    ||incoming.pathname!=='/.netlify/functions/demo-world')throw Error('DEMO_WORLD_DISPATCH_ORIGIN_INVALID');
  const target=new URL(DEMO_WORLD_BACKGROUND_PATH,incoming.origin);
  const timestamp=String(now);
  const response=await fetchImpl(target,{
    method:'POST',
    redirect:'error',
    headers:{
      [DEMO_WORLD_TIMESTAMP_HEADER]:timestamp,
      [DEMO_WORLD_SIGNATURE_HEADER]:createDemoWorldSignature({timestamp,url:target.href,purpose:'dispatch'},environment)
    },
    signal:AbortSignal.timeout(8000)
  });
  if(!response.ok)throw Error('DEMO_WORLD_DISPATCH_FAILED');
  return {enabled:true,status:response.status};
}

export async function executeDemoWorldDispatch(request,options={}){
  try{
    const result=await dispatchDemoWorld({invocationUrl:request?.url,...options});
    if(!result.enabled)return new Response(null,{status:204});
    console.info(JSON.stringify({event:'demo-world-dispatch',ok:true,status:result.status}));
    return new Response(null,{status:202});
  }catch{
    console.error(JSON.stringify({event:'demo-world-dispatch',ok:false,error:'DISPATCH_FAILED'}));
    return new Response(null,{status:500});
  }
}

export default async function(request){return executeDemoWorldDispatch(request);}

export const config={schedule:'*/15 * * * *'};
