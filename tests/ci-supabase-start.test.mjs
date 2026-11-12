import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,copyFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {knownStartupFailure,startWithBoundedRetry,startupDiagnostic} from '../scripts/ci-start-local-supabase.mjs';

test('startup diagnostics retain process failures and typed indicators without raw output',()=>{
  const diagnostic=startupDiagnostic({status:null,signal:'SIGTERM',error:{code:'ENOBUFS',message:'PRIVATE_VALUE'},
    stdout:'PRIVATE_VALUE',stderr:'Applying migration 123.sql\nError: health check failed PRIVATE_VALUE person@example.test https://private.test'},
    {phase:'first-start',elapsedMs:123.9});
  assert.equal(diagnostic.processError,'ENOBUFS');assert.equal(diagnostic.signal,'SIGTERM');
  assert.equal(diagnostic.exitStatus,null);assert.equal(diagnostic.elapsedMs,123);
  assert.equal(diagnostic.phase,'first-start');assert.equal(diagnostic.indicators.healthCheck,true);
  assert.equal(diagnostic.indicators.migrationsSeen,true);assert.ok(diagnostic.stderrBytes>0);
  assert.doesNotMatch(JSON.stringify(diagnostic),/PRIVATE_VALUE|example|https|123\.sql/);
  const unknown=startupDiagnostic({status:999,signal:'PRIVATE_VALUE',error:{code:'PRIVATE_VALUE'},stderr:'PRIVATE_VALUE'},
    {phase:'PRIVATE_VALUE',elapsedMs:Infinity});
  assert.equal(unknown.phase,'unknown');assert.equal(unknown.processError,'UNKNOWN');
  assert.equal(unknown.signal,'UNKNOWN');assert.equal(unknown.elapsedMs,null);assert.equal(unknown.exitStatus,null);
  assert.doesNotMatch(JSON.stringify(unknown),/PRIVATE_VALUE/);
});

test('each failed startup or cleanup is reported before the next operation, without expanding retry authority',async()=>{
  for(const scenario of [
    {first:{status:1,stderr:'migration failed PRIVATE_VALUE'},cleanup:0,expected:['start','report:first-start']},
    {first:{status:null,signal:'SIGTERM',error:{code:'ENOBUFS'},stderr:''},cleanup:0,expected:['start','report:first-start']},
    {first:{status:null,error:{code:'ENOBUFS'},stderr:'toomanyrequests'},cleanup:0,expected:['start','report:first-start']},
    {first:{status:0,error:{code:'ENOBUFS'},stderr:'toomanyrequests'},cleanup:0,expected:['start','report:first-start']},
    {first:{status:1,stderr:'toomanyrequests'},cleanup:1,expected:['start','report:first-start','stop','report:cleanup']},
    {first:{status:1,stderr:'toomanyrequests'},cleanup:0,expected:['start','report:first-start','stop','wait','start','report:retry-start']}
  ]){
    const calls=[];let attempt=0;
    const result=await startWithBoundedRetry({start:()=>{calls.push('start');return attempt++?{status:1,stderr:'PRIVATE_VALUE'}:scenario.first;},
      stop:()=>{calls.push('stop');return {status:scenario.cleanup,stderr:'PRIVATE_VALUE'};},wait:async()=>{calls.push('wait');},
      report:d=>{calls.push(`report:${d.phase}`);assert.doesNotMatch(JSON.stringify(d),/PRIVATE_VALUE/);}});
    assert.equal(result.ok,false);assert.deepEqual(calls,scenario.expected);
  }
});

