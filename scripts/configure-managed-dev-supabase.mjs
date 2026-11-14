// Non-destructive development bootstrap only. This does not enroll demo actors,
// seed/reset data, configure hosted Auth/email or qualify SQL/browser workflows.
import {constants, closeSync, fstatSync, openSync, readFileSync, writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const productionProjectRef='tpwyyzoqijjmbvsmmvcm';
const existingProductionRefs=new Set([productionProjectRef,'sjeiiqxgscuqajpgddcc','muqiwsjfeydjtelypqhn']);
const projectRef=/^[a-z]{20}$/;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const fail=code=>{throw new Error(`MANAGED_DEV_${code}`);};

// The operator records these exact values from Supabase's read-only branch
// metadata. A local manifest is a target-selection record, not provider access
// control or permission to write to that branch.
export function checkedManagedDevManifest(manifest){
  const branch=manifest?.verified_branch;
  if(manifest?.version!==1||manifest.scope!=='loadgistic-managed-development'
    ||manifest.production_project_ref!==productionProjectRef
    ||typeof manifest.development_project_ref!=='string'||!projectRef.test(manifest.development_project_ref)
    ||existingProductionRefs.has(manifest.development_project_ref)
    ||typeof manifest.branch_id!=='string'||!uuid.test(manifest.branch_id)
    ||typeof manifest.branch_name!=='string'||!manifest.branch_name.trim()
    ||manifest.branch_name!==manifest.branch_name.trim()||manifest.branch_name.length>100
    ||/[\x00-\x1f\x7f]/.test(manifest.branch_name)
    ||['main','master','production'].includes(manifest.branch_name.toLowerCase()))fail('MANIFEST_INVALID');
  if(!branch||branch.id!==manifest.branch_id||branch.name!==manifest.branch_name
    ||branch.project_ref!==manifest.development_project_ref
    ||branch.parent_project_ref!==productionProjectRef||branch.is_default!==false
    ||branch.with_data!==false||branch.deletion_scheduled_at)fail('BRANCH_METADATA_MISMATCH');
  return Object.freeze({projectRef:manifest.development_project_ref,branchId:manifest.branch_id,
    branchName:manifest.branch_name,url:`https://${manifest.development_project_ref}.supabase.co`});
}

function checkedKey(key,role,ref){
  if(typeof key!=='string'||key.length<32||key.length>8192||!/^[A-Za-z0-9_.-]+$/.test(key))fail('CREDENTIAL_INVALID');
  if(key.startsWith(role==='service_role'?'sb_secret_':'sb_publishable_'))return key;
  const parts=key.split('.');
  if(parts.length!==3)fail('CREDENTIAL_INVALID');
  let claims;
  try{claims=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));}catch{fail('CREDENTIAL_INVALID');}
  // This is only a consistency refusal. Successful API reads below establish
  // that the provider accepts the keys at the selected development endpoint.
  if(claims?.ref!==ref||claims?.role!==role)fail('CREDENTIAL_TARGET_MISMATCH');
  return key;
}

export function checkedManagedDevCredentials(credentials,target){
  if(credentials?.development_project_ref!==target.projectRef)fail('CREDENTIAL_TARGET_MISMATCH');
  return Object.freeze({publishableKey:checkedKey(credentials.publishable_key,'anon',target.projectRef),
    serviceRoleKey:checkedKey(credentials.service_role_key,'service_role',target.projectRef)});
}

function readPrivateJson(filename){
  let fd;
  try{
    fd=openSync(filename,constants.O_RDONLY|constants.O_NOFOLLOW);
    const stat=fstatSync(fd);
    if(!stat.isFile()||stat.nlink!==1||(stat.mode&0o077)!==0
      ||typeof process.getuid==='function'&&stat.uid!==process.getuid())fail('PRIVATE_FILE_REQUIRED');
    return JSON.parse(readFileSync(fd,'utf8'));
  }catch(error){
    if(error?.message==='MANAGED_DEV_PRIVATE_FILE_REQUIRED')throw error;
    fail('INPUT_FILE_UNAVAILABLE');
  }finally{if(fd!==undefined)closeSync(fd);}
}

async function readJson(url,key,fetchImpl){
  let response;
  try{
    response=await fetchImpl(url,{method:'GET',redirect:'error',signal:AbortSignal.timeout(10000),
      headers:{apikey:key,authorization:`Bearer ${key}`}});
    if(!response.ok)fail('API_CHECK_FAILED');
    return await response.json();
  }catch{fail('API_CHECK_FAILED');}
}

