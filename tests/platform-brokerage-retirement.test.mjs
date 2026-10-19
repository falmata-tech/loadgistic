import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {randomUUID} from 'node:crypto';
import {safeNotificationPath} from '../src/lib/browser-alert-delivery.js';
import {nativePushDestination} from '../src/lib/native-push-destination.js';
import {chatAlertSnapshot,chatAlertChanges,chatAlertHref} from '../src/lib/chat-read-policy.js';
import {setSupabaseLoadgisticCapacityAccess,listSupabaseLoadgisticSharedCapacity} from '../src/lib/repository/supabase.js';
const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const moduleUrl=source=>'data:text/javascript,'+encodeURIComponent(source);
const helper=await readFile(new URL('../src/lib/retired-brokerage.ts',import.meta.url),'utf8');
const helperUrl=moduleUrl(compile(helper).replace("'next/server.js'",JSON.stringify(import.meta.resolve('next/server.js'))));
const routes=[
 ['transport-requests/route.ts',['POST']],['transport-requests/conversation/route.ts',['GET','POST','PATCH','DELETE']],
 ['transport-requests/conversation/read/route.ts',['GET','POST']],['brokerage/updates/route.ts',['GET']],
 ['brokerage/[id]/messages/route.ts',['GET','POST']],['brokerage/[id]/read/route.ts',['GET','POST']],
 ['admin/transport-requests/[id]/route.ts',['POST']],['mobile/brokerage/route.ts',['GET','POST']],
 ['mobile/brokerage/start/route.ts',['POST']],['mobile/brokerage/read/route.ts',['GET','POST']],['mobile/brokerage/alerts/route.ts',['GET']]
];
for(const [file,methods] of routes)test('retired '+file+' denies old clients before reading identity, body or database',async()=>{
 const source=await readFile(new URL('../src/app/api/'+file,import.meta.url),'utf8');
 const exports=await import(moduleUrl(compile(source).replace("'@/lib/retired-brokerage'",JSON.stringify(helperUrl))));
 const prior=globalThis.fetch;globalThis.fetch=()=>assert.fail('Retired endpoint must not call an external adapter');
 try{for(const method of methods){const response=await exports[method]();assert.equal(response.status,410);assert.match(response.headers.get('cache-control'),/no-store/);
  assert.match(response.headers.get('set-cookie'),/lg_transport_chat=;/);assert.match(response.headers.get('set-cookie'),/Max-Age=0/);
  assert.deepEqual(await response.json(),{ok:false,error:{code:'PLATFORM_BROKERAGE_RETIRED',message:'This service is no longer available.'}});
 }}finally{globalThis.fetch=prior;}
});
test('special platform capacity endpoint and old application ports cannot read or grant access',async()=>{
 const source=await readFile(new URL('../src/app/api/admin/capacity-network/route.ts',import.meta.url),'utf8');
 const exports=await import(moduleUrl(compile(source).replace("'@/lib/retired-brokerage'",JSON.stringify(helperUrl))));
 assert.equal(exports.GET().status,410);
 const prior=globalThis.fetch;globalThis.fetch=()=>assert.fail('No Loadgistic audience database call');
 try{await assert.rejects(()=>setSupabaseLoadgisticCapacityAccess({},randomUUID(),true),/PLATFORM_CAPACITY_RETIRED/);
  await assert.rejects(()=>listSupabaseLoadgisticSharedCapacity({}),/PLATFORM_CAPACITY_RETIRED/);
 }finally{globalThis.fetch=prior;}
});
test('stale browser/native Brokerage notifications cannot reopen the retired service',()=>{
 const id=randomUUID(),payload={app:'loadgistic',eventId:randomUUID(),sourceId:id,event:'MESSAGE'};
 for(const href of ['/brokerage','/brokerage/'+id,'/brokerage?queue=UNASSIGNED','/about#transport-chat','/arrange-transport'])assert.equal(safeNotificationPath(href),null);
 assert.equal(nativePushDestination({...payload,kind:'BROKERAGE'}),null);
 assert.deepEqual(nativePushDestination({...payload,kind:'SUPPORT'}),{pathname:'/support-chat',params:{id}});
 assert.deepEqual(nativePushDestination({...payload,kind:'HANDOVER',event:'APPROVED'}),{pathname:'/shipment-detail',params:{id}});
 assert.equal(safeNotificationPath('/support/'+id),'/support/'+id);assert.equal(safeNotificationPath('/shipment-detail?id='+id),'/shipment-detail?id='+id);
});
test('shared alert parsing preserves Support and discards retired messages, counts and sounds',()=>{
 const base={id:randomUUID(),status:'OPEN',side:'CUSTOMER',queued:false,assigned:true,assignedName:'Support',assignmentVersion:1,teamJoined:true,unreadCount:2,incomingSequence:3,endedAt:null,chatEnabled:true,updatedAt:'2026-10-18T12:00:00Z'};
 const support={...base,kind:'SUPPORT'},brokerage={...base,id:randomUUID(),kind:'BROKERAGE',unreadCount:8};
 const snapshot=chatAlertSnapshot({unreadCount:10,waitingCount:0,items:[support,brokerage]});
 assert.deepEqual(snapshot,{unreadCount:2,waitingCount:0,items:[support]});
 const previous={unreadCount:0,waitingCount:0,items:[]};
 assert.deepEqual(chatAlertChanges(previous,{unreadCount:8,waitingCount:0,items:[brokerage]}),[]);
 assert.equal(chatAlertChanges(previous,snapshot)[0].item.kind,'SUPPORT');assert.throws(()=>chatAlertHref(brokerage),/PLATFORM_BROKERAGE_RETIRED/);
});
test('native chat polling and sharing UI contain no retired request/grant controls',async()=>{
 for(const file of ['apps/mobile/src/session/chat-alert-provider.tsx','apps/mobile/src/session/native-push.ts']){
  const source=await readFile(new URL('../'+file,import.meta.url),'utf8');assert.doesNotMatch(source,/\/api\/mobile\/brokerage/);
 }
 for(const file of ['src/app/app/network/page.tsx','apps/mobile/src/screens/network.tsx','apps/mobile/src/screens/capacity.tsx','apps/mobile/src/components/navigation-shell.tsx']){
  const source=await readFile(new URL('../'+file,import.meta.url),'utf8');assert.doesNotMatch(source,/Share with Loadgistic|Need help with transport\?|href:\s*'\/arrange-transport'|href="\/arrange-transport"/);
 }
});
test('platform Terms no longer promise retired transport arrangement in any language',async()=>{
 const terms=await readFile(new URL('../src/app/terms/page.tsx',import.meta.url),'utf8');
 const agreement='Customers and transporters agree freight pricing, cargo fit, insurance, timing, liability, permits and payment directly.';
 assert.match(terms,/Direct agreements/);
 assert.ok(terms.includes(agreement));
 assert.doesNotMatch(terms,/When Loadgistic arranges transport/);
 for(const locale of ['am','om']){
  const messages=JSON.parse(await readFile(new URL(`../src/lib/i18n/messages/${locale}.json`,import.meta.url),'utf8'));
  assert.ok(messages[agreement]);
  assert.equal(Object.keys(messages).some(key=>key.includes('When Loadgistic arranges transport')),false);
 }
});