test('actual CI entry point preserves failure evidence while suppressing child keys and exceptions',()=>{
  const directory=mkdtempSync(path.join(tmpdir(),'loadgistic-start-diagnostic-'));
  try{
    // Use the exact entry-point bytes in a disposable root, without this
    // checkout's ignored local OAuth file or inherited application credentials.
    mkdirSync(path.join(directory,'scripts'));mkdirSync(path.join(directory,'supabase'));
    for(const file of ['ci-start-local-supabase.mjs','start-local-supabase.mjs']){
      copyFileSync(path.join('scripts',file),path.join(directory,'scripts',file));
    }
    writeFileSync(path.join(directory,'supabase','config.toml'),'project_id = "loadgistic-local"\n');
    const fakeCli=path.join(directory,'fake-supabase');
    writeFileSync(fakeCli,"#!/usr/bin/env node\nprocess.stdout.write('PRIVATE_VALUE service_role=PRIVATE_VALUE');process.stderr.write('Error: migration failed PRIVATE_VALUE person@example.test');process.exit(1);\n",{mode:0o700});
    const result=spawnSync(process.execPath,['scripts/ci-start-local-supabase.mjs'],{
      cwd:directory,env:{PATH:process.env.PATH,CI:'true',GITHUB_ACTIONS:'true',SUPABASE_CLI_PATH:fakeCli},encoding:'utf8',timeout:10000});
    assert.equal(result.status,1);assert.match(result.stderr,/CI_SUPABASE_UNRECOGNIZED_START_FAILURE/);
    const line=result.stderr.split('\n').find(line=>line.startsWith('CI_SUPABASE_DIAGNOSTIC '));
    assert.ok(line);const diagnostic=JSON.parse(line.slice('CI_SUPABASE_DIAGNOSTIC '.length));
    assert.equal(diagnostic.phase,'first-start');assert.equal(diagnostic.exitStatus,1);
    assert.equal(diagnostic.indicators.migrationError,true);assert.ok(diagnostic.stderrBytes>0);
    assert.doesNotMatch(result.stdout+result.stderr,/PRIVATE_VALUE|person@|service_role|\/tmp\//);
  }finally{rmSync(directory,{recursive:true,force:true});}
});

test('CI startup recovery recognizes only the observed Docker quota and fixed local mail-port conflict',()=>{
  assert.equal(knownStartupFailure('Error response from daemon: toomanyrequests: Data limit exceeded'),'DOCKER_REGISTRY_LIMIT');
  assert.equal(knownStartupFailure('Bind for 0.0.0.0:55324 failed: address already in use'),'LOCAL_MAIL_PORT_CONFLICT');
  assert.equal(knownStartupFailure('Bind for 0.0.0.0:55325 failed: address already in use'),null);
  assert.equal(knownStartupFailure('migration failed: relation already exists'),null);
  assert.equal(knownStartupFailure(`toomanyrequests\n${Array(25).fill('pull resumed').join('\n')}\nmigration failed`),null);
  assert.equal(knownStartupFailure('toomanyrequests: Data limit exceeded\nBind for 0.0.0.0:55324 failed: address already in use'),'LOCAL_MAIL_PORT_CONFLICT');
  assert.equal(knownStartupFailure('Error response: toomanyrequests\nError: migration 178 failed'),null);
  assert.equal(knownStartupFailure('Bind for 0.0.0.0:55324 failed: address already in use\nError: migration 178 failed'),null);
  assert.equal(knownStartupFailure('Error response: toomanyrequests\nfailed to start container'),'DOCKER_REGISTRY_LIMIT');
  assert.equal(knownStartupFailure('Error response: failed to start container: Bind for 0.0.0.0:55324 failed: address already in use\nfailed to start container\nTry rerunning with --debug'),'LOCAL_MAIL_PORT_CONFLICT');
  assert.equal(knownStartupFailure('Error response: toomanyrequests\nError: migration 178 failed\nfailed to start container'),null);
});

test('known startup failure stops only the local stack and retries once',async()=>{
  const calls=[];
  const attempts=[{status:1,stderr:'toomanyrequests: Data limit exceeded'},{status:0,stderr:''}];
  const result=await startWithBoundedRetry({
    start:()=>{calls.push('start');return attempts.shift();},
    stop:()=>{calls.push('stop');return {status:0};},
    wait:async()=>{calls.push('wait');}
  });
  assert.deepEqual(result,{ok:true,reason:'DOCKER_REGISTRY_LIMIT',retried:true});
  assert.deepEqual(calls,['start','stop','wait','start']);
});

test('unrelated failure, failed cleanup and failed retry do not continue',async()=>{
  for(const scenario of [
    {first:'migration failed',cleanup:0,expected:'UNRECOGNIZED_START_FAILURE',calls:['start']},
    {first:'Bind for 0.0.0.0:55324 failed: address already in use',cleanup:1,expected:'LOCAL_CLEANUP_FAILED',calls:['start','stop']},
    {first:'toomanyrequests',cleanup:0,expected:'RETRY_FAILED',calls:['start','stop','wait','start']}
  ]){
    const calls=[];
    let attempt=0;
    const result=await startWithBoundedRetry({
      start:()=>{calls.push('start');return {status:1,stderr:attempt++===0?scenario.first:'still unavailable'};},
      stop:()=>{calls.push('stop');return {status:scenario.cleanup};},
      wait:async()=>{calls.push('wait');}
    });
    assert.equal(result.ok,false);
    assert.equal(result.reason,scenario.expected);
    assert.deepEqual(calls,scenario.calls);
  }
});
