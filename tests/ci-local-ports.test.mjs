import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,mkdirSync,copyFileSync,writeFileSync,rmSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {parseReservedPorts,reserveLocalPorts} from '../scripts/ci-reserve-local-ports.mjs';
const environment={CI:'true',GITHUB_ACTIONS:'true',RUNNER_OS:'Linux',LOADGISTIC_RUNNER_ENVIRONMENT:'github-hosted'};
function run(initial,readback){
 let current=initial;const writes=[];
 const result=reserveLocalPorts({environment,platform:'linux',project:'loadgistic-local',read:()=>writes.length&&readback!==undefined?readback:current,write:value=>{writes.push(value);current=value;}});
 return {result,writes,current};
}
test('CI service ports are reserved while every existing reservation is preserved',()=>{
 for(const initial of ['', '22,40000-40002,65535','55310-55322,55325-55330','1-65535']){
  const {result,current,writes}=run(initial),ports=parseReservedPorts(current);
  for(const port of parseReservedPorts(initial))assert.equal(ports.has(port),true);
  for(let port=55320;port<=55329;port++)assert.equal(ports.has(port),true);
  assert.equal(result.existingReservationsPreserved,true);assert.equal(result.reservedServicePorts,10);
  assert.equal(writes.length,initial==='1-65535'?0:1);
  assert.equal(run(current).writes.length,0);
 }
});
test('unknown, malformed, partial and failed reservations stop before services start',()=>{
 for(const value of ['0','1-65536','-1','30-20','PRIVATE','22;PRIVATE','22,','1--2'])assert.throws(()=>parseReservedPorts(value),/RESERVATION_INVALID/);
 for(const value of ['', '55320-55328', '22,55320-55329', 'PRIVATE'])assert.throws(()=>run('443',value));
 assert.throws(()=>reserveLocalPorts({environment,platform:'linux',project:'loadgistic-local',read:()=>'',write:()=>{throw Error('PRIVATE');}}));
});
test('local, self-hosted, wrong-project and non-Linux contexts cannot invoke kernel operations',()=>{
 for(const change of ['ci','actions','os','runner','project','platform']){
  const options={environment:{...environment},platform:'linux',project:'loadgistic-local',read:()=>{throw Error('KERNEL_READ_FORBIDDEN');},write:()=>{throw Error('KERNEL_WRITE_FORBIDDEN');}};
  if(change==='ci')options.environment.CI='false';if(change==='actions')options.environment.GITHUB_ACTIONS='false';
  if(change==='os')options.environment.RUNNER_OS='macOS';if(change==='runner')options.environment.LOADGISTIC_RUNNER_ENVIRONMENT='self-hosted';
  if(change==='project')options.project='production';if(change==='platform')options.platform='darwin';
  assert.throws(()=>reserveLocalPorts(options),/DISPOSABLE_LINUX_RUNNER_REQUIRED/);
 }
});
test('every isolated CI workflow reserves ports before network dependency and container setup',()=>{
 const source=readFileSync('.github/workflows/ci.yml','utf8');
 for(const name of ['validate','e2e-shards','featured-prepare']){
  const block=source.split(`  ${name}:`)[1].split(/^  [a-z][a-z-]*:/m)[0];
  assert.ok(block.indexOf('ci-reserve-local-ports.mjs')<block.indexOf('actions/setup-node@'));
  assert.match(block,/LOADGISTIC_RUNNER_ENVIRONMENT: \$\{\{ runner.environment \}\}/);
 }
 const focused=readFileSync('.github/workflows/operations-proof.yml','utf8');assert.ok(focused.indexOf('ci-reserve-local-ports.mjs')<focused.indexOf('actions/setup-node@'));
});

test('the actual entry point uses only the fake kernel and suppresses child output',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'loadgistic-port-SENTINEL-'));
 try{
  for(const folder of ['scripts','supabase','bin'])mkdirSync(path.join(root,folder));
  copyFileSync('scripts/ci-reserve-local-ports.mjs',path.join(root,'scripts/ci-reserve-local-ports.mjs'));
  writeFileSync(path.join(root,'supabase/config.toml'),'project_id = "loadgistic-local"\n');
  const state=path.join(root,'fake-kernel');writeFileSync(state,'22,443');
  writeFileSync(path.join(root,'bin/sysctl'),`#!/usr/bin/env node
const fs=require('node:fs');const a=process.argv.slice(2);if(a[0]==='-n')process.stdout.write(fs.readFileSync(process.env.TEST_KERNEL_STATE));else{fs.writeFileSync(process.env.TEST_KERNEL_STATE,a.at(-1).split('=')[1]);process.stderr.write('SENTINEL secret person@example.test');}
`,{mode:0o700});
  writeFileSync(path.join(root,'bin/sudo'),`#!/usr/bin/env node
const r=require('node:child_process').spawnSync('sysctl',process.argv.slice(4),{encoding:'utf8',env:process.env});process.stdout.write(r.stdout||'');process.stderr.write(r.stderr||'');process.exit(r.status??1);
`,{mode:0o700});
  const run=()=>spawnSync(process.execPath,['scripts/ci-reserve-local-ports.mjs'],{cwd:root,env:{...environment,PATH:path.join(root,'bin')+path.delimiter+process.env.PATH,TEST_KERNEL_STATE:state},encoding:'utf8',timeout:10000});
  const result=run();
  assert.doesNotMatch(result.stdout+result.stderr,/SENTINEL|person@|secret|\/tmp\//);
  if(process.platform!=='linux'){
   assert.equal(result.status,1);assert.match(result.stderr,/DISPOSABLE_LINUX_RUNNER_REQUIRED/);assert.equal(readFileSync(state,'utf8'),'22,443');return;
  }
  assert.equal(result.status,0);assert.equal(result.stderr,'');assert.match(result.stdout,/CI_LOCAL_PORT_RESERVATION/);
  const ports=parseReservedPorts(readFileSync(state,'utf8'));assert.equal(ports.size,12);assert.ok(ports.has(22)&&ports.has(443));
  assert.equal(run().status,0);
 }finally{rmSync(root,{recursive:true,force:true});}
});
