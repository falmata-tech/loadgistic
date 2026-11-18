import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const sessionId='11111111-1111-4111-8111-111111111111';
function route(status=200){
 const calls=[],jobs=[],saved=Response.json({ok:status===200},{status});
 const source=ts.transpileModule(readFileSync('src/app/api/tracking/sessions/[sessionId]/approve/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,exports={};
 const ports={
  'next/server.js':{after:job=>jobs.push(job)},
  '@/lib/tracking-sessions/http':{trackingSessionHttp:async(...args)=>{calls.push(['approve',...args]);return saved;}},
  '@/lib/email-delivery':{deliverPendingShipmentEmails:async limit=>{calls.push(['delivery',limit]);return{attempted:0,sent:0};}}
 };
 new Function('require','exports',source)(name=>{assert.ok(name in ports,'unreviewed route port');return ports[name];},exports);
 return{calls,jobs,saved,ports,post:()=>exports.POST(new Request('https://loadgistic.com/api/tracking/sessions/'+sessionId+'/approve',{method:'POST'}),{params:Promise.resolve({sessionId})})};
}

test('successful account approval returns its committed response before bounded after-commit delivery',async()=>{
 const h=route(),response=await h.post();assert.equal(response,h.saved);assert.equal(h.jobs.length,1);
 assert.equal(h.calls.length,1);assert.equal(h.calls[0][2],'APPROVE');assert.deepEqual(h.calls[0][3],{sessionId});
 await h.jobs[0]();assert.deepEqual(h.calls[1],['delivery',5]);
});

test('denied/conflicting/unavailable approvals schedule no notification work',async()=>{
 for(const status of[401,403,404,409,503]){const h=route(status);assert.equal(await h.post(),h.saved);assert.deepEqual(h.jobs,[]);assert.equal(h.calls.length,1);}
});

test('approval service failure propagates without scheduling mail or retrying approval',async()=>{
 const h=route();h.ports['@/lib/tracking-sessions/http'].trackingSessionHttp=async()=>{throw Error('SYNTHETIC_PRECOMMIT_FAILURE');};
 await assert.rejects(h.post(),/SYNTHETIC_PRECOMMIT_FAILURE/);assert.deepEqual(h.jobs,[]);assert.deepEqual(h.calls,[]);
});

test('an empty queue or provider failure never undoes a committed approval or retries its mutation',async()=>{
 const empty=route(),response=await empty.post();await empty.jobs[0]();assert.equal(response.status,200);assert.equal(empty.calls.filter(x=>x[0]==='approve').length,1);
 const failed=route();let attempts=0;failed.ports['@/lib/email-delivery'].deliverPendingShipmentEmails=async limit=>{attempts++;assert.equal(limit,5);throw Error('SYNTHETIC_DELIVERY_FAILURE');};
 const committed=await failed.post();await assert.doesNotReject(failed.jobs[0]());assert.equal(committed,failed.saved);assert.equal(committed.status,200);assert.equal(attempts,1);assert.equal(failed.calls.filter(x=>x[0]==='approve').length,1);
});
