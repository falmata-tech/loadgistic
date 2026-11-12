import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repositoryName='falmata-tech/loadgistic',api='https://api.github.com';
const shaPattern=/^[a-f0-9]{40}$/;
export const requiredDeliveryJobs=Object.freeze(['validate','Mobile internal-build boundaries','container',
 ...Array.from({length:8},(_,i)=>`e2e-shards (${i+1})`),
 'featured-prepare (featured-team-permission)','featured-prepare (featured-operations-review)','featured-prepare (platform-controls)','e2e','release-ready']);
const reject=(code,httpStatus)=>{const error=Error(`NETLIFY_DELIVERY_${code}`);if(Number.isInteger(httpStatus)&&httpStatus>=100&&httpStatus<=599)error.httpStatus=httpStatus;throw error;};
function assertRun(run){
 if(!run||!Number.isSafeInteger(run.id)||run.id<=0||!Number.isSafeInteger(run.run_attempt)||run.run_attempt<=0
  ||run.name!=='CI'||run.path!=='.github/workflows/ci.yml'||run.head_branch!=='main'||run.event!=='push'
  ||run.status!=='completed'||run.conclusion!=='success'||!shaPattern.test(run.head_sha)
  ||run.head_repository?.full_name!==repositoryName)reject('RUN_REJECTED');
}
export async function promoteNetlifyProduction({event,repository,eventName,token,dryRun=false,fetchImpl=fetch}){
 if(repository!==repositoryName||eventName!=='workflow_run'||event?.repository?.full_name!==repositoryName)reject('EVENT_REJECTED');
 assertRun(event.workflow_run);
 if(!dryRun&&(typeof token!=='string'||!token.length))reject('TOKEN_REQUIRED');
 const source=event.workflow_run,sha=source.head_sha,base=`/repos/${repositoryName}`;
 async function request(endpoint,{method='GET',body,allowMissing=false}={}){
  let response;
  try{response=await fetchImpl(`${api}${base}${endpoint}`,{method,redirect:'error',signal:AbortSignal.timeout(20000),
   headers:{Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},
   ...(body?{body:JSON.stringify(body)}:{})});}
  catch{reject(method==='GET'?'REQUEST_FAILED':'WRITE_UNCONFIRMED');}
  if(allowMissing&&response.status===404)return null;
  if(!response.ok)reject(method==='GET'?'READ_FAILED':'WRITE_UNCONFIRMED',response.status);
  try{return await response.json();}catch{reject(method==='GET'?'RESPONSE_REJECTED':'WRITE_UNCONFIRMED');}
 }
 const currentRun=await request(`/actions/runs/${source.id}`);assertRun(currentRun);
 if(currentRun.id!==source.id||currentRun.head_sha!==sha||currentRun.run_attempt!==source.run_attempt)reject('STALE_RUN');
 const result=await request(`/actions/runs/${source.id}/jobs?filter=latest&per_page=100`);
 if(!Array.isArray(result?.jobs)||result.total_count!==16||result.jobs.length!==16)reject('JOBS_REJECTED');
 const names=new Set();
 for(const job of result.jobs){
  if(!job||!requiredDeliveryJobs.includes(job.name)||names.has(job.name)||job.status!=='completed'||job.conclusion!=='success')reject('JOBS_REJECTED');
  names.add(job.name);
 }
 async function requireCurrentMain(){if((await request('/git/ref/heads/main'))?.object?.sha!==sha)reject('MAIN_MOVED');}
 await requireCurrentMain();
 const previous=await request('/git/ref/heads/production',{allowMissing:true});
 const previousSha=previous?.object?.sha;
 if(previous&&!shaPattern.test(previousSha))reject('REF_REJECTED');
 if(previousSha===sha)return {operation:'UNCHANGED',sha,jobs:names.size};
 if(previousSha){
  const comparison=await request(`/compare/${previousSha}...${sha}`);
  if(comparison?.status!=='ahead')reject('NON_FAST_FORWARD');
 }
 await requireCurrentMain();
 const operation=previous?'ADVANCED':'CREATED';
 if(dryRun)return {operation:`DRY_RUN_${operation}`,sha,jobs:names.size};
 const updated=await request(previous?'/git/refs/heads/production':'/git/refs',{
  method:previous?'PATCH':'POST',body:previous?{sha,force:false}:{ref:'refs/heads/production',sha}
 });
 if(updated?.object?.sha!==sha)reject('WRITE_UNCONFIRMED');
 let readback;try{readback=await request('/git/ref/heads/production');}catch{reject('WRITE_UNCONFIRMED');}
 if(readback?.object?.sha!==sha)reject('WRITE_UNCONFIRMED');
 return {operation,sha,jobs:names.size};
}
// Netlify independently checks the delivered SHA too: a direct/manual push to
// the delivery ref must not become a way around successful main CI.
export async function verifyNetlifyProductionSource({sha,fetchImpl=fetch}){
 if(!shaPattern.test(sha))reject('SOURCE_REJECTED');
 let response,data;
 try{
  response=await fetchImpl(`${api}/repos/${repositoryName}/actions/runs?event=push&head_sha=${sha}&per_page=20`,{
   method:'GET',redirect:'error',signal:AbortSignal.timeout(20000),headers:{Accept:'application/vnd.github+json','User-Agent':'Loadgistic-Netlify-release-gate'}
  });
 }catch{reject('QUALIFICATION_UNAVAILABLE');}
 if(!response.ok)reject('READ_FAILED',response.status);
 try{data=await response.json();}catch{reject('RESPONSE_REJECTED');}
 if(!Array.isArray(data?.workflow_runs))reject('SOURCE_REJECTED');
 const run=data.workflow_runs.find(r=>r.name==='CI'&&r.path==='.github/workflows/ci.yml'&&r.head_sha===sha&&r.head_branch==='main'&&r.event==='push');
 if(!run)reject('SOURCE_REJECTED');
 const result=await promoteNetlifyProduction({event:{repository:{full_name:repositoryName},workflow_run:run},
  repository:repositoryName,eventName:'workflow_run',dryRun:true,fetchImpl});
 if(result.operation!=='UNCHANGED')reject('SOURCE_REF_MISMATCH');
 return {sha:result.sha,jobs:result.jobs};
}
async function main(){
 try{
  const args=process.argv.slice(2);if(args.length>1||(args.length===1&&args[0]!=='--dry-run'))reject('ARGUMENTS_REJECTED');
  const result=await promoteNetlifyProduction({event:JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8')),
   repository:process.env.GITHUB_REPOSITORY,eventName:process.env.GITHUB_EVENT_NAME,token:process.env.GITHUB_TOKEN,dryRun:args[0]==='--dry-run'});
  process.stdout.write(`NETLIFY_DELIVERY_${result.operation} target=production sha=${result.sha} jobs=${result.jobs}\n`);
 }catch(error){
  const code=error?.message,suffix=Number.isInteger(error?.httpStatus)&&error.httpStatus>=100&&error.httpStatus<=599?` http_status=${error.httpStatus}`:'';
  process.stderr.write(/^NETLIFY_DELIVERY_[A-Z_]+$/.test(code)?`${code}${suffix}\n`:'NETLIFY_DELIVERY_FAILED\n');process.exitCode=1;
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
