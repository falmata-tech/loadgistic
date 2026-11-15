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
 for(const [message,code] of [
  ['GPS CI GraphQL wrapper owner mismatch','PILOT_RACE_GRAPHQL_OWNER_MISMATCH'],
  ['GPS CI disposable GraphQL probe database required','PILOT_RACE_GRAPHQL_PROBE_TARGET_REQUIRED'],
  ['GPS CI fresh GraphQL wrapper ACL differs from source','PILOT_RACE_GRAPHQL_CREATION_MISMATCH'],
  ['GPS CI restored GraphQL initial privileges differ','PILOT_RACE_GRAPHQL_INITIAL_MISMATCH']]){
  assert.deepEqual(publicPilotOwnerFailure('BACKUP_GRAPHQL_CREATION_PROOF',Error(message)),
   {stage:'BACKUP_GRAPHQL_CREATION_PROOF',code,category:'unclassified'});
 }
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
if(args.includes('psql')||args.includes('-Fc')||args.includes('--exit-on-error')){
 const index=args.indexOf('-d');fs.appendFileSync(process.env.FAKE_PILOT_DATABASE_TRACE,(index<0?'MISSING':args[index+1])+'\\n');
}
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
 }else if(scenario==='missing-password'){
  process.stderr.write('PILOT_RACE_LOCAL_ADMIN_PASSWORD_REQUIRED\\n');process.exitCode=64;
 }else process.stdout.write(scenario.startsWith('archive-')?'supabase_admin':'PRIVATE_SENTINEL_WRONG_ROLE');
}else if(scenario.startsWith('archive-')&&args.includes('psql')){
 if(input.includes('exists(select 1 from public.vehicles')){record('BASELINE_GUARD');process.stdout.write('t');}
 else if(input.includes("'users',(select md5")){record('FINGERPRINT');process.stdout.write('{"synthetic":true}');}
 else if(input.includes('select e.extname')){record('GRAPHQL_MEMBER');process.stdout.write('pg_graphql');}
 else if(input.startsWith('select md5(')){record('GRAPHQL_IDENTITY');process.stdout.write('a'.repeat(32)+'|'+'b'.repeat(32));}
 else if(input.includes('select pg_get_functiondef(')){record('GRAPHQL_DEFINITION');process.stdout.write('CREATE OR REPLACE FUNCTION graphql_public.graphql("operationName" text, query text, variables jsonb, extensions jsonb) RETURNS jsonb LANGUAGE sql AS $$ SELECT null::jsonb $$;');}
 else if(input.includes("jsonb_build_object('owner'")){record('GRAPHQL_INITIAL');process.stdout.write(JSON.stringify({owner:'supabase_admin',initialAclCount:1,initialAclHash:(scenario==='archive-initial-drift'?'c':'b').repeat(32)}));}
 else if(input.startsWith('begin;')){record('CREATION_PROOF');process.stdout.write((scenario==='archive-default-drift'?'c':'b').repeat(32)+'|supabase_admin');}
 else{record('FORBIDDEN_CALL');process.stderr.write('PRIVATE_SENTINEL unexpected database action');process.exitCode=1;}
}else if(scenario.startsWith('archive-')&&args.includes('pg_dump')&&args.includes('-Fc')){
 record('ARCHIVE');process.stdout.write('synthetic-private-archive');
}else if(scenario.startsWith('archive-')&&args.includes('pg_restore')&&args.includes('-l')){
 record('TOC');process.stdout.write('; archive\\n3665; 0 0 ACL public TABLE vehicles postgres\\n'+(scenario==='archive-related'?'3666; 0 0 ACL graphql_public FUNCTION graphql(changed text) unexpected_owner\\n':''));
}else{
 record('FORBIDDEN_CALL');process.stderr.write('PRIVATE_SENTINEL unexpected database action');process.exitCode=1;
}
`;

for(const [scenario,stage,code,category,expectedCalls] of [
 ['major-mismatch','PREFLIGHT_PG_MAJOR_CHECK','PILOT_RACE_PG_MAJOR_MISMATCH','unclassified',['CONTEXT','IDENTITY','DATABASE','CLIENT_VERSION']],
 ['admin-auth','PREFLIGHT_RESTORE_ROLE','PILOT_RACE_PROCESS_FAILED','authentication-failed',['CONTEXT','IDENTITY','DATABASE','CLIENT_VERSION','RESTORE_ROLE']],
 ['wrong-role','PREFLIGHT_RESTORE_ROLE','PILOT_RACE_RESTORE_ROLE_MISMATCH','unclassified',['CONTEXT','IDENTITY','DATABASE','CLIENT_VERSION','RESTORE_ROLE']],
 ['missing-password','PREFLIGHT_RESTORE_ROLE','PILOT_RACE_LOCAL_ADMIN_PASSWORD_REQUIRED','unclassified',['CONTEXT','IDENTITY','DATABASE','CLIENT_VERSION','RESTORE_ROLE']],
 ['unknown-json','PREFLIGHT_DOCKER_CONTEXT','PILOT_RACE_UNCLASSIFIED','unclassified',['CONTEXT']],
])test(`real runner publishes a bounded ${scenario} refusal before backup or fixture writes`,()=>{
 const root=mkdtempSync(path.join(tmpdir(),'loadgistic-pilot-diagnostic-')),bin=path.join(root,'bin'),trace=path.join(root,'calls.txt'),databaseTrace=path.join(root,'databases.txt');
 try{
  mkdirSync(bin);writeFileSync(path.join(bin,'docker'),fakeDocker,{mode:0o700});
  const result=spawnSync(process.execPath,[runner],{cwd:root,env:{...process.env,PATH:bin,DOCKER_HOST:'',DOCKER_CONTEXT:'',
   LOADGISTIC_TEST_DATABASE:'loadgistic_telematics_ci',LOADGISTIC_PILOT_OWNER_RACE_CONFIRM:'loadgistic_telematics_ci',
   FAKE_PILOT_DIAGNOSTIC:scenario,FAKE_PILOT_TRACE:trace,FAKE_PILOT_DATABASE_TRACE:databaseTrace},encoding:'utf8',timeout:8000});
  assert.equal(result.error,undefined);assert.equal(result.status,1);assert.equal(result.stderr,'');
  const receipt=JSON.parse(result.stdout);
  assert.equal(receipt.ok,false);assert.equal(receipt.races,0);assert.equal(receipt.baselineRestored,false);
  assert.equal(receipt.primaryVerification,'not-performed');assert.equal(Object.hasOwn(receipt,'primaryUnchanged'),false);
  assert.deepEqual(receipt.failure,{stage,code,category});
  assert.doesNotMatch(result.stdout,/PRIVATE_SENTINEL|private\/customer|7188e96a|password authentication|unix:\/\/\/|loadgistic-pilot-diagnostic-/);
  assert.deepEqual(readFileSync(trace,'utf8').trim().split('\n'),expectedCalls);
  const databases=expectedCalls.includes('DATABASE')?readFileSync(databaseTrace,'utf8').trim().split('\n'):[];
  assert.equal(databases.length,expectedCalls.filter(call=>['DATABASE','RESTORE_ROLE'].includes(call)).length);
  assert.ok(databases.every(database=>database==='loadgistic_telematics_ci'),'every SQL database argument remains the exact disposable clone');
  const evidence=path.join(root,'.local',readdirSync(path.join(root,'.local'))[0]);
  assert.deepEqual(JSON.parse(readFileSync(path.join(evidence,'failure.private.json'),'utf8')),receipt.failure);
  assert.equal(statSync(path.join(evidence,'failure.private.json')).mode&0o777,0o600);
  if(scenario==='admin-auth')assert.match(readFileSync(path.join(evidence,'last-process-error.private.log'),'utf8'),/PRIVATE_SENTINEL/);
  assert.equal(readdirSync(evidence).includes('baseline.private.dump'),false);
 }finally{rmSync(root,{recursive:true,force:true});}
});

for(const [scenario,stage,code,mode,proof] of [
 ['archive-zero','COMMITTED_FIXTURE_GENERATE','PILOT_RACE_PROCESS_FAILED','INITIAL_WRAPPER_ACL','MATCHED'],
 ['archive-default-drift','BACKUP_GRAPHQL_CREATION_PROOF','PILOT_RACE_GRAPHQL_CREATION_MISMATCH','INITIAL_WRAPPER_ACL','ATTEMPTED'],
 ['archive-related','BACKUP_ARCHIVE_VALIDATE','PILOT_RACE_GRAPHQL_ACL_REQUIRED','REFUSED','NOT_PERFORMED'],
 ['archive-initial-drift','BACKUP_ARCHIVE_VALIDATE','PILOT_RACE_GRAPHQL_ACL_REQUIRED','REFUSED','NOT_PERFORMED'],
])test(`real runner observes ${scenario} and never installs fixtures before proof`,()=>{
 const root=mkdtempSync(path.join(tmpdir(),'loadgistic-pilot-archive-')),bin=path.join(root,'bin'),trace=path.join(root,'calls.txt'),databaseTrace=path.join(root,'databases.txt');
 try{
  mkdirSync(bin);writeFileSync(path.join(bin,'docker'),fakeDocker,{mode:0o700});
  mkdirSync(path.join(root,'scripts'));
  writeFileSync(path.join(root,'scripts/demo-pilot-binding-test-sql.mjs'),"process.stderr.write('PRIVATE_SENTINEL fixture installation deliberately withheld');process.exit(1);");
  const result=spawnSync(process.execPath,[runner],{cwd:root,env:{...process.env,PATH:bin,DOCKER_HOST:'',DOCKER_CONTEXT:'',
   LOADGISTIC_TEST_DATABASE:'loadgistic_telematics_ci',LOADGISTIC_PILOT_OWNER_RACE_CONFIRM:'loadgistic_telematics_ci',
   FAKE_PILOT_DIAGNOSTIC:scenario,FAKE_PILOT_TRACE:trace,FAKE_PILOT_DATABASE_TRACE:databaseTrace},encoding:'utf8',timeout:8000});
  assert.equal(result.error,undefined);assert.equal(result.status,1);assert.equal(result.stderr,'');
  const receipt=JSON.parse(result.stdout),calls=readFileSync(trace,'utf8').trim().split('\n');
  assert.deepEqual(receipt.failure,{stage,code,category:'unclassified'});
  assert.equal(receipt.races,0);assert.equal(receipt.baselineRestored,false);
  assert.equal(receipt.graphqlArchive.mode,mode);assert.equal(receipt.graphqlArchive.creationProof,proof);
  assert.equal(receipt.graphqlArchive.exactAclEntries,'zero');
  assert.equal(receipt.graphqlArchive.relatedAclEntries,scenario==='archive-related'?'one':'zero');
  assert.equal(receipt.graphqlArchive.currentMatchesInitial,scenario!=='archive-initial-drift');
  assert.deepEqual(calls.slice(0,13),['CONTEXT','IDENTITY','DATABASE','CLIENT_VERSION','RESTORE_ROLE','BASELINE_GUARD','FINGERPRINT',
   'GRAPHQL_MEMBER','GRAPHQL_IDENTITY','GRAPHQL_DEFINITION','GRAPHQL_INITIAL','ARCHIVE','TOC']);
  assert.deepEqual(calls.slice(13),scenario==='archive-zero'||scenario==='archive-default-drift'?['CREATION_PROOF']:[]);
  assert.doesNotMatch(result.stdout,/PRIVATE_SENTINEL|synthetic-private|unexpected_owner|[a-f0-9]{32}|CREATE|\/private|loadgistic-pilot-archive-/);
  assert.ok(readFileSync(databaseTrace,'utf8').trim().split('\n').every(database=>database==='loadgistic_telematics_ci'));
  const evidence=path.join(root,'.local',readdirSync(path.join(root,'.local'))[0]);
  assert.equal(statSync(path.join(evidence,'baseline.private.dump')).mode&0o777,0o600);
  assert.equal(readFileSync(path.join(evidence,'baseline.private.dump'),'utf8'),'synthetic-private-archive');
 }finally{rmSync(root,{recursive:true,force:true});}
});