export async function checkManagedDevApi(target,credentials,{fetchImpl=fetch}={}){
  const settings=await readJson(`${target.url}/auth/v1/settings`,credentials.publishableKey,fetchImpl);
  if(!settings||typeof settings!=='object'||Array.isArray(settings)
    ||!settings.external||typeof settings.external!=='object')fail('AUTH_CHECK_FAILED');
  const controls=await readJson(`${target.url}/rest/v1/platform_controls?select=singleton&singleton=eq.true&limit=1`,
    credentials.serviceRoleKey,fetchImpl);
  if(!Array.isArray(controls)||controls.length!==1||controls[0]?.singleton!==true)fail('DATABASE_CHECK_FAILED');
  return {auth:true,database:true};
}

export function managedDevEnvironment(target,credentials){
  return [
    '# Verified development branch only; fixtures and SMTP are not configured.',
    `# Supabase development project: ${target.projectRef}`,
    'APP_URL=http://127.0.0.1:3100',
    `NEXT_PUBLIC_SUPABASE_URL=${target.url}`,
    `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${credentials.publishableKey}`,
    `SUPABASE_SERVICE_ROLE_KEY=${credentials.serviceRoleKey}`,
    `SESSION_SECRET=${randomBytes(32).toString('base64url')}`,
    `TRACKING_CODE_SECRET=${randomBytes(32).toString('base64url')}`,
    'ENABLE_LOCAL_FIXTURE_PASSWORD_LOGIN=false',
    'UPLOAD_SCANNER_BACKEND=local',
    'LOADGISTIC_LOCAL_MAILPIT_URL=',
    'RESEND_API_KEY=',
    'LOADGISTIC_SMTP_HOST=',
    'LOADGISTIC_SMTP_PORT=',
    'LOADGISTIC_SMTP_USER=',
    'LOADGISTIC_SMTP_PASSWORD=',
    'LOADGISTIC_EMAIL_WEBHOOK_URL=',
    'LOADGISTIC_EMAIL_WEBHOOK_TOKEN=',
    'LOADGISTIC_DEMO_WORLD_ENABLED=false',
    'LOADGISTIC_DEMO_WORLD_KILL_SWITCH=true',
    'LOADGISTIC_SCENARIO_WORKER_ENABLED=false',
    'LOADGISTIC_SCENARIO_WORKER_KILL_SWITCH=true',
    'LOADGISTIC_HOSTED_MOTION_ENABLED=false',
    'LOADGISTIC_HOSTED_MOTION_KILL_SWITCH=true',
    'LOADGISTIC_NATIVE_PUSH_ENABLED=false',
    ''
  ].join('\n');
}

export async function configureManagedDev({manifestPath,credentialsPath,writeEnv=false,seed=false,
  root=process.cwd(),fetchImpl=fetch}={}){
  // No shared/local fixture importer is called, including on a rejected seed.
  if(seed)fail('SEED_NOT_IMPLEMENTED');
  if(!manifestPath||!credentialsPath)fail('INPUT_PATHS_REQUIRED');
  if(process.env.NODE_ENV==='production')fail('PRODUCTION_RUNTIME_REFUSED');
  const target=checkedManagedDevManifest(readPrivateJson(manifestPath));
  const credentials=checkedManagedDevCredentials(readPrivateJson(credentialsPath),target);
  const checks=await checkManagedDevApi(target,credentials,{fetchImpl});
  if(writeEnv){
    // Exclusive creation preserves an existing preview and also refuses a
    // symlink. This file never receives production credentials or a PAT.
    let fd;
    try{fd=openSync(path.join(root,'.env.local'),constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL,0o600);}
    catch{fail('ENV_ALREADY_EXISTS_OR_UNAVAILABLE');}
    try{writeFileSync(fd,managedDevEnvironment(target,credentials));}finally{closeSync(fd);}
  }
  return {projectRef:target.projectRef,branchId:target.branchId,checks,environmentWritten:writeEnv,
    seeded:false,seedSupported:false,dataFreshnessChecked:false,schemaMigrationsChecked:false,
    emailConfigured:false,browserWorkflowsChecked:false};
}

async function main(){
  const args=process.argv.slice(2),options={};
  for(let index=0;index<args.length;index++){
    const arg=args[index];
    if(arg==='--write-env')options.writeEnv=true;
    else if(arg==='--seed')options.seed=true;
    else if(arg==='--manifest'||arg==='--credentials'){
      const key=arg==='--manifest'?'manifestPath':'credentialsPath';
      if(options[key]||!args[index+1]||args[index+1].startsWith('--'))fail('ARGUMENTS_INVALID');
      options[key]=args[++index];
    }else fail('ARGUMENTS_INVALID');
  }
  const result=await configureManagedDev(options);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(error=>{
    process.stderr.write(`${/^MANAGED_DEV_[A-Z_]+$/.test(error?.message||'')?error.message:'MANAGED_DEV_SETUP_FAILED'}\n`);
    process.exitCode=1;
  });
}
