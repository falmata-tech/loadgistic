import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,readdirSync,statSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {publicPilotOwnerFailure} from '../scripts/lib/pilot-owner-race-target.mjs';

test('public race failures expose only reviewed stage, code and category values',()=>{
 assert.deepEqual(publicPilotOwnerFailure('PREFLIGHT_PG_MAJOR_CHECK',Error('GPS CI PostgreSQL client/server major mismatch')),
  {stage:'PREFLIGHT_PG_MAJOR_CHECK',code:'PILOT_RACE_PG_MAJOR_MISMATCH',category:'unclassified'});
 const error=Object.assign(Error('PILOT_RACE_PROCESS_FAILED'),{category:'authentication-failed'});
 assert.deepEqual(publicPilotOwnerFailure('RESTORE_TARGET_RESTORE_ROLE',error),
  {stage:'RESTORE_TARGET_RESTORE_ROLE',code:'PILOT_RACE_PROCESS_FAILED',category:'authentication-failed'});
 for(const message of ['PRIVATE_SENTINEL: /private/customer/file.sql user=7188e96a-a4e5-4225-b2c4-fd974183dba0',
  'PILOT_RACE_PRIVATE_SENTINEL','GPS CI PRIVATE_SENTINEL','PILOT_RACE_PROCESS_FAILED\nPRIVATE_SENTINEL',
  'GPS CI PostgreSQL client/server major mismatch PRIVATE_SENTINEL']){
  const result=publicPilotOwnerFailure('PRIVATE_SENTINEL /private/customer',Object.assign(Error(message),
   {code:'PRIVATE_SENTINEL',category:'PRIVATE_SENTINEL',path:'/private/customer',stack:'PRIVATE_SENTINEL'}));
  assert.deepEqual(result,{stage:'UNKNOWN',code:'PILOT_RACE_UNCLASSIFIED',category:'unclassified'});
  assert.doesNotMatch(JSON.stringify(result),/PRIVATE_SENTINEL|private\/customer|7188e96a/);
 }
 assert.deepEqual(publicPilotOwnerFailure(null,null),{stage:'UNKNOWN',code:'PILOT_RACE_UNCLASSIFIED',category:'unclassified'});
});

const runner=path.resolve('scripts/verify-demo-pilot-owner-concurrency-local.mjs');
const fakeDocker=`#!${process.execPath}
const fs=require('node:fs');
const args=process.argv.slice(2),scenario=process.env.FAKE_PILOT_DIAGNOSTIC;
const input=fs.readFileSync(0,'utf8');
const record=value=>fs.appendFileSync(process.env.FAKE_PILOT_TRACE,value+'\\n');
if(args.includes('context')){
 record('CONTEXT');
 process.stdout.write(scenario==='unknown-json'?'PRIVATE_SENTINEL /private/customer/7188e96a':JSON.stringify('unix:///var/run/docker.sock'));
}else if(args.includes('inspect')){
 record('IDENTITY');process.stdout.write('a'.repeat(64)+'|loadgistic-local');
}else if(args.includes('pg_dump')&&args.includes('--version')){
 record('CLIENT_VERSION');process.stdout.write('pg_dump (PostgreSQL) '+(scenario==='major-mismatch'?'17.6':'15.8'));
}else if(args.includes('psql')&&input.includes("'database',current_database(),'major'")){
 record('DATABASE');process.stdout.write(JSON.stringify({database:'loadgistic_telematics_ci',major:15}));
}else if(args.includes('psql')&&input==='select current_user;'){
 record('RESTORE_ROLE');
 if(scenario==='admin-auth'){
  process.stderr.write('FATAL: password authentication failed for user PRIVATE_SENTINEL /private/customer/7188e96a');process.exitCode=1;
 }else process.stdout.write('PRIVATE_SENTINEL_WRONG_ROLE');
}else{
 record('FORBIDDEN_CALL');process.stderr.write('PRIVATE_SENTINEL unexpected database action');process.exitCode=1;
}
`;

for(const [scenario,stage,code,category,expectedCalls] of [
 ['major-mismatch','PREFLIGHT_PG_MAJOR_CHECK','PILOT_RACE_PG_MAJOR_MISMATCH','unclassified',['CONTEXT','IDENTITY','DATABASE','CLIENT_VERSION']],
 ['admin-auth','PREFLIGHT_RESTORE_ROLE','PILOT_RACE_PROCESS_FAILED','authentication-failed',['CONTEXT','IDENTITY','DATABASE','CLIENT_VERSION','RESTORE_ROLE']],
 ['wrong-role','PREFLIGHT_RESTORE_ROLE','PILOT_RACE_RESTORE_ROLE_MISMATCH','unclassified',['CONTEXT','IDENTITY','DATABASE','CLIENT_VERSION','RESTORE_ROLE']],
 ['unknown-json','PREFLIGHT_DOCKER_CONTEXT','PILOT_RACE_UNCLASSIFIED','unclassified',['CONTEXT']],
])test(`real runner publishes a bounded ${scenario} refusal before backup or fixture writes`,()=>{
 const root=mkdtempSync(path.join(tmpdir(),'loadgistic-pilot-diagnostic-')),bin=path.join(root,'bin'),trace=path.join(root,'calls.txt');
 try{
  mkdirSync(bin);writeFileSync(path.join(bin,'docker'),fakeDocker,{mode:0o700});
  const result=spawnSync(process.execPath,[runner],{cwd:root,env:{...process.env,PATH:bin,DOCKER_HOST:'',DOCKER_CONTEXT:'',
   LOADGISTIC_TEST_DATABASE:'loadgistic_telematics_ci',LOADGISTIC_PILOT_OWNER_RACE_CONFIRM:'loadgistic_telematics_ci',
   FAKE_PILOT_DIAGNOSTIC:scenario,FAKE_PILOT_TRACE:trace},encoding:'utf8',timeout:8000});
  assert.equal(result.error,undefined);assert.equal(result.status,1);assert.equal(result.stderr,'');
  const receipt=JSON.parse(result.stdout);
  assert.equal(receipt.ok,false);assert.equal(receipt.races,0);assert.equal(receipt.baselineRestored,false);assert.equal(receipt.primaryUnchanged,true);
  assert.deepEqual(receipt.failure,{stage,code,category});
  assert.doesNotMatch(result.stdout,/PRIVATE_SENTINEL|private\/customer|7188e96a|password authentication|unix:\/\/\/|loadgistic-pilot-diagnostic-/);
  assert.deepEqual(readFileSync(trace,'utf8').trim().split('\n'),expectedCalls);
  const evidence=path.join(root,'.local',readdirSync(path.join(root,'.local'))[0]);
  assert.deepEqual(JSON.parse(readFileSync(path.join(evidence,'failure.private.json'),'utf8')),receipt.failure);
  assert.equal(statSync(path.join(evidence,'failure.private.json')).mode&0o777,0o600);
  if(scenario==='admin-auth')assert.match(readFileSync(path.join(evidence,'last-process-error.private.log'),'utf8'),/PRIVATE_SENTINEL/);
  assert.equal(readdirSync(evidence).includes('baseline.private.dump'),false);
 }finally{rmSync(root,{recursive:true,force:true});}
});
