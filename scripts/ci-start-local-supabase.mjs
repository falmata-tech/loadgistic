import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';

const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));

// Child output can contain local service credentials or database error bodies.
// Preserve process facts and fixed indicators only, before cleanup discards them.
// Indicators are observations, never permission to retry an unknown failure.
export function startupDiagnostic(result={}, {phase,elapsedMs}={}){
  const stderr=typeof result.stderr==='string'?result.stderr:'';
  const stdout=typeof result.stdout==='string'?result.stdout:'';
  const processErrors=new Set(['ENOBUFS','ETIMEDOUT','ENOENT','EACCES','EPERM','ENOMEM','ENOSPC','EPIPE']);
  const signals=new Set(['SIGTERM','SIGKILL','SIGINT','SIGABRT','SIGSEGV','SIGBUS']);
  return {
    phase:['first-start','cleanup','retry-start'].includes(phase)?phase:'unknown',
    exitStatus:Number.isInteger(result.status)&&result.status>=0&&result.status<=255?result.status:null,
    signal:result.signal?(signals.has(result.signal)?result.signal:'UNKNOWN'):null,
    processError:result.error?(processErrors.has(result.error.code)?result.error.code:'UNKNOWN'):null,
    elapsedMs:Number.isFinite(elapsedMs)&&elapsedMs>=0&&elapsedMs<=7200000?Math.floor(elapsedMs):null,
    stdoutBytes:Math.min(Buffer.byteLength(stdout),8388608),stderrBytes:Math.min(Buffer.byteLength(stderr),8388608),
    indicators:{
      migrationsSeen:/Applying migration\b/i.test(stderr),
      migrationError:/\bmigration\b[^\r\n]{0,300}\b(?:error|failed|failure)\b|\b(?:error|failed|failure)\b[^\r\n]{0,300}\bmigration\b/i.test(stderr),
      healthCheck:/health[ -]?check[^\r\n]{0,160}(?:fail|unhealthy)|container[^\r\n]{0,160}unhealthy/i.test(stderr),
      containerStart:/failed to start (?:container|supabase)/i.test(stderr),
      registryLimit:/toomanyrequests/i.test(stderr),
      portConflict:/address already in use|port is already allocated/i.test(stderr),
      network:/ECONNRESET|ECONNREFUSED|ETIMEDOUT|connection (?:reset|refused)|no such host|temporary failure in name resolution/i.test(stderr),
      storage:/no space left|ENOSPC/i.test(stderr),
      accessDenied:/permission denied|unauthorized|access denied|EACCES|EPERM/i.test(stderr)
    }
  };
}

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

export async function startWithBoundedRetry({start,stop,wait,report=()=>{}}){
  function attempt(operation,phase){
    const began=performance.now(),result=operation();
    if(result.status!==0||result.error||result.signal)report(startupDiagnostic(result,{phase,elapsedMs:performance.now()-began}));
    return result;
  }
  const first=attempt(start,'first-start');
  if(first.error||first.signal)return {ok:false,reason:'START_PROCESS_FAILED',retried:false};
  if(first.status===0)return {ok:true,retried:false};
  const reason=knownStartupFailure(first.stderr);
  if(!reason)return {ok:false,reason:'UNRECOGNIZED_START_FAILURE',retried:false};
  const cleanup=attempt(stop,'cleanup');
  if(cleanup.status!==0||cleanup.error||cleanup.signal)return {ok:false,reason:'LOCAL_CLEANUP_FAILED',retried:false};
  await wait();
  const second=attempt(start,'retry-start');
  if(second.status===0&&!second.error&&!second.signal)return {ok:true,reason,retried:true};
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
    wait:()=>delay(20_000),
    report:diagnostic=>process.stderr.write(`CI_SUPABASE_DIAGNOSTIC ${JSON.stringify(diagnostic)}\n`)
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
