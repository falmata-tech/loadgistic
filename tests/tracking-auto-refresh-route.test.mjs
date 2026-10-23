import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {trackingRefreshState} from '../src/lib/tracking-refresh-revision.js';

const id='ab8e45be-d878-4aad-a9d9-32e0e64c991a';
function route(grant,projection){
 const source=readFileSync(new URL('../src/app/api/tracking/[id]/refresh/route.ts',import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const calls=[],exports={};
 const dependencies={
  'next/server.js':{NextResponse:{json:(body,options={})=>({body,status:options.status||200,headers:options.headers})}},
  '@/lib/auth':{getProviderTrackingGrant:async input=>{calls.push(['grant',input]);return grant;}},
  '@/lib/provider-tracking.js':{getProviderGuestTracking:async (...args)=>{calls.push(['projection',...args]);return projection;}},
  '@/lib/tracking-refresh-revision.js':{trackingRefreshState}
 };
 new Function('require','exports',compiled)(name=>{assert.ok(name in dependencies,`unexpected ${name}`);return dependencies[name];},exports);
 return {get:input=>exports.GET({}, {params:Promise.resolve({id:input})}),calls};
}

test('web Tracking refresh refuses malformed, expired and revoked access before returning a revision',async()=>{
 const malformed=route(null,null);
 assert.equal((await malformed.get('bad')).status,404);
 assert.deepEqual(malformed.calls,[]);
 const expired=route(null,null);
 assert.equal((await expired.get(id)).status,401);
 assert.deepEqual(expired.calls,[['grant',id]]);
 const revoked=route({recipientDigest:'owner'},null);
 assert.equal((await revoked.get(id)).status,401);
 assert.deepEqual(revoked.calls,[['grant',id],['projection',id,'owner']]);
});

test('refresh returns only an opaque revision from each recipient-safe projection',async()=>{
 const owner=route({recipientDigest:'owner'}, {operational_status:'IN_TRANSIT',tracking_selected_location:{latitude:9,longitude:39}});
 const viewer=route({recipientDigest:'viewer'}, {operational_status:'IN_TRANSIT',tracking_selected_location:null});
 const ownerResult=await owner.get(id),viewerResult=await viewer.get(id);
 assert.equal(ownerResult.status,200);assert.equal(viewerResult.status,200);
 assert.equal(ownerResult.headers['Cache-Control'],'private, no-store, max-age=0');
 assert.deepEqual(Object.keys(viewerResult.body),['revision','active']);
 assert.notEqual(ownerResult.body.revision,viewerResult.body.revision);
 assert.doesNotMatch(JSON.stringify(viewerResult.body),/latitude|longitude|owner|viewer/);
});
