import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root=process.cwd();
const cli=String(process.env.SUPABASE_CLI_PATH||'supabase').trim();
const options=new Set(process.argv.slice(2));
const supported=new Set(['--write-env','--fixtures','--verify']);
for(const option of options){
  if(!supported.has(option))throw new Error(`UNKNOWN_OPTION:${option}`);
}
if(!options.size)throw new Error('LOCAL_SUPABASE_ACTION_REQUIRED');

const status=spawnSync(cli,['status','--output','json'],{
  cwd:root,encoding:'utf8',stdio:['ignore','pipe','inherit']
});
if(status.status!==0)throw new Error('LOCAL_SUPABASE_STATUS_FAILED');
const runtime=JSON.parse(status.stdout||'{}');
const url=String(runtime.API_URL||'').trim();
const publishableKey=String(runtime.PUBLISHABLE_KEY||runtime.ANON_KEY||'').trim();
const anonKey=String(runtime.ANON_KEY||runtime.PUBLISHABLE_KEY||'').trim();
const serviceRoleKey=String(runtime.SERVICE_ROLE_KEY||'').trim();
if(!url||!publishableKey||!anonKey||!serviceRoleKey){
  throw new Error('LOCAL_SUPABASE_CONFIG_INCOMPLETE');
}
const endpoint=new URL(url);
if(!new Set(['127.0.0.1','localhost','::1']).has(endpoint.hostname)){
  throw new Error('REMOTE_SUPABASE_CONFIG_REFUSED');
}

function writeLocalEnvironment(){
  const target=path.join(root,'.env.local');
  let source='';
  try{source=readFileSync(target,'utf8');}catch(error){
    if(error?.code!=='ENOENT')throw error;
  }
  const values=new Map([
    ['APP_URL','http://localhost:3000'],
    ['NEXT_PUBLIC_SUPABASE_URL',url],
    ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',publishableKey],
    ['SUPABASE_SERVICE_ROLE_KEY',serviceRoleKey],
    ['DATA_BACKEND','supabase'],
    ['AUTH_BACKEND','supabase'],
    ['PRIVATE_STORAGE_BACKEND','supabase']
  ]);
  if(!/^SESSION_SECRET=/m.test(source))values.set('SESSION_SECRET',randomBytes(32).toString('base64url'));
  const seen=new Set();
  const lines=source.split(/\r?\n/).map(line=>{
    const match=line.match(/^([A-Z][A-Z0-9_]*)=/);
    if(!match||!values.has(match[1]))return line;
    seen.add(match[1]);
    return `${match[1]}=${values.get(match[1])}`;
  });
  for(const [key,value] of values){
    if(!seen.has(key))lines.push(`${key}=${value}`);
  }
  writeFileSync(target,`${lines.filter((line,index,array)=>line||index<array.length-1).join('\n').replace(/\n*$/,'')}\n`,{mode:0o600});
  process.stdout.write('Configured .env.local for the isolated local Supabase stack. No key values were printed.\n');
}

function runScript(script,args=[]){
  const result=spawnSync(process.execPath,[path.join(root,script),...args],{
    cwd:root,stdio:'inherit',env:{
      ...process.env,
      SUPABASE_SEED_URL:url,
      SUPABASE_SEED_ANON_KEY:anonKey,
      SUPABASE_SEED_SERVICE_ROLE_KEY:serviceRoleKey
    }
  });
  if(result.status!==0)throw new Error(`LOCAL_SUPABASE_SCRIPT_FAILED:${script}`);
}

if(options.has('--write-env'))writeLocalEnvironment();
if(options.has('--fixtures'))runScript('scripts/import-supabase-fixtures.mjs',['--reset-local']);
if(options.has('--verify'))runScript('scripts/verify-supabase-fixtures.mjs');
