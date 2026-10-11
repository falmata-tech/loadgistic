import test from 'node:test';
import assert from 'node:assert/strict';
import {createVisibleQuery} from '../src/map/visible-query.ts';
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('a slow old-camera query cannot overwrite the final zoom and is retried after settling',async()=>{
 const first=deferred(),second=deferred(),requests=[],saved=[];
 const gate=createVisibleQuery(()=>{requests.push(true);return requests.length===1?first.promise:second.promise;},rows=>saved.push(rows),0);
 void gate.refresh();gate.moving();gate.moving();await gate.refresh();gate.settled();
 first.resolve(['old-country-cluster']);await flush();
 assert.deepEqual(saved,[]);assert.equal(requests.length,2);
 second.resolve(['current-trucks']);await flush();assert.deepEqual(saved,[['current-trucks']]);gate.close();
});
test('queries during movement and after unmount never commit; changed filters supersede a read',async()=>{
 const request=deferred(),saved=[];let count=0;
 const gate=createVisibleQuery(()=>{count++;return request.promise;},rows=>saved.push(rows),0);
 gate.moving();await gate.refresh();assert.equal(count,0);gate.settled();gate.invalidate();gate.close();
 request.resolve(['unmounted']);await flush();assert.deepEqual(saved,[]);
 const next=deferred(),gate2=createVisibleQuery(()=>next.promise,rows=>saved.push(rows),0);
 void gate2.refresh();gate2.invalidate();gate2.moving();next.resolve(['before-filter']);await flush();assert.deepEqual(saved,[]);gate2.close();
});
test('a transient missing layer keeps previous markers and allows the next render to recover',async()=>{
 const saved=[];let count=0;
 const gate=createVisibleQuery(async()=>{if(++count===1)throw Error('SOURCE_NOT_READY');return ['loaded'];},rows=>saved.push(rows),0);
 await gate.refresh();assert.deepEqual(saved,[]);await gate.refresh();assert.deepEqual(saved,[['loaded']]);gate.close();
});
test('frame storms share one read and throttle subsequent reads without losing the final view',async()=>{
 const first=deferred(),saved=[];let count=0;
 const gate=createVisibleQuery(()=>++count===1?first.promise:Promise.resolve(['latest']),rows=>saved.push(rows),25);
 void gate.refresh();for(let i=0;i<20;i++)void gate.refresh();assert.equal(count,1);
 first.resolve(['initial']);await flush();assert.equal(count,1);
 await new Promise(resolve=>setTimeout(resolve,45));assert.equal(count,2);assert.deepEqual(saved,[['initial'],['latest']]);gate.close();
});
