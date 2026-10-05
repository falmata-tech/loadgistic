import test from 'node:test';
import assert from 'node:assert/strict';
import {loadCapacityMapWindow,preserveSelectedMapTruck} from '../src/lib/capacity-map-loading.js';

test('viewport pages load automatically in sequence without dropping results beyond 140',async()=>{
  const cursors=[];let result;let active=0;
  await loadCapacityMapWindow({signal:new AbortController().signal,onPage:items=>{result=items;},requestPage:async cursor=>{
    assert.equal(++active,1);cursors.push(cursor);
    const offset=Number(cursor||0);
    await Promise.resolve();active--;
    return {items:Array.from({length:14},(_,i)=>({id:String(offset+i)})),hasMore:offset<140,nextCursor:String(offset+14)};
  }});
  assert.equal(cursors.length,11);assert.equal(cursors[0],null);
  assert.equal(result.length,154);assert.equal(result[0].id,'0');assert.equal(result.at(-1).id,'153');
});

test('overlapping pages update identities once and selected trucks survive replacement',async()=>{
  let result;
  await loadCapacityMapWindow({signal:new AbortController().signal,onPage:items=>{result=items;},requestPage:async cursor=>cursor
    ?{items:[{id:'a',updated:true},{id:'b'}],hasMore:false}
    :{items:[{id:'a'}],hasMore:true,nextCursor:'next'}});
  assert.deepEqual(result,[{id:'a',updated:true},{id:'b'}]);
  assert.deepEqual(preserveSelectedMapTruck([{id:'selected'},{id:'old'}],result,'selected'),[{id:'selected'},...result]);
  assert.equal(preserveSelectedMapTruck([{id:'a'}],result,'a'),result);
});

test('cancelled window cannot publish a late response or continue its cursor chain',async()=>{
  const controller=new AbortController();let published=0,requested=0;
  await assert.rejects(loadCapacityMapWindow({signal:controller.signal,onPage:()=>published++,requestPage:async()=>{
    requested++;controller.abort();return{items:[{id:'stale'}],hasMore:true,nextCursor:'next'};
  }}),{name:'AbortError'});
  assert.equal(requested,1);assert.equal(published,0);
});

test('invalid continuation and page failures stop instead of hiding failure or looping',async()=>{
  for(const nextCursor of [null,'repeat']){
    let requests=0;
    await assert.rejects(loadCapacityMapWindow({signal:new AbortController().signal,onPage:()=>{},requestPage:async()=>{
      requests++;return{items:[],hasMore:true,nextCursor};
    }}),/Capacity could not be loaded/);
    assert.ok(requests<=2);
  }
  let snapshots=0;
  await assert.rejects(loadCapacityMapWindow({signal:new AbortController().signal,onPage:()=>snapshots++,requestPage:async cursor=>{
    if(cursor)throw new Error('offline');return{items:[{id:'a'}],hasMore:true,nextCursor:'next'};
  }}),/offline/);
  assert.equal(snapshots,1);
});
