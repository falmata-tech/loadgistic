import {NETLIFY_MOTION_BACKGROUND,netlifyMotionConfiguration,authenticateNetlifyMotion,netlifyMotionClient,runNetlifyMotionWindow,readNetlifyMotionBody} from '../../src/lib/demo-motion-netlify.mjs';

export async function executeNetlifyMotion(request,{environment=process.env,fetchImpl=fetch,now=Date.now,sleep}={}){
 if(request.method!=='POST')throw Error('DEMO_NETLIFY_AUTH_DENIED');
 const config=netlifyMotionConfiguration(environment,request.url,NETLIFY_MOTION_BACKGROUND);
 if(!config)return {enabled:false};
 const body=await readNetlifyMotionBody(request);
 authenticateNetlifyMotion(request.headers,body,config,NETLIFY_MOTION_BACKGROUND,now());
 const input=JSON.parse(body);
 if(!input||Object.keys(input).join(',')!=='runId')throw Error('DEMO_NETLIFY_INPUT_DENIED');
 const signal=AbortSignal.timeout(55_000),client=netlifyMotionClient(config,{fetchImpl,now,signal});
 return {enabled:true,...await runNetlifyMotionWindow({client,runId:input.runId,now,sleep,signal})};
}
export default async function(request){
 try{const result=await executeNetlifyMotion(request);if(result.enabled)console.info(JSON.stringify({event:'demo-motion-window',...result}));}
 catch{console.error(JSON.stringify({event:'demo-motion-window',ok:false,code:'WINDOW_FAILED'}));}
}
export const config={background:true};
