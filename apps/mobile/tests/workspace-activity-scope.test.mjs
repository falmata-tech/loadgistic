import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {chatAlertSnapshot} from '../../../src/lib/chat-read-policy.js';
import {chatAlertCopy,createChatAlertTracker} from '../../../src/lib/chat-alert-delivery.js';
import {handoverAlertSnapshot,handoverAlertCopy,createHandoverAlertTracker} from '../../../src/lib/handover-alerts.js';

// Run the real provider effects; native hosts, timers and HTTP are bounded ports.
// SQL/session revocation and real Expo workflow evidence remain separate checks.
function runtime(file,{state='ONBOARDING',platform='android',guest=null,role='DRIVER',platformRole=role}={}){
 const slots=[],effects=[],timers=new Map(),requests=[],guestRequests=[],pushInputs=[],removedKeys=[],revokedPushScopes=[];
 let cursor=0,nextTimer=0,backgroundStops=0;
 const session={state,user:{id:'current-actor',role,platformRole},accessToken:'synthetic-access'};
 const account={session,busy:false,request:async(path)=>{requests.push(path);return path.endsWith('location-leases')?{shipments:[]}:{unreadCount:0,waitingCount:0,items:[]};}};
 const same=(a,b)=>a?.length===b?.length&&a.every((value,index)=>Object.is(value,b[index]));
 const hooks={
  useState(initial){const index=cursor++;if(!(index in slots))slots[index]=typeof initial==='function'?initial():initial;return[slots[index],value=>{slots[index]=typeof value==='function'?value(slots[index]):value;}];},
  useRef(initial){const index=cursor++;return slots[index]||(slots[index]={current:initial});},
  useMemo(compute,deps){const index=cursor++,old=slots[index];if(old&&same(old.deps,deps))return old.value;const value=compute();slots[index]={deps,value};return value;},
  useCallback(value,deps){return hooks.useMemo(()=>value,deps);},
  useEffect(effect,deps){const index=cursor++,old=slots[index];if(old&&same(old.deps,deps))return;effects.push(()=>{old?.cleanup?.();const cleanup=effect();slots[index]={deps,cleanup};});},
 };
 const React={createElement:(type,props,...children)=>({type,props:{...props,children:children.flat(Infinity)}}),Fragment:'Fragment'};
 const Context={Provider:'Context.Provider'};
 const sources={
  React,...hooks,createContext:()=>Context,useContext:()=>({}),useAccount:()=>account,useLanguage:()=>({locale:'en',t:message=>message}),
  AppState:{currentState:'active',addEventListener:()=>({remove(){}})},Platform:{OS:platform},StyleSheet:{create:value=>value,absoluteFill:{}},
  ...Object.fromEntries(['Modal','Pressable','ScrollView','Text','View','SafeAreaView','AppIcon','LocationDisclosure'].map(name=>[name,name])),
  router:{navigate(){}},Storage:{getItemAsync:async()=>guest?'saved-synthetic-guest':null,deleteItemAsync:async key=>{removedKeys.push(key);}},ConsentStorage:{getItemAsync:async()=>null},
  brokerageStorageKey:'synthetic-guest',watchBrokerageAccess:()=>()=>{},parseSavedChat:()=>guest?{kind:'ACTIVE',requestId:guest.id,token:guest.token,validUntil:guest.validUntil}:null,
  apiRequest:async(path)=>{guestRequests.push(path);return{unreadCount:0,waitingCount:0,items:[]};},
  isChatMessageVisible:()=>false,blockChatReading(){},chatAlertSnapshot,chatAlertCopy,createChatAlertTracker,handoverAlertSnapshot,handoverAlertCopy,createHandoverAlertTracker,
  browserAlerts:()=>({prepare:async()=>'OFF',dispose:async()=>{},enabled:()=>false,status:()=>'OFF',reconcile:async()=>{}}),
  useNativePush:input=>{pushInputs.push(input);return{status:'UNSUPPORTED',optedIn:false,error:'',toggle:async()=>{}};},removeNativePushScope:async scope=>{revokedPushScopes.push(scope);},watchNativePushRefresh:()=>()=>{},
  palette:{ink:'#172c46',teal:'#06787c'},BackgroundNoticeLayout:Context,backgroundNoticeVisible:()=>false,
  Location:{},authorizeBackgroundLocation:async()=>{throw Error('Unexpected location authorization');},backgroundConsentKey:id=>id,
  deviceTrackingId:async()=>{throw Error('Unexpected device request');},readTrackingLeases:async()=>[],replaceTrackingLeases:async()=>{},revokeTrackingLease:async()=>{},startBackgroundTracking:async()=>{throw Error('Unexpected background start');},stopBackgroundTracking:async()=>{backgroundStops++;},trackingLeases:value=>value,
  setTimeout:(callback,delay=0)=>{const id=++nextTimer;timers.set(id,{callback,delay});return id;},clearTimeout:id=>timers.delete(id),
  setInterval:(callback,delay)=>{const id=++nextTimer;timers.set(id,{callback,delay,interval:true});return id;},clearInterval:id=>timers.delete(id),
 };
 const parsed=ts.createSourceFile(file,readFileSync(new URL(file,import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const source=ts.createPrinter().printFile(ts.factory.updateSourceFile(parsed,parsed.statements.filter(node=>!ts.isImportDeclaration(node))));
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText,exports={};
 new Function(...Object.keys(sources),'exports',code)(...Object.values(sources),exports);
 const component=exports.ChatAlertProvider||exports.BackgroundTracking;
 async function settle(){for(let index=0;index<12;index++)await Promise.resolve();}
 return{account,requests,guestRequests,pushInputs,removedKeys,revokedPushScopes,backgroundStops:()=>backgroundStops,
  async render(){cursor=0;component({children:'child'});while(effects.length)effects.shift()();await settle();},
  async tick(delay){for(const [id,timer]of [...timers])if(timer.delay<=delay){if(!timer.interval)timers.delete(id);timer.callback();}await settle();},
  unmount(){for(const slot of slots)slot?.cleanup?.();timers.clear();},
 };
}
for(const state of ['ONBOARDING','JOIN_FLEET']){
 test(`${state} cannot start member chat/handover/push activity`,async()=>{
  const view=runtime('../src/session/chat-alert-provider.tsx',{state});await view.render();
  assert.deepEqual(view.requests,[],'Pending identities must not hit active-workspace endpoints');assert.equal(view.pushInputs.at(-1).session,null);view.unmount();
 });
 test(`${state} cannot start global background location activity`,async()=>{
  const view=runtime('../src/components/background-tracking.tsx',{state});await view.render();await view.tick(0);
  assert.deepEqual(view.requests,[]);assert.equal(view.backgroundStops(),0);view.unmount();
 });
}
test('ACTIVE starts existing member alerts and location lease read; leaving ACTIVE cancels member work',async()=>{
 const chat=runtime('../src/session/chat-alert-provider.tsx',{state:'ONBOARDING'});await chat.render();chat.account.session={...chat.account.session,state:'ACTIVE'};await chat.render();
 assert.deepEqual(chat.requests,['/api/mobile/chat-alerts','/api/mobile/notifications/handover']);assert.equal(chat.pushInputs.at(-1).session,chat.account.session);
 chat.account.session={...chat.account.session,state:'JOIN_FLEET'};await chat.render();await chat.tick(5000);assert.equal(chat.requests.length,2);assert.equal(chat.pushInputs.at(-1).session,null);chat.unmount();
 const background=runtime('../src/components/background-tracking.tsx',{state:'ACTIVE'});await background.render();await background.tick(0);assert.deepEqual(background.requests,['/api/mobile/shipments/location-leases']);assert.equal(background.backgroundStops(),1);
 background.account.session={...background.account.session,state:'ONBOARDING'};await background.render();await background.tick(60000);assert.equal(background.requests.length,1);background.unmount();
});
test('retired guest chat is cleared without polling or notification authority',async()=>{
 const guest={id:'synthetic-chat',token:'synthetic-chat-token',validUntil:Date.now()+60000},view=runtime('../src/session/chat-alert-provider.tsx',{state:'ONBOARDING',guest});
 await view.render();await view.render();assert.deepEqual(view.requests,[]);assert.deepEqual(view.guestRequests,[]);assert.equal(view.pushInputs.at(-1).session,null);assert.equal(view.pushInputs.at(-1).guest,null);
 assert.deepEqual(view.removedKeys,['synthetic-guest']);assert.deepEqual(view.revokedPushScopes,['GUEST']);view.unmount();
});

test('a driver keeps agreed location duty when viewing a business workspace; a business-only user never starts it',async()=>{
 const driver=runtime('../src/components/background-tracking.tsx',{state:'ACTIVE',role:'CUSTOMER',platformRole:'DRIVER'});await driver.render();await driver.tick(0);assert.deepEqual(driver.requests,['/api/mobile/shipments/location-leases']);assert.equal(driver.backgroundStops(),1);driver.unmount();
 const customer=runtime('../src/components/background-tracking.tsx',{state:'ACTIVE',role:'CUSTOMER',platformRole:'SHIPPER'});await customer.render();await customer.tick(0);assert.deepEqual(customer.requests,[]);assert.equal(customer.backgroundStops(),0);customer.unmount();
});
