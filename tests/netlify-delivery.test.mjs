import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {inspectNetlifyScanExceptions,scanExceptionPolicy} from '../scripts/check-netlify-scan-exceptions.mjs';
import {promoteNetlifyProduction,requiredDeliveryJobs,verifyNetlifyProductionSource} from '../scripts/promote-netlify-production.mjs';

const firebaseBytes=readFileSync('apps/mobile/google-services.json');
const environment={NETLIFY:'true',CONTEXT:'deploy-preview',SECRETS_SCAN_OMIT_KEYS:'LOADGISTIC_SMTP_USER,LOADGISTIC_EMAIL_REPLY_TO',SECRETS_SCAN_OMIT_PATHS:'apps/mobile/google-services.json'};
test('Netlify exceptions accept only the reviewed public client file and precise omissions',()=>{
 assert.deepEqual(inspectNetlifyScanExceptions({firebaseBytes,environment}),{reviewedClientFiles:1,reviewedMailboxFields:0});
 for(const extra of [{SECRETS_SCAN_OMIT_PATHS:'apps/**'},{SECRETS_SCAN_OMIT_KEYS:environment.SECRETS_SCAN_OMIT_KEYS+',LOADGISTIC_SMTP_PASSWORD'},
  {SECRETS_SCAN_ENABLED:'false'},{SECRETS_SCAN_SMART_DETECTION_ENABLED:'false'},{SECRETS_SCAN_OMIT_KEYS:undefined}]){
  assert.throws(()=>inspectNetlifyScanExceptions({firebaseBytes,environment:{...environment,...extra}}),/NETLIFY_SCAN_POLICY_REJECTED/);
 }
 assert.equal(scanExceptionPolicy.firebasePath,'apps/mobile/google-services.json');
});
test('the two actual already-recorded mailbox identities remain accepted without copying their values',()=>{
 const env={...environment};
 for(const [key,file] of [['LOADGISTIC_SMTP_USER','docs/MOBILE_IMPLEMENTATION.md'],['LOADGISTIC_EMAIL_REPLY_TO','scripts/telematics/demo-manifest.mjs']]){
  const candidates=readFileSync(file,'utf8').match(/[A-Za-z0-9.!#$%&*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)||[];
  env[key]=candidates.find(value=>createHash('sha256').update(value).digest('hex')===scanExceptionPolicy.mailboxSha256[key]);
  assert.equal(typeof env[key],'string',`${key} source identity was not found`);
 }
 assert.deepEqual(inspectNetlifyScanExceptions({firebaseBytes,environment:env}),{reviewedClientFiles:1,reviewedMailboxFields:2});
});
test('production build cannot start from main, an unknown source or a missing delivered SHA',()=>{
 for(const extra of [{CONTEXT:'production',BRANCH:'main',COMMIT_REF:'a'.repeat(40)},{CONTEXT:'production',BRANCH:'production'},
  {CONTEXT:'production',BRANCH:'production',COMMIT_REF:'PRIVATE_VALUE'},{CONTEXT:undefined},{CONTEXT:'unknown'}]){
  assert.throws(()=>inspectNetlifyScanExceptions({firebaseBytes,environment:{...environment,...extra}}),/NETLIFY_PRODUCTION_SOURCE_REJECTED/);
 }
});
test('a changed or private client payload and changed mailbox values fail before build without leaking values',()=>{
 for(const bytes of [Buffer.concat([firebaseBytes,Buffer.from('\n')]),Buffer.from('{"private_key":"PRIVATE_VALUE"}')]){
  assert.throws(()=>inspectNetlifyScanExceptions({firebaseBytes:bytes,environment}),/^Error: NETLIFY_CLIENT_CONFIG_REVIEW_REQUIRED$/);
 }
 for(const key of ['LOADGISTIC_SMTP_USER','LOADGISTIC_EMAIL_REPLY_TO']){
  assert.throws(()=>inspectNetlifyScanExceptions({firebaseBytes,environment:{...environment,[key]:'PRIVATE_VALUE'}}),/^Error: NETLIFY_MAILBOX_REVIEW_REQUIRED$/);
 }
});
test('the actual prebuild entry point fails with a bounded code and preserves scanner coverage',()=>{
 const result=spawnSync(process.execPath,['scripts/check-netlify-scan-exceptions.mjs'],{
  env:{...process.env,...environment,LOADGISTIC_SMTP_USER:'PRIVATE_VALUE'},encoding:'utf8',timeout:10000
 });
 assert.equal(result.status,1);assert.match(result.stderr,/NETLIFY_MAILBOX_REVIEW_REQUIRED/);
 assert.doesNotMatch(result.stdout+result.stderr,/PRIVATE_VALUE|@|AIza/);
 const config=readFileSync('netlify.toml','utf8');
 assert.match(config,/command = "node scripts\/check-netlify-scan-exceptions\.mjs && npm run build"/);
 assert.deepEqual([...config.matchAll(/^SECRETS_SCAN_OMIT_(KEYS|PATHS) = "([^"]+)"/gm)].map(m=>[m[1],m[2]]),[
  ['KEYS',environment.SECRETS_SCAN_OMIT_KEYS],['PATHS',environment.SECRETS_SCAN_OMIT_PATHS]
 ]);
 assert.doesNotMatch(config,/SECRETS_SCAN_(?:SMART_DETECTION_)?ENABLED\s*=\s*"false"/);
});

const repository='falmata-tech/loadgistic',sha='a'.repeat(40),oldSha='b'.repeat(40);
function fixture(options={}){
 const run={id:123,run_attempt:1,name:'CI',path:'.github/workflows/ci.yml',head_sha:sha,head_branch:'main',event:'push',status:'completed',conclusion:'success',head_repository:{full_name:repository}};
 const event={repository:{full_name:repository},workflow_run:structuredClone(run)};
 const jobs=requiredDeliveryJobs.map(name=>({name,status:'completed',conclusion:'success'}));
 const calls=[];let production=options.production===undefined?oldSha:options.production;
 const fetchImpl=async(url,init)=>{
  const p=new URL(url).pathname,method=init.method||'GET';calls.push({p,method,body:init.body&&JSON.parse(init.body)});
  let status=200,data;
  if(method!=='GET'){
   production=JSON.parse(init.body).sha;
   if(options.ambiguousWrite)throw Error('PRIVATE_VALUE');
   data={object:{sha:production}};
  }else if(p.endsWith('/actions/runs'))data={workflow_runs:[run]};
  else if(p.endsWith('/actions/runs/123'))data=run;
  else if(p.endsWith('/actions/runs/123/jobs'))data={total_count:jobs.length,jobs};
  else if(p.endsWith('/git/ref/heads/main'))data={object:{sha:options.main||(options.mainMoves&&calls.filter(c=>c.p.endsWith('/git/ref/heads/main')).length>1?oldSha:sha)}};
  else if(p.endsWith('/git/ref/heads/production')){if(production)data={object:{sha:options.wrongReadback&&calls.some(c=>c.method!=='GET')?oldSha:production}};else{status=404;data={};}}
  else if(p.includes('/compare/'))data={status:options.comparison||'ahead'};
  else throw Error('UNEXPECTED_TEST_ROUTE');
  return {ok:status>=200&&status<300,status,json:async()=>data};
 };
 return {event,repository,eventName:'workflow_run',token:'PRIVATE_VALUE',fetchImpl,run,jobs,calls,getProduction:()=>production};
}
test('only a complete successful exact main run can fast-forward production, with readback',async()=>{
 const f=fixture();const result=await promoteNetlifyProduction(f);
 assert.deepEqual(result,{operation:'ADVANCED',sha,jobs:16});
 assert.equal(f.getProduction(),sha);
 assert.deepEqual(f.calls.filter(c=>c.method!=='GET'),[{p:'/repos/falmata-tech/loadgistic/git/refs/heads/production',method:'PATCH',body:{sha,force:false}}]);
 assert.equal(f.calls.at(-1).p,'/repos/falmata-tech/loadgistic/git/ref/heads/production');
});
test('production bootstrap, idempotence and read-only dry runs preserve the exact qualifying commit',async()=>{
 const initial=fixture({production:null});assert.equal((await promoteNetlifyProduction(initial)).operation,'CREATED');
 assert.deepEqual(initial.calls.find(c=>c.method==='POST').body,{ref:'refs/heads/production',sha});
 for(const options of [{production:sha},{dryRun:true},{production:null,dryRun:true}]){
  const f=fixture(options);const result=await promoteNetlifyProduction({...f,dryRun:options.dryRun});
  assert.equal(f.calls.filter(c=>c.method!=='GET').length,0);
  assert.equal(result.sha,sha);
 }
});
test('Netlify independently requires successful same-main CI and a matching production ref, using reads only',async()=>{
 const f=fixture({production:sha});assert.deepEqual(await verifyNetlifyProductionSource({sha,fetchImpl:f.fetchImpl}),{sha,jobs:16});
 assert.equal(f.calls.filter(c=>c.method!=='GET').length,0);
 for(const options of [{production:oldSha},{main:oldSha}]){
  const bad=fixture(options);await assert.rejects(verifyNetlifyProductionSource({sha,fetchImpl:bad.fetchImpl}),/NETLIFY_DELIVERY_/);
  assert.equal(bad.calls.filter(c=>c.method!=='GET').length,0);
 }
 const failed=fixture({production:sha});failed.run.conclusion='failure';
 await assert.rejects(verifyNetlifyProductionSource({sha,fetchImpl:failed.fetchImpl}),/NETLIFY_DELIVERY_/);
 assert.equal(failed.calls.filter(c=>c.method!=='GET').length,0);
});
test('foreign, failed, stale, partial or skipped evidence never mutates production',async()=>{
 const changes=[f=>{f.eventName='push';},f=>{f.repository='foreign/repo';},f=>{f.event.workflow_run.head_branch='feature';},
  f=>{f.event.workflow_run.event='pull_request';},f=>{f.event.workflow_run.head_repository.full_name='foreign/repo';},
  f=>{f.run.conclusion='failure';},f=>{f.run.head_sha=oldSha;},f=>{f.run.run_attempt=2;},
  f=>{f.run.path='.github/workflows/other.yml';},f=>{f.jobs.pop();},f=>{f.jobs[0].conclusion='skipped';},
  f=>{f.jobs[0].status='in_progress';},f=>{f.jobs[1].name=f.jobs[0].name;}];
 for(const change of changes){const f=fixture();change(f);await assert.rejects(promoteNetlifyProduction(f),/NETLIFY_DELIVERY_/);assert.equal(f.calls.filter(c=>c.method!=='GET').length,0);}
 for(const options of [{main:oldSha},{mainMoves:true},{comparison:'diverged'},{comparison:'behind'}]){
  const f=fixture(options);await assert.rejects(promoteNetlifyProduction(f),/NETLIFY_DELIVERY_/);assert.equal(f.calls.filter(c=>c.method!=='GET').length,0);
 }
});
test('production delivery is isolated from untrusted PR code, persistent credentials and forced history',()=>{
 const source=readFileSync('.github/workflows/netlify-production.yml','utf8');
 assert.match(source,/workflow_run:\n\s+workflows: \[CI\]\n\s+types: \[completed\]\n\s+branches: \[main\]/);
 assert.match(source,/workflow_run\.event == 'push'/);
 assert.match(source,/workflow_run\.head_repository\.full_name == github\.repository/);
 assert.match(source,/persist-credentials: false/);
 assert.match(source,/actions: read\n\s+contents: write/);
 assert.doesNotMatch(source,/pull_request_target|download-artifact|secrets\.|NETLIFY_AUTH_TOKEN|SUPABASE_ACCESS_TOKEN|continue-on-error/);
});
test('ambiguous writes and failed readbacks stop without retrying or rolling back',async()=>{
 for(const options of [{ambiguousWrite:true},{wrongReadback:true}]){
  const f=fixture(options);await assert.rejects(promoteNetlifyProduction(f),/^Error: NETLIFY_DELIVERY_WRITE_UNCONFIRMED$/);
  assert.equal(f.calls.filter(c=>c.method!=='GET').length,1);
 }
});
test('metadata denial and unavailability fail closed with bounded status evidence and no write',async()=>{
 for(const status of [403,429,503]){
  const f=fixture();f.fetchImpl=async()=>({ok:false,status,json:async()=>({message:'PRIVATE_VALUE'})});
  await assert.rejects(promoteNetlifyProduction(f),e=>e.message==='NETLIFY_DELIVERY_READ_FAILED'&&e.httpStatus===status);
  await assert.rejects(verifyNetlifyProductionSource({sha,fetchImpl:f.fetchImpl}),e=>e.message==='NETLIFY_DELIVERY_READ_FAILED'&&e.httpStatus===status);
  assert.equal(f.calls.length,0);
 }
 await assert.rejects(verifyNetlifyProductionSource({sha,fetchImpl:async()=>{throw Error('PRIVATE_VALUE');}}),/^Error: NETLIFY_DELIVERY_QUALIFICATION_UNAVAILABLE$/);
});
