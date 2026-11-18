import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const id='ab8e45be-d878-4aad-a9d9-32e0e64c991a';
function route(){
 const httpPath='src/lib/tracking-sessions/http.ts';
 const http=ts.createSourceFile(httpPath,readFileSync(httpPath,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);
 const selected=ts.factory.updateSourceFile(http,http.statements.filter(node=>ts.isFunctionDeclaration(node)&&['trackingSessionJson','retiredTrackingAccess','failure'].includes(node.name?.text)));
 const httpCode=ts.transpileModule(ts.createPrinter().printFile(selected),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const actual={};new Function('exports',httpCode)(actual);
 const source=readFileSync(new URL('../src/app/api/tracking/[id]/refresh/route.ts',import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const calls=[],exports={};
 const dependencies={
  '@/lib/tracking-sessions/http':{retiredTrackingAccess:()=>{calls.push('retired');return actual.retiredTrackingAccess();}}
 };
 new Function('require','exports',compiled)(name=>{assert.ok(name in dependencies,`unexpected ${name}`);return dependencies[name];},exports);
 return {get:(input,headers={})=>exports.GET(new Request('https://loadgistic.example/api/tracking/'+input+'/refresh',{headers}),{params:Promise.resolve({id:input})}),calls};
}

test('retired email Tracking refresh refuses every old or malformed session without opening auth or data ports',async()=>{
 const retired=route();
 for(const input of['bad',id]){
  const response=await retired.get(input,{cookie:'lg_tracking_email_session=old-email; lg_provider_tracking_grant=old-recipient'});
  assert.equal(response.status,410);
  assert.equal((await response.json()).error.code,'TRACKING_LINK_REQUIRED');
 }
 assert.deepEqual(retired.calls,['retired','retired']);
});

test('retired refresh returns the same private denial for owner/viewer cookies and never a revision or shipment facts',async()=>{
 const retired=route(),responses=[];
 for(const role of['owner','viewer']){
  const response=await retired.get(id,{cookie:'lg_provider_tracking_grant='+role});
  assert.equal(response.status,410);assert.equal(response.headers.get('cache-control'),'private, no-store');
  assert.equal(response.headers.get('referrer-policy'),'no-referrer');assert.match(response.headers.get('x-robots-tag'),/noindex/);
  const body=await response.json();assert.deepEqual(Object.keys(body),['ok','error']);assert.equal(body.ok,false);
  assert.doesNotMatch(JSON.stringify(body),/revision|latitude|longitude|recipientDigest|owner|viewer/);responses.push(body);
 }
 assert.deepEqual(responses[0],responses[1]);
});
