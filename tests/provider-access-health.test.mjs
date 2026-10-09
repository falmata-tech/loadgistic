import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const source=readFileSync(new URL('../src/app/api/health/route.ts',import.meta.url),'utf8').replace(/^import .*?;\n/gm,'').replaceAll('export ','');
const factory=new Function('NextResponse','launchReadiness','createSupabaseAdminClient',ts.transpile(source)+';return GET;');
const ready=()=>({ok:true,runtime:'local',storageBackend:'supabase',blockers:[],warnings:[]});
function handler(contract,profiles={count:3,error:null}){
 return factory({json:Response.json},ready,()=>({from:table=>table==='profiles'?{select:async()=>profiles}:{select:()=>({eq:()=>({single:async()=>contract})})}}));
}
test('new app readiness fails closed for missing, malformed or unavailable retirement contract',async()=>{
 for(const contract of [{error:{code:'42703'},data:null},{error:null,data:null},{error:null,data:{provider_billing_retired:false}},{error:null,data:{provider_billing_retired:'true'}}]){
  const response=await handler(contract)(),body=await response.json();
  assert.equal(response.status,503);assert.equal(body.ok,false);assert.equal(body.readyForPublicProduction,false);assert.ok(body.blockers.includes('provider-access-contract'));
 }
});
test('compatible contract reports readiness; failed database reads never report compatibility',async()=>{
 const contract={error:null,data:{provider_billing_retired:true,independent_single_truck:true,chat_visible_read_receipts:true,chat_assignment_unread:true,chat_read_assignment_frame:true,chat_alert_priority:true,driver_handover_alerts:true,capacity_contact_names:true,native_push_outbox:true}};
 const valid=await handler(contract)();assert.equal(valid.status,200);assert.equal((await valid.json()).readyForPublicProduction,true);
 const failed=await handler(contract,{count:null,error:{code:'unavailable'}})();assert.equal(failed.status,503);assert.equal((await failed.json()).readyForPublicProduction,false);
});
test('single-truck schema compatibility must also be installed; billing retirement alone is insufficient',async()=>{
 for(const marker of [undefined,null,false,'true']){
  const response=await handler({error:null,data:{provider_billing_retired:true,independent_single_truck:marker}})();
  assert.equal(response.status,503);assert.ok((await response.json()).blockers.includes('independent-truck-contract'));
 }
});

test('read receipt, per-assignment unread and stale-frame contracts must all be installed',async()=>{
 const current={provider_billing_retired:true,independent_single_truck:true,chat_visible_read_receipts:true,chat_assignment_unread:true,chat_read_assignment_frame:true,chat_alert_priority:true,driver_handover_alerts:true,capacity_contact_names:true,native_push_outbox:true};
 for(const [field,blocker] of [['chat_visible_read_receipts','chat-read-contract'],['chat_assignment_unread','chat-assignment-unread-contract'],['chat_read_assignment_frame','chat-assignment-frame-contract'],['chat_alert_priority','chat-alert-priority-contract'],['driver_handover_alerts','driver-handover-alert-contract'],['capacity_contact_names','capacity-contact-name-contract'],['native_push_outbox','native-push-contract']]){
  for(const marker of [undefined,null,false,'true']){const response=await handler({error:null,data:{...current,[field]:marker}})();assert.equal(response.status,503);assert.ok((await response.json()).blockers.includes(blocker));}
 }
});
