import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {demoPilotBindingPlan,DEMO_PILOT_TARGETS,DEMO_PILOT_SOURCE} from '../scripts/demo-pilot-binding-policy.mjs';
import {pilotUuid} from '../scripts/production-pilot-policy.mjs';
import {runNetlifyMotionWindow} from '../src/lib/demo-motion-netlify.mjs';

test('pilot bindings use existing fixture keys and the separate deterministic pilot namespace',()=>{
 const f=JSON.parse(readFileSync('resources/fixtures/managed-market.json','utf8')).tables,plan=demoPilotBindingPlan();
 assert.equal(DEMO_PILOT_SOURCE,'loadgistic-production-pilot-v1');assert.equal(plan.length,10);
 assert.equal(new Set(plan.map(p=>p.pilot.vehicleId)).size,10);
 for(const p of plan){
  const vehicle=f.vehicles.find(v=>v.id===p.vehicleKey);assert.ok(vehicle);
  assert.equal(p.pilot.vehicleId,pilotUuid(vehicle.id));assert.notEqual(p.pilot.vehicleId,p.local.vehicleId);
  if(vehicle.organization_id)assert.equal(p.pilot.organizationId,pilotUuid(vehicle.organization_id));
  else assert.equal(p.pilot.providerProfileId,pilotUuid(vehicle.provider_profile_id));
 }
 assert.deepEqual(plan.filter(p=>p.eligible).map(p=>p.target),DEMO_PILOT_TARGETS);
 assert.deepEqual(plan.filter(p=>!p.eligible).map(p=>p.target),['fleet-03','fleet-06','fleet-08']);
});

test('a bounded server-selected window prepares and reports only its reviewed subset',async()=>{
 const start=Date.parse('2026-11-15T06:30:00Z'),calls=[];
 const result=await runNetlifyMotionWindow({runId:randomUUID(),now:()=>start,
  client:async command=>{
   calls.push(command);
   if(command.action==='CLAIM')return {claimed:true,expiresAt:new Date(start+25000).toISOString(),targets:['company-truck','personal-truck']};
   if(command.action==='PREPARE')return {ready:true,dueAt:new Date(start).toISOString()};
   return {recorded:true,dueAt:new Date(start+30000).toISOString()};
  }});
 assert.equal(result.recorded,2);assert.equal(result.failed,0);
 assert.deepEqual([...new Set(calls.slice(1).map(c=>c.target))].sort(),['company-truck','personal-truck']);
 assert.equal(calls.filter(c=>c.action==='PREPARE').length,2);
});

test('unknown, duplicated, empty or unbounded server target lists cannot start target work',async()=>{
 const start=Date.parse('2026-11-15T06:30:00Z');
 for(const targets of [null,{},[],['customer'],['company-truck','company-truck'],Array(11).fill('company-truck')]){
  let calls=0;
  await assert.rejects(runNetlifyMotionWindow({runId:randomUUID(),now:()=>start,client:async()=>{
   calls++;return {claimed:true,expiresAt:new Date(start+55000).toISOString(),targets};
  }}),/DEMO_NETLIFY_RESPONSE_DENIED/);
  assert.equal(calls,1);
 }
});

