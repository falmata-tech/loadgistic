import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

// Exercise the route with explicit adapter doubles: no Auth, database or SMTP.
const source=readFileSync('src/app/api/provider-shipments/route.ts','utf8').replace(/^import .*;\n/gm,'').replace("export const runtime='nodejs';",'').replace('export async function POST','return async function POST');
const factory=new Function('getCurrentUser','createProviderShipment','after','deliverPendingShipmentEmails','NextResponse','errorMessage','text',ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText);
const created={id:'saved-id',code:'Shipment',trackingCode:'saved-code',trackingPath:'/track'};
const request=()=>({formData:async()=>new FormData()});
function route({user={id:'provider'},create=async()=>created,deliver=async()=>{}}={}){
 const jobs=[];
 return {jobs,post:factory(async()=>user,create,job=>jobs.push(job),deliver,{json:(data,init)=>Response.json(data,init)},()=> 'Save could not be confirmed', (form,key)=>String(form.get(key)||''))};
}
test('committed Tracking returns success before email, and delivery failure does not undo it',async()=>{
 let saves=0,deliveries=0;
 const {post,jobs}=route({create:async()=>{saves++;return created},deliver:async()=>{deliveries++;throw new Error('SMTP unavailable')}});
 const response=await post(request());assert.equal(response.status,201);assert.deepEqual(await response.json(),created);assert.equal(deliveries,0);assert.equal(jobs.length,1);
 await jobs[0]();assert.equal(deliveries,1);assert.equal(saves,1);assert.equal(response.headers.get('cache-control'),'no-store');
});
test('unknown commit failure returns unavailable and never dispatches mail',async()=>{
 const {post,jobs}=route({create:async()=>{throw new Error('SUPABASE_PROVIDER_TRACKING_CREATE_FAILED')}});
 assert.equal((await post(request())).status,503);assert.equal(jobs.length,0);
});
test('unauthenticated creation never reaches persistence',async()=>{
 let called=false;const {post,jobs}=route({user:null,create:async()=>{called=true}});
 assert.equal((await post(request())).status,401);assert.equal(called,false);assert.equal(jobs.length,0);
});
