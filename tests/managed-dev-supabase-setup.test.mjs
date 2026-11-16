import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {chmodSync,existsSync,mkdtempSync,readFileSync,rmSync,statSync,symlinkSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {checkedManagedDevManifest,checkedManagedDevCredentials,checkManagedDevApi,
  configureManagedDev,productionProjectRef} from '../scripts/configure-managed-dev-supabase.mjs';

const developmentRef='abcdefghijklmnopqrst';
const branchId='11111111-1111-4111-8111-111111111111';
function manifest(){
  return {version:1,scope:'loadgistic-managed-development',production_project_ref:productionProjectRef,
    development_project_ref:developmentRef,branch_id:branchId,branch_name:'loadgistic-development',
    verified_branch:{id:branchId,name:'loadgistic-development',project_ref:developmentRef,
      parent_project_ref:productionProjectRef,is_default:false,with_data:false}};
}
function jwt(ref,role){
  return `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({ref,role})).toString('base64url')}.provider-verifies-the-signature`;
}
function credentials(){
  return {development_project_ref:developmentRef,publishable_key:jwt(developmentRef,'anon'),
    service_role_key:jwt(developmentRef,'service_role')};
}
function api(calls,{auth={},controls=[{singleton:true}],status=200}={}){
  return async(url,options)=>{
    calls.push({url,options});
    assert.equal(options.method,'GET');assert.equal(options.redirect,'error');
    assert.equal(new URL(url).origin,`https://${developmentRef}.supabase.co`);
    return Response.json(url.endsWith('/auth/v1/settings')?{external:{email:true},...auth}:controls,{status});
  };
}
function setup(t){
  const root=mkdtempSync(path.join(tmpdir(),'loadgistic-managed-dev-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  const manifestPath=path.join(root,'manifest.json'),credentialsPath=path.join(root,'credentials.json');
  writeFileSync(manifestPath,JSON.stringify(manifest()),{mode:0o600});
  writeFileSync(credentialsPath,JSON.stringify(credentials()),{mode:0o600});
  return {root,manifestPath,credentialsPath};
}

test('exact nondefault data-less Loadgistic development branch metadata is required',()=>{
  assert.deepEqual(checkedManagedDevManifest(manifest()),{projectRef:developmentRef,branchId,
    branchName:'loadgistic-development',url:`https://${developmentRef}.supabase.co`});
  for(const change of [
    value=>{value.scope='production';},value=>{value.production_project_ref=developmentRef;},
    value=>{value.development_project_ref=productionProjectRef;},
    value=>{value.development_project_ref='sjeiiqxgscuqajpgddcc';},
    value=>{value.development_project_ref='muqiwsjfeydjtelypqhn';},
    value=>{value.development_project_ref='ref.supabase.co';},
    value=>{value.branch_id='not-a-branch-id';},value=>{value.branch_name='production';},
    value=>{value.branch_name=' development';},value=>{value.branch_name='bad\nname';},
    value=>{value.verified_branch.name='another-development';},
    value=>{value.verified_branch.id='22222222-2222-4222-8222-222222222222';},
    value=>{value.verified_branch.project_ref=productionProjectRef;},
    value=>{value.verified_branch.parent_project_ref='sjeiiqxgscuqajpgddcc';},
    value=>{value.verified_branch.is_default=true;},value=>{delete value.verified_branch.is_default;},
    value=>{value.verified_branch.with_data=true;},value=>{delete value.verified_branch.with_data;},
    value=>{value.verified_branch.deletion_scheduled_at='2026-01-01T00:00:00Z';}
  ]){
    const value=manifest();change(value);
    assert.throws(()=>checkedManagedDevManifest(value),/MANAGED_DEV_(?:MANIFEST_INVALID|BRANCH_METADATA_MISMATCH)/);
  }
});

test('legacy keys refuse production claims, wrong role and newline injection before any request',()=>{
  const target=checkedManagedDevManifest(manifest());
  assert.equal(checkedManagedDevCredentials(credentials(),target).serviceRoleKey,credentials().service_role_key);
  for(const change of [
    value=>{value.development_project_ref=productionProjectRef;},
    value=>{value.service_role_key=jwt(productionProjectRef,'service_role');},
    value=>{value.publishable_key=jwt(productionProjectRef,'anon');},
    value=>{value.service_role_key=jwt(developmentRef,'anon');},
    value=>{value.publishable_key=jwt(developmentRef,'service_role');},
    value=>{value.service_role_key+='\nOTHER_SECRET=bad';},
    value=>{value.service_role_key='not-a-key';}
  ]){
    const value=credentials();change(value);
    assert.throws(()=>checkedManagedDevCredentials(value,target),/MANAGED_DEV_CREDENTIAL_/);
  }
});

test('modern keys still require successful provider reads at the exact development host',async()=>{
  const target=checkedManagedDevManifest(manifest()),calls=[];
  const checked=checkedManagedDevCredentials({development_project_ref:developmentRef,
    publishable_key:`sb_publishable_${'a'.repeat(40)}`,service_role_key:`sb_secret_${'b'.repeat(40)}`},target);
  assert.deepEqual(await checkManagedDevApi(target,checked,{fetchImpl:api(calls)}),{auth:true,database:true});
  assert.equal(calls.length,2);
  assert.equal(calls[0].options.headers.apikey,checked.publishableKey);
  assert.equal(calls[1].options.headers.apikey,checked.serviceRoleKey);
  await assert.rejects(checkManagedDevApi(target,checked,{fetchImpl:api([],{status:401})}),/MANAGED_DEV_API_CHECK_FAILED/);
});

test('bootstrap reads only, creates a protected dev environment and states its acceptance limits',async t=>{
  const options=setup(t),calls=[];
  const result=await configureManagedDev({...options,writeEnv:true,fetchImpl:api(calls)});
  assert.deepEqual(result,{projectRef:developmentRef,branchId,checks:{auth:true,database:true},environmentWritten:true,
    seeded:false,seedSupported:false,dataFreshnessChecked:false,schemaMigrationsChecked:false,
    emailConfigured:false,browserWorkflowsChecked:false});
  assert.equal(calls.length,2);assert.ok(calls.every(call=>call.options.method==='GET'));
  const envPath=path.join(options.root,'.env.local'),env=readFileSync(envPath,'utf8');
  assert.equal(statSync(envPath).mode&0o777,0o600);
  assert.match(env,new RegExp(`NEXT_PUBLIC_SUPABASE_URL=https://${developmentRef}\\.supabase\\.co`));
  assert.equal(env.includes(productionProjectRef),false);
  assert.match(env,/APP_URL=http:\/\/127\.0\.0\.1:3100/);
  assert.match(env,/ENABLE_LOCAL_FIXTURE_PASSWORD_LOGIN=false/);
  for(const worker of ['DEMO_WORLD','SCENARIO_WORKER','HOSTED_MOTION']){
    assert.match(env,new RegExp(`LOADGISTIC_${worker}_ENABLED=false`));
    assert.match(env,new RegExp(`LOADGISTIC_${worker}_KILL_SWITCH=true`));
  }
  const session=env.match(/^SESSION_SECRET=(.+)$/m)[1],tracking=env.match(/^TRACKING_CODE_SECRET=(.+)$/m)[1];
  assert.notEqual(session,tracking);assert.ok(session.length>=43);
  const report=JSON.stringify(result);
  for(const secret of [credentials().service_role_key,credentials().publishable_key,session,tracking])assert.equal(report.includes(secret),false);
});

test('dry preflight writes no file and never claims fresh data or applied migrations',async t=>{
  const options=setup(t),calls=[];
  const result=await configureManagedDev({...options,fetchImpl:api(calls)});
  assert.equal(result.environmentWritten,false);assert.equal(result.dataFreshnessChecked,false);
  assert.equal(result.schemaMigrationsChecked,false);assert.equal(result.seedSupported,false);
  assert.equal(existsSync(path.join(options.root,'.env.local')),false);
});

test('existing preview environment and symlink targets are preserved',async t=>{
  const options=setup(t),env=path.join(options.root,'.env.local');
  writeFileSync(env,'existing-preview\n',{mode:0o600});
  await assert.rejects(configureManagedDev({...options,writeEnv:true,fetchImpl:api([])}),/MANAGED_DEV_ENV_ALREADY_EXISTS_OR_UNAVAILABLE/);
  assert.equal(readFileSync(env,'utf8'),'existing-preview\n');
  rmSync(env);symlinkSync(options.credentialsPath,env);
  const before=readFileSync(options.credentialsPath,'utf8');
  await assert.rejects(configureManagedDev({...options,writeEnv:true,fetchImpl:api([])}),/MANAGED_DEV_ENV_ALREADY_EXISTS_OR_UNAVAILABLE/);
  assert.equal(readFileSync(options.credentialsPath,'utf8'),before);
});

test('unsafe credential files, target mismatch and failed health never create an environment',async t=>{
  const options=setup(t),env=path.join(options.root,'.env.local');
  chmodSync(options.credentialsPath,0o644);
  await assert.rejects(configureManagedDev({...options,fetchImpl:()=>assert.fail('no request')}),/MANAGED_DEV_PRIVATE_FILE_REQUIRED/);
  chmodSync(options.credentialsPath,0o600);
  writeFileSync(options.credentialsPath,JSON.stringify({...credentials(),service_role_key:jwt(productionProjectRef,'service_role')}));
  await assert.rejects(configureManagedDev({...options,fetchImpl:()=>assert.fail('no request')}),/MANAGED_DEV_CREDENTIAL_TARGET_MISMATCH/);
  writeFileSync(options.credentialsPath,JSON.stringify(credentials()));
  for(const fetchImpl of [api([],{auth:{external:null}}),api([],{controls:[]}),api([],{status:403}),
    async()=>{throw Error(`transport detail with secret ${credentials().service_role_key}`);},
    async()=>({ok:true,json:async()=>{throw Error('invalid JSON');}})]){
    await assert.rejects(configureManagedDev({...options,writeEnv:true,fetchImpl}),/^Error: MANAGED_DEV_(?:API|AUTH|DATABASE)_CHECK_FAILED$/);
    assert.equal(existsSync(env),false);
  }
});

test('seed is refused before credential reads or network and CLI prints only a safe error',async()=>{
  await assert.rejects(configureManagedDev({seed:true,manifestPath:'missing',credentialsPath:'missing',
    fetchImpl:()=>assert.fail('no request')}),/MANAGED_DEV_SEED_NOT_IMPLEMENTED/);
  const script=new URL('../scripts/configure-managed-dev-supabase.mjs',import.meta.url);
  const result=spawnSync(process.execPath,[script.pathname,'--seed'],{encoding:'utf8'});
  assert.equal(result.status,1);assert.equal(result.stdout,'');assert.equal(result.stderr,'MANAGED_DEV_SEED_NOT_IMPLEMENTED\n');
});
