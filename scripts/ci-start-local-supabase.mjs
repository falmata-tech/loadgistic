import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';

const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));

export function knownStartupFailure(stderr=''){
  // The CLI can report pull warnings, continue through migrations, and then
  // fail for an unrelated reason. Only the final error and its immediately
  // preceding cause may authorize a retry.
  const lines=String(stderr).trim().split(/\r?\n/);
  const isError=line=>/\b(?:error|failed|failure|fatal|panic|toomanyrequests)\b/i.test(line);
  const classify=line=>{
    if(/55324/.test(line)&&/address already in use|port is already allocated/i.test(line))return 'LOCAL_MAIL_PORT_CONFLICT';
    if(/toomanyrequests/i.test(line))return 'DOCKER_REGISTRY_LIMIT';
    return null;
  };
  const terminalIndex=lines.findLastIndex(isError);
  if(terminalIndex<0)return null;
  const terminal=lines[terminalIndex];
  const direct=classify(terminal);
  if(direct)return direct;
  if(!/failed to start (?:container|supabase)/i.test(terminal))return null;
  const previousIndex=lines.findLastIndex((line,index)=>index<terminalIndex&&isError(line));
  return previousIndex>=terminalIndex-2?classify(lines[previousIndex]):null;
}

export async function startWithBoundedRetry({start,stop,wait}){
  const first=start();
  if(first.status===0)return {ok:true,retried:false};
  const reason=knownStartupFailure(first.stderr);
  if(!reason)return {ok:false,reason:'UNRECOGNIZED_START_FAILURE',retried:false};
  const cleanup=stop();
  if(cleanup.status!==0)return {ok:false,reason:'LOCAL_CLEANUP_FAILED',retried:false};
  await wait();
  const second=start();
  if(second.status===0)return {ok:true,reason,retried:true};
  return {ok:false,reason:'RETRY_FAILED',retried:true};
}

function command(executable,args){
  return spawnSync(executable,args,{
    cwd:root,
    env:process.env,
    encoding:'utf8',
    stdio:['ignore','pipe','pipe'],
    maxBuffer:4*1024*1024
  });
}

async function main(){
  if(process.env.CI!=='true'||process.env.GITHUB_ACTIONS!=='true'||process.cwd()!==root){
    throw new Error('ISOLATED_CI_RUNNER_REQUIRED');
  }
  const config=readFileSync(path.join(root,'supabase','config.toml'),'utf8');
  if(!/^project_id = "loadgistic-local"$/m.test(config))throw new Error('LOADGISTIC_LOCAL_PROJECT_REQUIRED');
  const cli=String(process.env.SUPABASE_CLI_PATH||'supabase').trim();
  const outcome=await startWithBoundedRetry({
    start:()=>command(process.execPath,[path.join(root,'scripts','start-local-supabase.mjs')]),
    stop:()=>command(cli,['stop','--no-backup']),
    wait:()=>delay(20_000)
  });
  if(!outcome.ok){
    process.stderr.write(`CI_SUPABASE_${outcome.reason}\n`);
    process.exitCode=1;
    return;
  }
  process.stdout.write(outcome.retried
    ?`Isolated Loadgistic Supabase started after one ${outcome.reason} recovery.\n`
    :'Isolated Loadgistic Supabase started.\n');
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
