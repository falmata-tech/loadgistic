import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectDataApiGuard } from '../scripts/lib/data-api-monitor.mjs';
const key = 'sb_publishable_local_test_only';
const denied = () => ({status:403,json:async()=>({code:'42501',message:'BROWSER_DATA_API_ACCESS_DENIED'})});
test('guard verification survives extension relocation while probing existing application relations',async()=>{
  const visited=[];
  const result=await inspectDataApiGuard({key,fetchImpl:async url=>{
    const path=new URL(url).pathname;visited.push(path);
    // Relocated PostGIS is intentionally absent from the exposed API schema.
    if(path==='/rest/v1/spatial_ref_sys')return {status:404,json:async()=>({code:'PGRST205'})};
    return denied();
  }});
  assert.equal(result.passed,true);
  assert.deepEqual(visited,['/rest/v1/capacities','/rest/v1/profiles','/rest/v1/rpc/current_user_projection']);
});
test('guard monitor probes only the fixed project with anonymous GET requests and no rows', async () => {
  const calls=[];
  const result=await inspectDataApiGuard({key,fetchImpl:async(url,options)=>{calls.push({url,options});return denied();}});
  assert.equal(result.passed,true);assert.equal(calls.length,3);
  for(const {url,options} of calls){
    assert.equal(new URL(url).hostname,'tpwyyzoqijjmbvsmmvcm.supabase.co');
    assert.equal(options.method,'GET');assert.equal(options.redirect,'error');
    assert.deepEqual(options.headers,{apikey:key});
    if(!url.includes('/rpc/'))assert.equal(new URL(url).searchParams.get('limit'),'0');
  }
});
test('monitor refuses missing, secret and service-role credentials before a request', async()=>{
  const jwt=role=>`e30.${Buffer.from(JSON.stringify({role,ref:'tpwyyzoqijjmbvsmmvcm'})).toString('base64url')}.signature`;
  for(const candidate of [undefined,'sb_secret_example',jwt('service_role')]){
    await assert.rejects(inspectDataApiGuard({key:candidate,fetchImpl:()=>{throw Error('must not request');}}),/ANONYMOUS_MONITOR_KEY_REQUIRED/);
  }
  assert.equal((await inspectDataApiGuard({key:jwt('anon'),fetchImpl:async()=>denied()})).passed,true);
});
test('an open table, missing table, unrelated denial or unavailable endpoint cannot pass', async()=>{
  for(const response of [
    {status:200,json:async()=>[]}, {status:404,json:async()=>({})},
    {status:403,json:async()=>({code:'42501',message:'permission denied'})},
    {status:503,json:async()=>({})}, {status:403,json:async()=>{throw Error('invalid');}},
  ]) await assert.rejects(inspectDataApiGuard({key,fetchImpl:async()=>response}),/DATA_API_GUARD_/);
  await assert.rejects(inspectDataApiGuard({key,fetchImpl:async()=>{throw Error('offline');}}));
});
