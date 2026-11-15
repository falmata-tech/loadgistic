import {randomUUID} from 'node:crypto';
import {NETLIFY_MOTION_SCHEDULE,NETLIFY_MOTION_BACKGROUND,netlifyMotionConfiguration,signedNetlifyMotion} from '../../src/lib/demo-motion-netlify.mjs';

export async function dispatchNetlifyMotion(request,{environment=process.env,fetchImpl=fetch,now=Date.now}={}){
 const config=netlifyMotionConfiguration(environment,request.url,NETLIFY_MOTION_SCHEDULE);
 if(!config)return {enabled:false};
 const body=JSON.stringify({runId:randomUUID()});
 const response=await fetchImpl(config.origin+NETLIFY_MOTION_BACKGROUND,{method:'POST',body,
  headers:signedNetlifyMotion(config,NETLIFY_MOTION_BACKGROUND,body,now()),redirect:'error',credentials:'omit',
  signal:AbortSignal.timeout(10_000)});
 if(response.status!==202)throw Error('DEMO_NETLIFY_DISPATCH_FAILED');
 return {enabled:true};
}
export default async function(request){
 try{await dispatchNetlifyMotion(request);return new Response(null,{status:204});}
 catch{console.error(JSON.stringify({event:'demo-motion-dispatch',ok:false,code:'DISPATCH_FAILED'}));return new Response(null,{status:500});}
}
export const config={schedule:'* * * * *'};
