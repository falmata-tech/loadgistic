import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizedForegroundCapture} from '../src/location/foreground-permission.ts';
test('manual and automatic location reuse an existing foreground grant',async()=>{
 for(const manual of [true,false]){
  let prompts=0,captures=0;
  const value=await authorizedForegroundCapture({read:async()=>({granted:true}),request:async()=>{prompts++;return {granted:true};},capture:async()=>{captures++;return 'fresh-fix';}},manual);
  assert.equal(value,'fresh-fix');assert.equal(prompts,0);assert.equal(captures,1);
 }
});
test('first manual consent precedes the fresh capture cancellation window',async()=>{
 let generation=0,start=-1,captured=false;
 await authorizedForegroundCapture({read:async()=>({granted:false}),request:async()=>{generation++;return {granted:true};},capture:async()=>{assert.equal(start,generation);captured=true;}},true,()=>{start=generation;});
 assert.equal(captured,true);
});
test('denied permission and an inactive screen never capture a position',async()=>{
 for(const mayRequest of [true,false]){
  let prompts=0,captures=0;
  await assert.rejects(authorizedForegroundCapture({read:async()=>({granted:false}),request:async()=>{prompts++;return {granted:false};},capture:async()=>{captures++;}},mayRequest));
  assert.equal(prompts,mayRequest?1:0);assert.equal(captures,0);
 }
 let captures=0;
 await assert.rejects(authorizedForegroundCapture({read:async()=>({granted:true}),request:async()=>({granted:true}),capture:async()=>{captures++;}},true,()=>{throw new Error('screen-left');}),/screen-left/);
 assert.equal(captures,0);
});
