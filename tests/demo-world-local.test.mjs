import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,cpSync,readdirSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function sandbox(){
 const root=mkdtempSync(path.join(os.tmpdir(),'loadgistic-retired-direct-'));
 mkdirSync(path.join(root,'scripts'));mkdirSync(path.join(root,'.local/demo-world'),{recursive:true});
 cpSync(new URL('../scripts/demo-world-local.mjs',import.meta.url),path.join(root,'scripts/demo-world-local.mjs'));
 return root;
}
function run(root,args){return spawnSync(process.execPath,[path.join(root,'scripts/demo-world-local.mjs'),...args],{
 cwd:root,env:{NODE_ENV:'production',SUPABASE_SERVICE_ROLE_KEY:'PRIVATE_SENTINEL_DO_NOT_READ',NEXT_PUBLIC_SUPABASE_URL:'https://customer.invalid'},encoding:'utf8',timeout:5000});}

test('real CLI write verbs retire before environment, client, malformed checkpoint or receipt access',()=>{
 const root=sandbox(),directory=path.join(root,'.local/demo-world');
 try{
  const state=path.join(directory,'catalog-state.json'),receipt=path.join(directory,'receipt.json');
  writeFileSync(state,'PRIVATE_SENTINEL_INVALID_JSON');writeFileSync(receipt,'old history retained');
  const before=readdirSync(directory).sort();
  for(const args of [['start'],['advance'],['advance-through','2000-01-01T00:00:00Z'],['reset'],['resume'],['write','customer-target']]){
   const result=run(root,args);assert.notEqual(result.status,0);assert.equal(result.stdout,'');
   assert.match(result.stderr,/DEMO_WORLD_DIRECT_APPLY_RETIRED/);assert.doesNotMatch(result.stderr,/PRIVATE_SENTINEL|CONFIG_MISSING|REMOTE_SIGNUP|SUPABASE_/);
  }
  assert.deepEqual(readdirSync(directory).sort(),before);assert.equal(readFileSync(state,'utf8'),'PRIVATE_SENTINEL_INVALID_JSON');assert.equal(readFileSync(receipt,'utf8'),'old history retained');
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('status is a sanitized read-only history inspection, not an activation or successful apply',()=>{
 const root=sandbox(),directory=path.join(root,'.local/demo-world');
 try{
  const state=JSON.stringify({catalogVersion:2,epoch:1,latestReceipts:{one:'PRIVATE_SENTINEL_RECEIPT'},secret:'PRIVATE_SENTINEL'});
  writeFileSync(path.join(directory,'catalog-state.json'),state);const before=readdirSync(directory).sort();
  const result=run(root,['status']);assert.equal(result.status,0,result.stderr);
  assert.deepEqual(JSON.parse(result.stdout),{event:'demo_world_local_status',directApply:'RETIRED',controller:'DATABASE_224',checkpointPresent:true,catalogVersion:2,epoch:1,receiptCount:1,production:false,executed:false});
  assert.doesNotMatch(result.stdout,/PRIVATE_SENTINEL/);assert.deepEqual(readdirSync(directory).sort(),before);assert.equal(readFileSync(path.join(directory,'catalog-state.json'),'utf8'),state);
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('pure planning accepts explicit inspection context without requiring a local writer or credentials',()=>{
 const result=spawnSync(process.execPath,['scripts/demo-world-local.mjs','plan','2026-11-13T12:02:00.000Z','2026-11-13T12:00:00.000Z','1'],{
 cwd:new URL('..',import.meta.url),env:{NODE_ENV:'production'},encoding:'utf8',timeout:5000});
 assert.equal(result.status,0,result.stderr);const projected=JSON.parse(result.stdout);
 assert.equal(projected.directApply,'RETIRED');assert.equal(projected.executed,false);assert.equal(projected.plans.length,5);
});
