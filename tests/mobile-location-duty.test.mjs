import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {z} from 'zod';
class MobileError extends Error{constructor(status,code,message){super(message);this.status=status;this.code=code;}}
function route(actor,read=async()=>[]){
 const calls=[],exports={},code=ts.transpileModule(readFileSync('src/app/api/mobile/shipments/location-leases/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const ports={zod:{z},'@/lib/mobile/server':{MobileError,mobileActor:async()=>{if(!actor)throw new MobileError(401,'SIGN_IN_REQUIRED','Sign in');return actor;},mobileJson:value=>Response.json(value),mobileFailure:error=>Response.json({error:{code:error.code||'UNAVAILABLE'}},{status:error.status||503})},'@/lib/mobile/tracking-device-server':{deviceRpc:async(...args)=>{calls.push(args);return read();}}};
 new Function('require','exports',code)(name=>{if(!(name in ports))throw Error(`UNEXPECTED_PORT:${name}`);return ports[name];},exports);return {get:()=>exports.GET(new Request('http://localhost/api/mobile/shipments/location-leases')),calls};
}
test('verified base drivers keep their assigned shipment duty while viewing a customer workspace',async()=>{
 for(const platform_role of ['DRIVER','TRANSPORTER']){const api=route({id:'real-actor',role:'CUSTOMER',platform_role},async()=>[{payload:{shipmentId:'00000000-0000-4000-8000-000000000001',radius:10}}]);const response=await api.get();assert.equal(response.status,200);assert.equal((await response.json()).shipments.length,1);assert.deepEqual(api.calls,[['assigned_location_tracking',{actor_user_id:'real-actor'}]],'Only PostgreSQL decides whether that real actor has an active assignment');}
});
test('business-only and platform accounts receive no mobile location enrollment targets',async()=>{
 for(const platform_role of ['SHIPPER','RECEIVER','SUPPORT','ADMIN']){const api=route({id:'actor',role:'CUSTOMER',platform_role});assert.deepEqual(await(await api.get()).json(),{shipments:[]});assert.equal(api.calls.length,0);}
 const anonymous=route(null);assert.equal((await anonymous.get()).status,401);assert.equal(anonymous.calls.length,0);
});
test('missing assignment stays empty; an invalid broad next-lease target fails closed',async()=>{
 const empty=route({id:'driver',role:'DRIVER'});assert.deepEqual(await(await empty.get()).json(),{shipments:[]});
 const broad=route({id:'driver',role:'DRIVER'},async()=>[{payload:{shipmentId:'00000000-0000-4000-8000-000000000001',radius:20}}]);assert.equal((await broad.get()).status,503);
});
