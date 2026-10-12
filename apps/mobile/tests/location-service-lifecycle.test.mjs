import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {createLocationServiceLifecycle} from '../src/location/service-lifecycle.ts';
const notice={title:'Tracking',body:'Approximate location'};
function fixture(){let registered=true,starts=0,stops=0;const port={available:async()=>true,registered:async()=>registered,start:async()=>{starts++;registered=true;},stop:async()=>{stops++;registered=false;}};return {port,get starts(){return starts;},get stops(){return stops;},lose(){registered=false;}};}

test('native adapter restarts the requested service for an already registered cold task',async()=>{
 const text=fs.readFileSync(new URL('../src/location/background-task.native.ts',import.meta.url),'utf8');
 const source=ts.createSourceFile('native.ts',text,ts.ScriptTarget.Latest,true);
 const declaration=source.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='startBackgroundTracking');
 assert.ok(declaration);
 const js=ts.transpileModule(declaration.getText(source),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const f=fixture(),serviceLifecycle=createLocationServiceLifecycle(f.port);
 const exports={};new Function('exports','TaskManager','Location','serviceLifecycle','taskName',js)(exports,{isAvailableAsync:f.port.available},{hasStartedLocationUpdatesAsync:f.port.registered,startLocationUpdatesAsync:f.port.start},serviceLifecycle,'loadgistic.shipment-location.v1');
 await exports.startBackgroundTracking(notice);assert.equal(f.starts,1);
});
test('cold persisted registration restarts once; periodic synchronization preserves batching',async()=>{
 const f=fixture(),service=createLocationServiceLifecycle(f.port);await service.ensure(notice);await service.ensure(notice);assert.equal(f.starts,1);
 f.lose();await service.ensure(notice);assert.equal(f.starts,2);
});
test('concurrent startup requests do not duplicate native service startup',async()=>{
 const f=fixture(),service=createLocationServiceLifecycle(f.port);await Promise.all([service.ensure(notice),service.ensure(notice)]);assert.equal(f.starts,1);
});
test('failed startup remains retryable even if registration is still present',async()=>{
 const f=fixture();let failed=true;const start=f.port.start;f.port.start=async n=>{if(failed)throw Error('native start failed');await start(n);};const service=createLocationServiceLifecycle(f.port);
 await assert.rejects(service.ensure(notice),/native start failed/);failed=false;await service.ensure(notice);assert.equal(f.starts,1);
});
test('unavailable task support cannot claim or request native startup',async()=>{
 const f=fixture();f.port.available=async()=>false;const service=createLocationServiceLifecycle(f.port);await assert.rejects(service.ensure(notice),/unavailable/);assert.equal(f.starts,0);
});
test('stop waits for an in-flight native start and later authority starts fresh',async()=>{
 const f=fixture();let release,entered;const began=new Promise(r=>{entered=r;});const wait=new Promise(r=>{release=r;});const start=f.port.start;f.port.start=async n=>{entered();await wait;await start(n);};const service=createLocationServiceLifecycle(f.port);
 const first=service.ensure(notice);await began;const stop=service.stop();assert.equal(f.stops,0);release();await Promise.all([first,stop]);assert.equal(f.stops,1);
 await service.ensure(notice);assert.equal(f.starts,2);
});
test('stop invalidates a queued obsolete startup before its native side effects',async()=>{
 const f=fixture(),service=createLocationServiceLifecycle(f.port);const start=service.ensure(notice),stop=service.stop();await Promise.all([start,stop]);assert.equal(f.starts,0);assert.equal(f.stops,1);
});
test('failed native stop cannot retain process readiness',async()=>{
 const f=fixture(),service=createLocationServiceLifecycle(f.port);await service.ensure(notice);f.port.stop=async()=>{throw Error('stop failed');};await assert.rejects(service.stop(),/stop failed/);await service.ensure(notice);assert.equal(f.starts,2);
});
