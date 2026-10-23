import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../src/app/api/mobile/capacity/route.ts',import.meta.url),'utf8').replace(/^import .*?;\n/gm,'').replaceAll('export ','');
const factory=new Function('mobileProfilePublished','mobileActor','mobileBody','mobileFailure','mobileJson','MobileError','capacityCommand','projectMobileCapacity','getProviderCapacityWorkspace','publishProviderCapacity','refreshProviderCapacityLocation','setProviderAssignedVehicleDuty','errorMessage',ts.transpile(source)+';return POST;');
class MobileError extends Error{constructor(status,code,message){super(message);this.status=status;this.code=code;}}
function handler(code){return factory(async()=>true,async()=>({id:'authenticated-owner'}),async()=>({}),error=>Response.json({error:{code:error instanceof MobileError?error.code:'UNAVAILABLE'}},{status:error instanceof MobileError?error.status:503}),Response.json,MobileError,{safeParse:()=>({success:true,data:{action:'PUBLISH'}})},null,null,async()=>{throw new Error(code);},null,null,()=> 'A user-readable correction.');}
test('native capacity distinguishes Draft and fleet qualification conflicts from an outage',async()=>{
 for(const code of ['TRUCK_NOT_LIVE','PROVIDER_VERIFICATION_REQUIRED']){
  const response=await handler(code)(new Request('http://localhost',{method:'POST'}));
  assert.equal(response.status,409);assert.equal((await response.json()).error.code,code);
 }
 const response=await handler('DATABASE_UNAVAILABLE')(new Request('http://localhost',{method:'POST'}));
 assert.equal(response.status,503);assert.equal((await response.json()).error.code,'UNAVAILABLE');
});