test('pilot SQL fixture refuses ordinary database names and stays registered on disposable CI only',()=>{
 for(const database of ['', 'postgres','production']){
  const result=spawnSync(process.execPath,['scripts/demo-pilot-binding-test-sql.mjs'],{
   env:{...process.env,LOADGISTIC_TEST_DATABASE:database},encoding:'utf8',timeout:5000});
  assert.notEqual(result.status,0);assert.equal(result.stdout,'');assert.match(result.stderr,/ISOLATED_PILOT_DATABASE_REQUIRED/);
 }
 const result=spawnSync(process.execPath,['scripts/demo-pilot-binding-test-sql.mjs'],{
  env:{...process.env,LOADGISTIC_TEST_DATABASE:'loadgistic_telematics_ci'},encoding:'utf8',timeout:5000});
 assert.equal(result.status,0);assert.match(result.stdout,/^begin;/);assert.match(result.stdout,/rollback;\n$/);
 assert.match(result.stdout,/PILOT_FIXTURE_GUARDS_NOT_RESTORED/);assert.match(result.stdout,/PILOT_REFUSAL_CHANGED_PUBLIC_FACTS/);
 for(const file of ['.github/workflows/ci.yml','.github/workflows/operations-proof.yml']){
  const workflow=readFileSync(file,'utf8'),step=workflow.slice(workflow.indexOf('      - name: Verify exact existing pilot bindings'),workflow.indexOf('      - name:',workflow.indexOf('      - name: Verify exact existing pilot bindings')+16));
  assert.match(step,/LOADGISTIC_TEST_DATABASE: loadgistic_telematics_ci/);assert.match(step,/30s node scripts\/demo-pilot-binding-test-sql.mjs/);
  assert.match(step,/3m docker exec -e PGOPTIONS='-c loadgistic.demo_isolated_test=true'/);
  assert.match(step,/-d "\$LOADGISTIC_TEST_DATABASE" -v ON_ERROR_STOP=1/);
 }
});

test('committed owner-race setup requires its exact argument and independent explicit opt-in',()=>{
 const run=(args,extra={})=>spawnSync(process.execPath,['scripts/demo-pilot-binding-test-sql.mjs',...args],{
  env:{...process.env,LOADGISTIC_TEST_DATABASE:'loadgistic_pilot_ci',LOADGISTIC_PILOT_RACE_SETUP:'',...extra},encoding:'utf8',timeout:5000});
 for(const [args,extra,code] of [[['--write'],{},'PILOT_TEST_ARGUMENT_DENIED'],
  [['--owner-race-setup','--write'],{},'PILOT_TEST_ARGUMENT_DENIED'],
  [['--owner-race-setup'],{},'PILOT_RACE_SETUP_OPT_IN_REQUIRED'],
  [['--owner-race-setup'],{LOADGISTIC_PILOT_RACE_SETUP:'true'},'PILOT_RACE_SETUP_OPT_IN_REQUIRED']]){
  const result=run(args,extra);assert.notEqual(result.status,0);assert.equal(result.stdout,'');assert.match(result.stderr,new RegExp(code));
 }
 const normal=run([],{LOADGISTIC_PILOT_RACE_SETUP:'ALLOW_COMMITTED_DISPOSABLE_PILOT_OWNER_TEST'});
 assert.equal(normal.status,0);assert.match(normal.stdout,/rollback;\n$/);assert.doesNotMatch(normal.stdout,/committedFixture/);
 const optedIn=run(['--owner-race-setup'],{LOADGISTIC_PILOT_RACE_SETUP:'ALLOW_COMMITTED_DISPOSABLE_PILOT_OWNER_TEST'});
 assert.equal(optedIn.status,0);assert.match(optedIn.stdout,/PILOT_FIXTURE_GUARDS_NOT_RESTORED/);assert.match(optedIn.stdout,/committedFixture/);assert.match(optedIn.stdout,/commit;\n$/);
});

test('owner race runner refuses primary, hosted or unconfirmed targets before spawning a database process',()=>{
 for(const [database,confirmation] of [['postgres','postgres'],['production','production'],['loadgistic_pilot_ci',''],['loadgistic_telematics_ci','wrong']]){
  const result=spawnSync(process.execPath,['scripts/verify-demo-pilot-owner-concurrency-local.mjs'],{
   env:{...process.env,LOADGISTIC_TEST_DATABASE:database,LOADGISTIC_PILOT_OWNER_RACE_CONFIRM:confirmation,PATH:''},encoding:'utf8',timeout:5000});
  assert.notEqual(result.status,0);assert.equal(result.stdout,'');assert.match(result.stderr,/EXACT_DISPOSABLE_PILOT_RACE_CONFIRMATION_REQUIRED/);assert.doesNotMatch(result.stderr,/ENOENT|PILOT_RACE_SPAWN_FAILED/);
 }
});
