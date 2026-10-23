import pg from 'pg';
import {assertPrivacyApiIdentity,processPrivacyJob,signedPrivacyHeaders} from './privacy-contract.mjs';
const allowedCodes=new Set(['INVALID_PRIVACY_JOB','PRIVACY_BINDING_CHANGED','PRIVACY_SCOPE_DENIED','PRIVACY_ABSENCE_UNVERIFIED',
 'PRIVACY_CASCADE_UNVERIFIED','PRIVACY_DISABLE_UNVERIFIED','PRIVACY_LEASE_EXPIRED','PRIVACY_ACK_UNVERIFIED','PRIVACY_UPSTREAM_UNAVAILABLE','PRIVACY_APPLICATION_UNAVAILABLE']);
const safeCode=error=>[...allowedCodes].find(code=>String(error?.message).includes(code))||'PRIVACY_UPSTREAM_UNAVAILABLE';
function safeUrl(raw,path){
 let url;try{url=new URL(raw);}catch{throw new Error('PRIVACY_UPSTREAM_UNAVAILABLE');}
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash
  ||(url.protocol==='http:'&&!['127.0.0.1','localhost','[::1]','traccar','host.docker.internal'].includes(url.hostname))
  ||(path&&url.pathname!==path))throw new Error('PRIVACY_UPSTREAM_UNAVAILABLE');return url;
}
const api=safeUrl(process.env.TRACCAR_API_URL),application=safeUrl(process.env.LOADGISTIC_PRIVACY_URL,'/api/telematics/privacy');
const config={id:process.env.GATEWAY_ID,secret:process.env.GATEWAY_PRIVACY_SECRET};
if(!config.secret||config.secret.length<32||!process.env.TRACCAR_PRIVACY_API_TOKEN)throw new Error('PRIVACY_UPSTREAM_UNAVAILABLE');
const apiUserId=Number(process.env.TRACCAR_PRIVACY_USER_ID);
if(!Number.isSafeInteger(apiUserId)||apiUserId<1)throw new Error('PRIVACY_SCOPE_DENIED');
let databaseUrl;try{databaseUrl=new URL(process.env.GATEWAY_JANITOR_DATABASE_URL);}catch{throw new Error('PRIVACY_UPSTREAM_UNAVAILABLE');}
if(!['postgres:','postgresql:'].includes(databaseUrl.protocol)||databaseUrl.username!=='loadgistic_janitor'
 ||databaseUrl.pathname!=='/traccar')throw new Error('PRIVACY_UPSTREAM_UNAVAILABLE');
const database=new pg.Pool({connectionString:process.env.GATEWAY_JANITOR_DATABASE_URL,max:1,connectionTimeoutMillis:3000,
 statement_timeout:5000,application_name:'loadgistic_privacy_janitor'});
async function boundedJson(response){
 if(!response.ok||!response.body||Number(response.headers.get('content-length')||0)>32768)throw new Error('PRIVACY_UPSTREAM_UNAVAILABLE');
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;
  if(size>32768){await reader.cancel();throw new Error('PRIVACY_UPSTREAM_UNAVAILABLE');}chunks.push(part.value);}}
 finally{reader.releaseLock();}return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function appCall(value){
 const body=JSON.stringify(value),response=await fetch(application,{method:'POST',body,headers:signedPrivacyHeaders(config,body),
  signal:AbortSignal.timeout(8000),redirect:'error'});
 if(!response.ok)throw new Error('PRIVACY_APPLICATION_UNAVAILABLE');return boundedJson(response);
}
async function deviceCall(id,method='GET',value){
 const response=await fetch(new URL(`devices/${id}`,api.href.endsWith('/')?api:`${api}/`),{method,
  headers:{Authorization:`Bearer ${process.env.TRACCAR_PRIVACY_API_TOKEN}`,Accept:'application/json',...(value?{'Content-Type':'application/json'}:{})},
  ...(value?{body:JSON.stringify(value)}:{}),signal:AbortSignal.timeout(5000),redirect:'error'});
 if(!response.ok)throw new Error('PRIVACY_UPSTREAM_UNAVAILABLE');
 if(method==='DELETE'){if(response.status!==204)throw new Error('PRIVACY_ABSENCE_UNVERIFIED');await response.body?.cancel();return;}
 return boundedJson(response);
}
const proof=async(name,job)=>(await database.query(`select loadgistic_bridge.${name}($1::jsonb) as value`,[JSON.stringify(job)])).rows[0].value;
try{
 // Fail closed if an operator accidentally supplies the provisioning administrator or bridge identity.
 const identityResponse=await fetch(new URL('users?limit=2',api.href.endsWith('/')?api:`${api}/`),{
  headers:{Authorization:`Bearer ${process.env.TRACCAR_PRIVACY_API_TOKEN}`,Accept:'application/json'},
  signal:AbortSignal.timeout(5000),redirect:'error'});
 const identities=await boundedJson(identityResponse);
 const ownIdentityResponse=await fetch(new URL(`users/${apiUserId}`,api.href.endsWith('/')?api:`${api}/`),{
  headers:{Authorization:`Bearer ${process.env.TRACCAR_PRIVACY_API_TOKEN}`,Accept:'application/json'},
  signal:AbortSignal.timeout(5000),redirect:'error'});
 assertPrivacyApiIdentity(identities,await boundedJson(ownIdentityResponse),apiUserId);
 const scope=(await database.query("select current_user as role,has_table_privilege(current_user,'public.tc_positions','SELECT') as raw_read,has_table_privilege(current_user,'loadgistic_bridge.privacy_scope','INSERT') as scope_write")).rows[0];
 if(scope.role!=='loadgistic_janitor'||scope.raw_read||scope.scope_write)throw new Error('PRIVACY_SCOPE_DENIED');
 const result=await appCall({action:'CLAIM'});
 if(!Array.isArray(result.jobs)||result.jobs.length>1)throw new Error('INVALID_PRIVACY_JOB');
 for(const job of result.jobs){
  const receipt=await processPrivacyJob(job,{gatewayId:config.id,prepare:job=>proof('prepare_privacy_job',job),
   getDevice:id=>deviceCall(id),disableDevice:device=>deviceCall(device.id,'PUT',device),deleteDevice:id=>deviceCall(id,'DELETE'),
   verifyAndPurge:job=>proof('verify_privacy_job',job),complete:command=>appCall({action:'COMPLETE',command})});
  console.log(JSON.stringify({event:'telematics_privacy_verified',purpose:receipt.purpose,verified:1}));
 }
 if(result.jobs.length===0)console.log(JSON.stringify({event:'telematics_privacy_idle',verified:0}));
}catch(error){console.error(JSON.stringify({event:'telematics_privacy_pending',code:safeCode(error)}));process.exitCode=1;}
finally{await database.end();}
