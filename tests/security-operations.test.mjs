import test from 'node:test';
import assert from 'node:assert/strict';
import {LOADGISTIC_PROJECT, inspectProductionSecurity, summarizeAdvisors} from '../scripts/lib/security-advisor.mjs';
const token='sbp_fc_test_token_not_a_real_credential';
const response=data=>({ok:true,status:200,json:async()=>data});

test('routine monitor refuses missing or classic credentials before network access',async()=>{
  for(const value of [undefined,'','sbp_classic_test','service-role-test']){
    await assert.rejects(inspectProductionSecurity({token:value,fetchImpl:()=>assert.fail('network must not run')}),/SCOPED_READ_ONLY/);
  }
});
test('monitor is limited to two exact read endpoints and refuses redirects',async()=>{
  const calls=[];
  const result=await inspectProductionSecurity({token,fetchImpl:async(url,options)=>{
    calls.push(url);assert.equal(options.method,'GET');assert.equal(options.redirect,'error');
    return response(calls.length===1?{id:LOADGISTIC_PROJECT,name:'loadgistic'}:{lints:[]});
  }});
  assert.deepEqual(calls,[`https://api.supabase.com/v1/projects/${LOADGISTIC_PROJECT}`,`https://api.supabase.com/v1/projects/${LOADGISTIC_PROJECT}/advisors/security`]);
  assert.equal(result.passed,true);
});
test('wrong project identity stops before advisor access',async()=>{
  let calls=0;
  await assert.rejects(inspectProductionSecurity({token,fetchImpl:async()=>{calls++;return response({id:'other-project',name:'loadgistic'});}}),/UNEXPECTED_PROJECT/);
  assert.equal(calls,1);
});
test('permission denial fails without printing provider body or token',async()=>{
  await assert.rejects(inspectProductionSecurity({token,fetchImpl:async()=>({ok:false,status:403,json:()=>assert.fail('body must not be read')})}),/^Error: ADVISOR_READ_HTTP_403$/);
});
test('critical RLS finding and warnings both block; informational default denial does not',()=>{
  for(const level of ['ERROR','WARN'])assert.equal(summarizeAdvisors({lints:[{name:'rls_disabled_in_public',level,metadata:{schema:'public',name:'spatial_ref_sys'}}]}).passed,false);
  assert.equal(summarizeAdvisors({lints:[{name:'rls_enabled_no_policy',level:'INFO'}]}).passed,true);
});
test('empty or malformed provider payload cannot masquerade as green',()=>{
  for(const payload of [null,{}, {lints:null},{lints:[{name:'anything',level:'NEW_UNKNOWN'}]},{lints:[{}]}])assert.throws(()=>summarizeAdvisors(payload),/INVALID_ADVISOR/);
});
test('summary excludes arbitrary detail, credentials and response metadata',()=>{
  const result=summarizeAdvisors({lints:[{name:'example',level:'WARN',detail:'private body',metadata:{schema:'public',name:'test',secret:'do-not-print'}}],token:'do-not-print'});
  assert.equal(JSON.stringify(result).includes('do-not-print'),false);assert.equal(JSON.stringify(result).includes('private body'),false);
});
