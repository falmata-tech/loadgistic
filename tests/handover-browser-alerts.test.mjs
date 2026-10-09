import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {handoverAlertInput,handoverAlertSnapshot,handoverAlertCopy,createHandoverAlertTracker} from '../src/lib/handover-alerts.js';
import {safeNotificationPath,createBrowserAlertDelivery} from '../src/lib/browser-alert-delivery.js';
const id='10000000-0000-0000-0000-000000000001',approvedAt='2026-10-08T14:00:00.123456+00:00';
const item={id,approvedAt,approvalKind:'OWNER',unread:true};
test('approval projections and acknowledgements reject forged fields and hide private data',()=>{
 assert.deepEqual(handoverAlertInput({id,approvedAt}),{id,approvedAt});
 for(const input of [{id,approvedAt,actorId:id},{id:'../admin',approvedAt},{id,approvedAt:null},{id,approvedAt:'bad'}])assert.throws(()=>handoverAlertInput(input));
 const projected=handoverAlertSnapshot({unreadCount:1,items:[{...item,email:'hidden@example.test',route:'hidden'}]});assert.deepEqual(projected,{unreadCount:1,items:[item]});
 for(const feed of [{unreadCount:-1,items:[]},{unreadCount:1,items:[{...item,approvalKind:'CANCELLED'}]},{unreadCount:2,items:[item,item]}])assert.throws(()=>handoverAlertSnapshot(feed));
 assert.match(handoverAlertCopy(item),/Tracking completed/);assert.match(handoverAlertCopy({...item,approvalKind:'STAFF'}),/Team approved/);
});
test('saved approval delivery is silent on baseline, deduplicated, independent from acknowledgement',()=>{
 const tracker=createHandoverAlertTracker();assert.deepEqual(tracker.next({unreadCount:0,items:[]}),[]);
 assert.deepEqual(tracker.next({unreadCount:1,items:[item]}),[item]);assert.deepEqual(tracker.next({unreadCount:1,items:[item]}),[]);
 assert.deepEqual(tracker.next({unreadCount:0,items:[{...item,unread:false}]}),[]);tracker.reset();assert.deepEqual(tracker.next({unreadCount:1,items:[item]}),[]);
});
test('system clicks accept only known same-site workflows; workers cache no private traffic',()=>{
 for(const path of ['/support/'+id,'/brokerage/'+id,'/app/provider-shipments/'+id,'/shipment-detail?id='+id,'/about#transport-chat'])assert.equal(safeNotificationPath(path),path);
 for(const path of ['https://evil.test','//evil.test','/admin','/support/../admin','/app/provider-shipments/'+id+'?token=secret','javascript:alert(1)'])assert.equal(safeNotificationPath(path),null);
 const root=readFileSync(new URL('../public/loadgistic-alerts-sw.js',import.meta.url),'utf8'),mobile=readFileSync(new URL('../apps/mobile/public/loadgistic-alerts-sw.js',import.meta.url),'utf8');assert.equal(root,mobile);assert.doesNotMatch(root,/addEventListener\(['"]fetch|caches\.|pushManager|acknowledge/);
});
test('unsupported browser never prevents normal alerts or requests permission',async()=>{
 const adapter=createBrowserAlertDelivery('fixture');assert.equal(await adapter.prepare(),'UNSUPPORTED');assert.equal(await adapter.toggle(),'UNSUPPORTED');assert.equal(await adapter.deliver({eventKey:'x',body:'New message',href:'/support'}),false);await adapter.dispose();
});
test('browser opt-in, cross-adapter duplicate claims, safe scope cleanup and delivery failure',async()=>{
 const names=['window','navigator','Notification','localStorage'],before=Object.fromEntries(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
 let permission='default',requested=0,registrationFails=false;const stored=new Map(),notifications=[];
 const worker={active:{},getNotifications:async()=>notifications,showNotification:async(title,options)=>{notifications.push({...options,title,close(){this.closed=true;}});}};
 const locks=new Map();const navigator={serviceWorker:{register:async()=>{if(registrationFails)throw Error('Worker failed');return worker;},getRegistration:async()=>worker},locks:{request:async(key,callback)=>{const pending=locks.get(key)||Promise.resolve();let finish;const next=new Promise(resolve=>finish=resolve);locks.set(key,next);await pending;try{return await callback();}finally{finish();}}}};
 const values={window:{isSecureContext:true},navigator,Notification:{get permission(){return permission;},requestPermission:async()=>{requested++;return permission;}},localStorage:{getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value),removeItem:key=>stored.delete(key),key:index=>[...stored.keys()][index],get length(){return stored.size;}}};
 values.window.Notification=values.Notification;
 for(const name of names)Object.defineProperty(globalThis,name,{configurable:true,value:values[name]});
 try{
  const first=createBrowserAlertDelivery('same-fixture'),second=createBrowserAlertDelivery('same-fixture');assert.equal(await first.prepare(),'OFF');assert.equal(requested,0,'Mount never prompts');permission='denied';assert.equal(await first.toggle(),'DENIED');assert.equal(first.enabled(),false);
  permission='granted';registrationFails=true;assert.equal(await first.toggle(),'UNAVAILABLE');assert.equal(first.enabled(),false);registrationFails=false;assert.equal(await first.toggle(),'ON');assert.equal(await second.prepare(),'ON');
  const input={eventKey:'handover:'+id+':'+approvedAt,body:'Unloading approved · Tracking completed',href:'/app/provider-shipments/'+id};
  const delivered=await Promise.all([first.deliver(input),second.deliver(input)]);assert.deepEqual(delivered.sort(),[false,true]);assert.equal(notifications.length,1);assert.deepEqual(notifications[0].data,{href:input.href,category:'handover'});
  assert.equal(await first.deliver({...input,eventKey:'bad',href:'https://evil.test'}),false);await first.reconcile('chat',[]);assert.equal(notifications[0].closed,undefined);await first.reconcile('handover',[]);assert.equal(notifications[0].closed,true);
  permission='denied';assert.equal(first.status(),'DENIED');assert.equal(await first.deliver({...input,eventKey:'later'}),false);await first.dispose();assert.equal(first.enabled(),false);
 }finally{for(const name of names)if(before[name])Object.defineProperty(globalThis,name,before[name]);else delete globalThis[name];}
});
