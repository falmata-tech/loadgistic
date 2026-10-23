import test from 'node:test';
import assert from 'node:assert/strict';
import {createPhoneInstallationController,parseLocationBinding} from '../src/location/phone-installation-controller.ts';
const actor='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',vehicle='33333333-3333-4333-8333-333333333333',installation='44444444-4444-4444-8444-444444444444',bindingId='55555555-5555-4555-8555-555555555555',revision='66666666-6666-4666-8666-666666666666',reportId='77777777-7777-4777-8777-777777777777',now=1800000000000;
const identity={installationId:installation,secret:'a'.repeat(64)},bound={installationId:installation,bindingId,revision,vehicleId:vehicle,actorId:actor,expiresAt:new Date(now+86400000).toISOString()};
function fixture(){let stored=null,pending=[],online=true;const events=[],port={now:()=>now,uuid:()=>reportId,identity:async()=>identity,
 read:async()=>stored,write:async value=>{events.push(value?'saved':'cleared');stored=value;},pending:async()=>pending.slice(),savePending:async value=>{events.push('pending:'+value.length);pending=value.slice();},
 release:async body=>{events.push('release:'+body.bindingId);if(!online)throw Error('offline');return {ok:true};}};
 let calls=0;const request=async(path,body)=>{calls++;events.push('register');assert.equal(path,'/api/mobile/location/installation');assert.equal(body.secret,identity.secret);return {...bound};};
 return{controller:createPhoneInstallationController(port),events,request,get calls(){return calls;},get stored(){return stored;},get pending(){return pending;},offline(){online=false;},online(){online=true;}};
}
test('concurrent capture preparation shares registration and exposes only current private proof',async()=>{
 const f=fixture();f.controller.setAccount(actor,f.request);const [one,two]=await Promise.all([f.controller.prepare(),f.controller.prepare()]);
 assert.equal(f.calls,1);assert.equal(one.binding.bindingId,two.binding.bindingId);
 assert.deepEqual(one.proof(now),{...identity,bindingId,revision,reportId,observedAt:now});
 assert.equal(f.stored.actorId,actor);assert.ok(f.events.indexOf('register')<f.events.indexOf('saved'));
});
test('an account switch synchronously fences captured authority and releases prior binding',async()=>{
 const f=fixture();f.controller.setAccount(actor,f.request);const capture=await f.controller.prepare();
 f.controller.setAccount(other,async()=>({...bound,actorId:other}),async()=>{f.events.push('service stopped');});
 assert.throws(()=>capture.proof(now),/paused/);const next=await f.controller.prepare();assert.equal(next.binding.actorId,other);
 assert.ok(f.events.indexOf('service stopped')<f.events.indexOf('release:'+bindingId));
});
test('offline logout persists revocation and blocks new registration until cleanup succeeds',async()=>{
 const f=fixture();f.controller.setAccount(actor,f.request);await f.controller.prepare();f.offline();
 await assert.rejects(f.controller.release(),/disconnecting/);assert.equal(f.stored,null);assert.equal(f.pending.length,1);
 f.controller.setAccount(other,async()=>({...bound,actorId:other}));await assert.rejects(f.controller.prepare(),/disconnecting/);assert.equal(f.calls,1);
 f.online();const next=await f.controller.prepare();assert.equal(next.binding.actorId,other);assert.equal(f.pending.length,0);
});
test('native stop failure cannot skip server-binding revocation',async()=>{
 const f=fixture();f.controller.setAccount(actor,f.request);await f.controller.prepare();
 f.controller.setAccount('',null,async()=>{throw Error('OS stop failed');});await f.controller.release();
 assert.ok(f.events.includes('release:'+bindingId));assert.equal(f.stored,null);
});
test('late registration for an earlier account is revoked without becoming current',async()=>{
 const f=fixture();let resolve;const held=new Promise(r=>{resolve=r;});f.controller.setAccount(actor,async()=>held);
 const old=f.controller.prepare();await new Promise(r=>setImmediate(r));f.controller.setAccount(other,async()=>({...bound,actorId:other}));resolve(bound);
 await assert.rejects(old,/paused/);const current=await f.controller.prepare();assert.equal(current.binding.actorId,other);assert.equal(f.pending.length,0);
 assert.ok(f.events.includes('release:'+bindingId));
});
test('missing identity, malformed or foreign registration and stale/future observations fail closed',async()=>{
 const f=fixture();await assert.rejects(f.controller.prepare(),/Sign in/);
 assert.throws(()=>parseLocationBinding({...bound,actorId:other},actor),/confirmed/);
 assert.throws(()=>parseLocationBinding({...bound,revision:'bad'}),/confirmed/);
 f.controller.setAccount(actor,f.request);const capture=await f.controller.prepare();
 for(const observed of [now-120001,now+30001,NaN])assert.throws(()=>capture.proof(observed),/paused/);
});
