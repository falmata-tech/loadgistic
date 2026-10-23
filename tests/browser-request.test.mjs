import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync('src/lib/browser-request.ts','utf8');
const {browserRequest}=await import(`data:text/javascript,${encodeURIComponent(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText)}`);
test('bounded request stops waiting for transport and body without retrying',async()=>{
 const original=global.fetch;let calls=0,signal;
 try{
  global.fetch=async(_url,init)=>{calls++;signal=init.signal;return new Promise(()=>{});};
  await assert.rejects(browserRequest('/held',{},15),/REQUEST_TIMEOUT/);assert.equal(signal.aborted,true);assert.equal(calls,1);
  global.fetch=async()=>{calls++;return {json:()=>new Promise(()=>{})};};
  await assert.rejects(browserRequest('/held-body',{},15),/REQUEST_TIMEOUT/);assert.equal(calls,2);
  global.fetch=async()=>new Response('{"ok":true}',{status:201});
  const result=await browserRequest('/ok');assert.equal(result.response.status,201);assert.deepEqual(result.data,{ok:true});
 }finally{global.fetch=original;}
});
