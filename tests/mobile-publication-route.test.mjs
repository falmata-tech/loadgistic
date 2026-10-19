import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {z} from 'zod';
const source=readFileSync(new URL('../src/app/api/mobile/fleet/publication/route.ts',import.meta.url),'utf8').replace(/^import .*?;\n/gm,'').replaceAll('export ','');
const factory=new Function('z','mobileActor','mobileBody','mobileFailure','mobileJson','MobileError','getProviderPublication','setProviderVehiclePublication',ts.transpile(source)+';return {GET,POST};');
class MobileError extends Error{constructor(status,code,message){super(message);this.status=status;this.code=code;}}
const mobileFailure=error=>Response.json({error:{code:error instanceof MobileError?error.code:'UNAVAILABLE'}},{status:error instanceof MobileError?error.status:503});
const id='00000000-0000-4000-8000-000000000001';
function routes({actor=async()=>({id}),read=async()=>({canPublish:true}),write=async()=>({vehicleId:id,state:'LIVE'})}={}){
 return factory(z,actor,request=>request.json(),mobileFailure,Response.json,MobileError,read,write);
}
test('employee publication reads are denied as forbidden while outages stay unavailable',async()=>{
 const denied=await routes({read:async()=>{throw new Error('FORBIDDEN');}}).GET(new Request('http://localhost'));
 assert.equal(denied.status,403);assert.equal((await denied.json()).error.code,'FORBIDDEN');
 const failed=await routes({read:async()=>{throw new Error('DATABASE_UNAVAILABLE');}}).GET(new Request('http://localhost'));
 assert.equal(failed.status,503);assert.equal((await failed.json()).error.code,'UNAVAILABLE');
});
test('publication uses the authenticated actor and never accepts a caller-supplied owner',async()=>{
 let writes=0;const handlers=routes({write:async actor=>{writes++;assert.equal(actor.id,id);return {vehicleId:id,state:'LIVE'};}});
 const request=body=>new Request('http://localhost',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 const forged=await handlers.POST(request({vehicleId:id,state:'LIVE',actorId:id}));assert.equal(forged.status,400);assert.equal(writes,0);
 const valid=await handlers.POST(request({vehicleId:id,state:'LIVE'}));assert.equal(valid.status,200);assert.equal(writes,1);
});
test('an authoritative qualification denial cannot report a successful publication',async()=>{
 const handlers=routes({write:async()=>{throw new Error('PROVIDER_VERIFICATION_REQUIRED');}});
 const response=await handlers.POST(new Request('http://localhost',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({vehicleId:id,state:'LIVE'})}));
 assert.equal(response.status,409);assert.equal((await response.json()).error.code,'PROVIDER_VERIFICATION_REQUIRED');
});
test('staff and invalid sessions cannot reach publication commands',async()=>{
 let calls=0;const handlers=routes({actor:async()=>{throw new MobileError(403,'WEB_ONLY','Use the website.');},read:async()=>{calls++;},write:async()=>{calls++;}});
 assert.equal((await handlers.GET(new Request('http://localhost'))).status,403);
 assert.equal((await handlers.POST(new Request('http://localhost',{method:'POST'}))).status,403);assert.equal(calls,0);
});
