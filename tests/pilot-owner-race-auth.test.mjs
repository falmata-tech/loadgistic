import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,openSync,closeSync,writeFileSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pilotOwnerAdminExecArgs} from '../scripts/lib/pilot-owner-race-target.mjs';

const target={containerId:'a'.repeat(64),database:'loadgistic_telematics_ci'};
const listFile='/tmp/loadgistic-pilot-race-123e4567-e89b-42d3-a456-426614174000/restore-1.list';
const fakeClient=`#!${process.execPath}
const fs=require('node:fs');
if(!process.env.POSTGRES_PASSWORD||process.env.PGPASSWORD!==process.env.POSTGRES_PASSWORD)process.exit(91);
const input=fs.readFileSync(0,'utf8');
fs.appendFileSync(process.env.FAKE_ADMIN_TRACE,JSON.stringify({program:process.argv[1].split('/').pop(),args:process.argv.slice(2),inputLength:input.length})+'\\n');
process.stdout.write('LOCAL_ADMIN_AUTHENTICATED');
`;
function fixture(){
 const root=mkdtempSync(path.join(tmpdir(),'loadgistic-pilot-auth-')),bin=path.join(root,'bin'),trace=path.join(root,'calls.txt');
 writeFileSync(path.join(root,'stdin.txt'),'synthetic fixture input',{mode:0o600});
 mkdirSync(bin);for(const name of ['psql','pg_dump','pg_restore'])writeFileSync(path.join(bin,name),fakeClient,{mode:0o700});
 return {root,bin,trace};
}
function runShell(args,{root,bin,trace,password}){
 const env={PATH:bin,FAKE_ADMIN_TRACE:trace,PGPASSWORD:'PRIVATE_STALE_PASSWORD'};
 if(password!==undefined)env.POSTGRES_PASSWORD=password;
 // The password check may exit before reading stdin. A regular input file
 // preserves the positive-case payload without racing a write to a closed pipe.
 const input=openSync(path.join(root,'stdin.txt'),'r');
 try{return spawnSync('/bin/sh',args.slice(args.indexOf('sh')+1),{cwd:root,stdio:[input,'pipe','pipe'],env,encoding:'utf8',timeout:3000});}
 finally{closeSync(input);}
}

test('all local admin clients authenticate inside the container wrapper without password argv or output',()=>{
 const f=fixture();
 try{
  const password='PRIVATE_LOCAL_PASSWORD $(touch should-not-exist);\n"literal"';
  for(const operation of ['query','dump','restore']){
   const args=pilotOwnerAdminExecArgs({...target,operation,...(operation==='restore'?{listFile}:{})});
   assert.equal(Object.isFrozen(args),true);assert.equal(args.includes(password),false);
   const result=runShell(args,{...f,password});
   assert.equal(result.error,undefined);assert.equal(result.status,0);assert.equal(result.stdout,'LOCAL_ADMIN_AUTHENTICATED');assert.equal(result.stderr,'');
   assert.doesNotMatch(result.stdout+result.stderr,/PRIVATE_LOCAL_PASSWORD|PRIVATE_STALE_PASSWORD/);
  }
  const calls=readFileSync(f.trace,'utf8').trim().split('\n').map(line=>JSON.parse(line));
  assert.deepEqual(calls.map(call=>call.program),['psql','pg_dump','pg_restore']);
  for(const call of calls){
   assert.equal(call.args[call.args.indexOf('-U')+1],'supabase_admin');
   assert.equal(call.args[call.args.indexOf('-d')+1],target.database);
   assert.equal(call.inputLength,'synthetic fixture input'.length);
   assert.doesNotMatch(JSON.stringify(call),/PRIVATE_LOCAL_PASSWORD|PRIVATE_STALE_PASSWORD/);
  }
  assert.equal(existsSync(path.join(f.root,'should-not-exist')),false);
 }finally{rmSync(f.root,{recursive:true,force:true});}
});

test('missing or empty local container password refuses every admin operation before a client starts',()=>{
 const f=fixture();
 try{
  for(const password of [undefined,''])for(const operation of ['query','dump','restore']){
   const result=runShell(pilotOwnerAdminExecArgs({...target,operation}),{...f,password});
   assert.equal(result.error,undefined);assert.equal(result.status,64);assert.equal(result.stdout,'');
   assert.equal(result.stderr,'PILOT_RACE_LOCAL_ADMIN_PASSWORD_REQUIRED\n');
   assert.equal(existsSync(f.trace),false);
  }
 }finally{rmSync(f.root,{recursive:true,force:true});}
});

test('admin wrapper command construction refuses arbitrary targets, programs, options and restore paths',()=>{
 for(const options of [null,{},
  {...target,operation:'query',containerId:'container-name'},
  {...target,operation:'query',database:'postgres'},
  {...target,operation:'query',database:'production'},
  {...target,operation:'sh'},
  {...target,operation:'query',role:'postgres'},
  {...target,operation:'dump',listFile},
  {...target,operation:'restore',listFile:'/private/customer/archive.list'},
  {...target,operation:'restore',listFile:listFile+'; touch injected'},
 ])assert.throws(()=>pilotOwnerAdminExecArgs(options),{message:'PILOT_RACE_ADMIN_COMMAND_DENIED'});
 for(const database of ['loadgistic_pilot_ci','loadgistic_telematics_ci']){
  const args=pilotOwnerAdminExecArgs({...target,database,operation:'restore'});
  assert.equal(args[args.indexOf('-d')+1],database);assert.equal(args.includes('--exit-on-error'),true);
 }
});
