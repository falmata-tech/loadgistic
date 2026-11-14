import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as mapLoading from '../src/lib/capacity-map-loading.js';
import {initialCapacityQueryShape} from '../src/lib/capacity-filter-presentation.ts';
import {capacityRefreshResult,currentCapacitySelection} from '../apps/mobile/src/map/capacity-refresh.ts';

const settle=async()=>{for(let index=0;index<20;index++)await Promise.resolve();};
const row=(id,vehicle='vehicle-a',percent=20)=>({id,vehicle_id:vehicle,vehicleId:vehicle,status:'PARTIAL',available_percent:percent,availablePercent:percent});
const page=(items,nextCursor=null)=>({items,hasMore:nextCursor!==null,nextCursor});

function clock(){
 let now=0,id=0;const timers=new Map();
 const schedule=(callback,delay,repeat=0)=>{const key=++id;timers.set(key,{callback,at:now+delay,repeat});return key;};
 return {timers,setTimeout:(fn,delay)=>schedule(fn,delay),clearTimeout:key=>timers.delete(key),
  setInterval:(fn,delay)=>schedule(fn,delay,delay),clearInterval:key=>timers.delete(key),
  advance(delta){const end=now+delta;for(;;){const next=[...timers].filter(([,timer])=>timer.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);if(next[1].repeat)timers.set(next[0],{...next[1],at:now+next[1].repeat});next[1].callback();}now=end;}
 };
}

function hooks(){
 const slots=[],effects=[];let cursor=0,dirty=false;
 const same=(a,b)=>a&&b&&a.length===b.length&&a.every((value,index)=>Object.is(value,b[index]));
 const memo=(factory,deps)=>{const index=cursor++;if(!slots[index]||!same(slots[index].deps,deps))slots[index]={deps,value:factory()};return slots[index].value;};
 const react={useState(initial){const index=cursor++;if(!(index in slots))slots[index]=typeof initial==='function'?initial():initial;return[slots[index],value=>{const next=typeof value==='function'?value(slots[index]):value;if(!Object.is(next,slots[index])){slots[index]=next;dirty=true;}}];},useRef(initial){const index=cursor++;return slots[index]||(slots[index]={current:initial});},useMemo:memo,useCallback:(fn,deps)=>memo(()=>fn,deps),useEffect(create,deps){const index=cursor++,old=slots[index];if(!old||!same(old.deps,deps)){slots[index]={deps,create,cleanup:old?.cleanup};effects.push(index);}}};
 return {react,render(fn,props){for(let pass=0;pass<15;pass++){dirty=false;cursor=0;const state=fn(props);while(effects.length){const effect=slots[effects.shift()];effect.cleanup?.();effect.cleanup=effect.create();}if(!dirty)return state;}throw Error('Unsettled feed hooks');},close(){for(const slot of slots)slot?.cleanup?.();}};
}

// Keep the actual component's hook/effect/request code unchanged, replacing only
// its unrelated JSX return with a test observation port. These are request and
// state-transition tests, not browser/native visual acceptance.
function componentPrefix(file,name,before,observation,ports){
 const parsed=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const original=parsed.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name.text===name);
 const end=original.body.statements.findIndex(node=>before(ts.createPrinter().printNode(ts.EmitHint.Unspecified,node,parsed)));
 assert.ok(end>0,'component test boundary must exist');
 const returned=ts.createSourceFile('observation.ts',`return ${observation};`,ts.ScriptTarget.Latest,true).statements[0];
 const updated=ts.factory.updateFunctionDeclaration(original,[ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],original.asteriskToken,original.name,original.typeParameters,original.parameters,original.type,ts.factory.updateBlock(original.body,[...original.body.statements.slice(0,end),returned]));
 const source=ts.createPrinter().printNode(ts.EmitHint.Unspecified,updated,parsed);
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function(...Object.keys(ports),'exports',compiled)(...Object.values(ports),exports);
 return exports[name];
}

function transport(){
 const requests=[];let ignoreAbort=false;
 return {requests,setIgnoreAbort:value=>{ignoreAbort=value;},fetch:(url,{signal})=>new Promise((resolve,reject)=>{
  const request={url,signal,reply:(data,status=200)=>resolve({ok:status>=200&&status<300,status,json:async()=>data}),fail:reject};requests.push(request);
  if(!ignoreAbort)signal.addEventListener('abort',()=>reject(signal.reason instanceof Error?signal.reason:new Error('Aborted')),{once:true});
 })};
}

function web({apiPath='/api/public/capacity',initialItems=[row('old')],query={}}={}){
 const runtime=hooks(),time=clock(),http=transport(),listeners=new Set(),blocked=[];
 const document={visibilityState:'visible',addEventListener:(name,fn)=>{assert.equal(name,'visibilitychange');listeners.add(fn);},removeEventListener:(_name,fn)=>listeners.delete(fn)};
 const Component=componentPrefix('src/components/public-capacity-feed.tsx','CapacityFeedState',source=>source.startsWith('function useMyLocation'),
  '{items,selectedId,loading,error,loadWindow,explore,selectTruck}',
  {React:runtime.react,window:time,document,fetch:http.fetch,...mapLoading,useBlockedProviders:()=>({blocked}),filterPresentation:{nearbyDistance:{defaultKm:50}},initialCapacityQueryShape,requestAnimationFrame:fn=>fn()});
 let props={apiPath,initial:{items:initialItems},query,search:{searchTerm:'',submittedSearch:null,drawerOpen:false,setDrawerOpen(){},pause(){}},onReset(){}};
 return {time,http,render(next){props={...props,...next};return runtime.render(Component,props);},visibility(value){document.visibilityState=value;for(const listener of listeners)listener();},close:()=>runtime.close()};
}

test('web polls every15s without aborting long cursor loads and preserves filters/viewport',async()=>{
 const h=web({query:{status:'PARTIAL'}});try{
  let state=h.render();state.explore([1,2,3,4]);assert.equal(h.http.requests.length,1);
  h.time.advance(15000);await settle();assert.equal(h.http.requests.length,1);assert.equal(h.http.requests[0].signal.aborted,false);
  h.http.requests[0].reply(page([row('a')],'next'));await settle();assert.equal(h.http.requests.length,2);
  h.time.advance(15000);await settle();assert.equal(h.http.requests.length,2,'page progress resets its30s deadline; timer cannot starve page2');
  h.http.requests[1].reply(page([row('b','vehicle-b')]));await settle();state=h.render();assert.deepEqual(state.items.map(item=>item.id),['a','b']);
  h.time.advance(15000);assert.equal(h.http.requests.length,3);
  const params=new URL(h.http.requests[2].url,'https://local.test').searchParams;
  assert.equal(params.get('status'),'PARTIAL');assert.equal(params.get('viewport'),'1.0000,2.0000,3.0000,4.0000');assert.equal(params.has('cursor'),false);
 }finally{h.close();}
});

test('web pauses hidden reads, aborts the old window and refreshes once on return',async()=>{
 const h=web();try{h.render();h.time.advance(15000);assert.equal(h.http.requests.length,1);h.visibility('hidden');assert.equal(h.http.requests[0].signal.aborted,true);await settle();h.time.advance(45000);assert.equal(h.http.requests.length,1);h.visibility('visible');assert.equal(h.http.requests.length,2);h.visibility('visible');assert.equal(h.http.requests.length,2);}finally{h.close();}
});

test('web hung page expires after30s and a subsequent poll recovers',async()=>{
 const h=web();try{h.render();h.time.advance(15000);h.time.advance(30000);await settle();let state=h.render();assert.equal(h.http.requests.length,1);assert.equal(h.http.requests[0].signal.aborted,true);assert.ok(state.error);h.time.advance(15000);assert.equal(h.http.requests.length,2);h.http.requests[1].reply(page([row('fresh')]));await settle();state=h.render();assert.deepEqual(state.items.map(item=>item.id),['fresh']);assert.equal(state.error,'');}finally{h.close();}
});

for(const path of ['/api/account-capacity','/api/business-workspaces/owned/capacity','/api/shared-capacity','/api/admin/capacity-network'])for(const status of [401,403,404])test(`web ${path} denial${status} clears private cache/selection`,async()=>{
 const h=web({apiPath:path});try{let state=h.render();state.selectTruck('old');state=h.render();state.loadWindow();h.http.requests[0].reply({},status);await settle();state=h.render();assert.deepEqual(state.items,[]);assert.equal(state.selectedId,null);}finally{h.close();}
});

test('private200 omission revalidates one selected truck without viewport, then removes a revoked row',async()=>{
 const h=web({apiPath:'/api/account-capacity',query:{status:'PARTIAL'}});try{
  let state=h.render();state.selectTruck('old');h.render().explore([1,2,3,4]);h.http.requests[0].reply(page([row('other','vehicle-b')]));await settle();assert.equal(h.http.requests.length,2);
  const params=new URL(h.http.requests[1].url,'https://local.test').searchParams;assert.equal(params.get('truck'),'old');assert.equal(params.get('status'),'PARTIAL');assert.equal(params.has('viewport'),false);assert.equal(params.has('cursor'),false);
  h.time.advance(9000);assert.equal(h.http.requests.length,2,'the exact check remains part of the same in-flight window');
  h.http.requests[1].reply(page([]));
  await settle();state=h.render();assert.equal(state.selectedId,null);assert.deepEqual(state.items.map(item=>item.id),['other']);
 }finally{h.close();}
});

test('private selected read preserves an authorized outside-viewport popup and fresh values',async()=>{
 const h=web({apiPath:'/api/account-capacity'});try{let state=h.render();state.selectTruck('old');h.render().explore([1,2,3,4]);h.http.requests[0].reply(page([]));await settle();h.http.requests[1].reply(page([row('old','vehicle-a',80)]));await settle();state=h.render();assert.equal(state.selectedId,'old');assert.equal(state.items[0].available_percent,80);assert.equal(h.http.requests.length,2);}finally{h.close();}
});

test('private exact checks fail closed on timeout, malformed pages and another truck',async()=>{
 for(const result of [null,{items:'invalid',hasMore:false},page([row('unrelated','foreign')]),page([row('old','foreign')]),page([row('old')],'next')]){
  const h=web({apiPath:'/api/account-capacity'});try{let state=h.render();state.selectTruck('old');h.render().loadWindow();h.http.requests[0].reply(page([row('other','vehicle-b')]));await settle();assert.equal(h.http.requests.length,2);if(result===null)h.time.advance(10000);else h.http.requests[1].reply(result);await settle();state=h.render();assert.equal(state.selectedId,null);assert.deepEqual(state.items.map(item=>item.id),['other']);assert.ok(state.error);assert.equal(h.http.requests.length,2);}finally{h.close();}
 }
});

test('completed pages without an absent selection need no extra authorization query',async()=>{
 for(const selected of [null,'old'])for(const apiPath of ['/api/public/capacity','/api/account-capacity']){
  const h=web({apiPath});try{let state=h.render();if(selected)state.selectTruck(selected);h.render().loadWindow();h.http.requests[0].reply(page([row('old','vehicle-a',80)]));await settle();state=h.render();assert.equal(h.http.requests.length,1);assert.equal(state.loading,false);assert.equal(state.items[0].available_percent,80);}finally{h.close();}
 }
});

test('public200 omission removes a no-longer-available selected signal; transient failure retains its dated snapshot',async()=>{
 for(const missing of [true,false]){const h=web();try{let state=h.render();state.selectTruck('old');h.render().loadWindow();h.http.requests[0].reply(page([]));await settle();if(missing)h.http.requests[1].reply(page([]));else h.http.requests[1].reply({},503);await settle();state=h.render();assert.equal(state.selectedId,missing?null:'old');assert.equal(state.items.length,missing?0:1);assert.equal(Boolean(state.error),!missing);}finally{h.close();}}
});

test('web selected publication follows the authorized replacement vehicle signal without duplicate marker or lookup',async()=>{
 for(const apiPath of ['/api/public/capacity','/api/account-capacity']){const h=web({apiPath});try{let state=h.render();state.selectTruck('old');h.render().loadWindow();h.http.requests[0].reply(page([row('new','vehicle-a',80)]));await settle();state=h.render();assert.equal(state.selectedId,'new');assert.deepEqual(state.items.map(item=>[item.id,item.available_percent]),[['new',80]]);assert.equal(h.http.requests.length,1);}finally{h.close();}}
});

test('an old private403 cannot erase a new scope and deliberate selection supersedes its pending exact read',async()=>{
 const h=web({apiPath:'/api/account-capacity',initialItems:[row('old'),row('chosen','vehicle-b')]});try{
  h.http.setIgnoreAbort(true);let state=h.render();state.selectTruck('old');h.render().loadWindow();h.http.requests[0].reply(page([]));await settle();assert.equal(h.http.requests.length,2);
  h.render().selectTruck('chosen');assert.equal(h.http.requests[1].signal.aborted,true);assert.equal(h.http.requests.length,3);
  h.http.requests[2].reply(page([row('chosen','vehicle-b',80)]));await settle();h.http.requests[1].reply({},403);await settle();state=h.render();assert.equal(state.selectedId,'chosen');assert.deepEqual(state.items.map(item=>item.id),['chosen']);
 }finally{h.close();}
});

test('old audience responses cannot clear or restore a newer authorized feed',async()=>{
 const h=web({apiPath:'/api/business-workspaces/old/capacity'});try{h.http.setIgnoreAbort(true);h.render().loadWindow();const old=h.http.requests[0];h.render({apiPath:'/api/business-workspaces/new/capacity'}).loadWindow();const current=h.http.requests[1];assert.equal(old.signal.aborted,true);current.reply(page([row('new-scope')]));await settle();old.reply({},403);await settle();const state=h.render();assert.deepEqual(state.items.map(item=>item.id),['new-scope']);assert.equal(state.error,'');}finally{h.close();}
});

function native(){
 const runtime=hooks(),time=clock(),http=transport(),appListeners=new Set();let focus=true;
 const AppState={currentState:'active',addEventListener:(_name,fn)=>{appListeners.add(fn);return{remove:()=>appListeners.delete(fn)};}};
 const useFocusEffect=callback=>runtime.react.useEffect(()=>focus?callback():undefined,[callback,focus]);
 const hookSource=readFileSync('apps/mobile/src/hooks/foreground-refresh.ts','utf8').replace(/^import[^\n]+\n/gm,'');
 const hookExports={},hookCode=ts.transpileModule(hookSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('useCallback','useFocusEffect','AppState','setInterval','clearInterval','exports',hookCode)(runtime.react.useCallback,useFocusEffect,AppState,time.setInterval,time.clearInterval,hookExports);
 class ApiError extends Error{constructor(status){super('Request failed');this.status=status;}}
 const loader=(signal,onPage)=>mapLoading.loadCapacityMapWindow({signal,onPage:items=>onPage(items),requestPage:async cursor=>{const response=await http.fetch(`https://local.test/capacity?cursor=${cursor||''}`,{signal});if(!response.ok)throw new ApiError(response.status);return response.json();}});
 const visitor={ready:true,snapshot:{foreground:true,capacity:null},controller:{}},blocked=[];
 const ports={...runtime.react,useFocusEffect,useLanguage:()=>({t:value=>value}),useAccount:()=>({session:null}),useVisitor:()=>visitor,useBlockedProviders:()=>({blocked}),
  useForegroundRefresh:hookExports.useForegroundRefresh,emptySignals:[],capacityRefreshResult,currentCapacitySelection,
  useTransporterSearch:()=>({input:'',cancel(){},state:null}),transporterSearchQuery:()=>null,
  BackHandler:{addEventListener:()=>({remove(){}})},loadCapacity:(_origin,_query,signal,onPage)=>loader(signal,onPage),loadSharedCapacity:(_query,signal,onPage)=>loader(signal,onPage),
  loadAccountCapacity:(signal,onPage)=>loader(signal,onPage),apiOrigin:'https://local.test',fetch(){},ApiError,setTimeout:time.setTimeout,clearTimeout:time.clearTimeout};
 const Component=componentPrefix('apps/mobile/src/screens/capacity.tsx','Capacity',source=>source.startsWith('const resetResults'),'{items,selected,selection,selectMapSignal,refreshCapacity,loading,error,setFilters}',ports);
 let props={initialQuery:'',initialMode:'open',initialFilters:{}};
 return {time,http,render(next){props={...props,...next};return runtime.render(Component,props);},focus(value){focus=value;},app(value){AppState.currentState=value;for(const listener of appListeners)listener(value);},close:()=>runtime.close()};
}

test('native15s foreground refresh waits for complete cursor work and follows new publication identity',async()=>{
 const h=native();try{let state=h.render();assert.equal(h.http.requests.length,1);h.time.advance(15000);await settle();h.render();assert.equal(h.http.requests.length,1);h.http.requests[0].reply(page([row('old')],'next'));await settle();h.time.advance(15000);h.render();assert.equal(h.http.requests.length,2);h.http.requests[1].reply(page([]));await settle();state=h.render();state.selectMapSignal(state.items[0]);state=h.render();h.time.advance(15000);h.render();assert.equal(h.http.requests.length,3);h.http.requests[2].reply(page([row('new','vehicle-a',80)]));await settle();state=h.render();assert.deepEqual(state.items.map(item=>item.id),['new']);assert.equal(state.selected.id,'new');assert.equal(state.selected.availablePercent,80);assert.equal(state.selection.signal.id,'new');}finally{h.close();}
});

test('native background/blur pauses requests; resume reads once and privacy denial cannot retain a popup',async()=>{
 const h=native();try{let state=h.render({initialMode:'private',account:{scopeKey:'actor',request:async()=>{}}});h.http.requests[0].reply(page([row('old')]));await settle();state=h.render();state.selectMapSignal(state.items[0]);h.render();h.app('background');h.time.advance(45000);h.render();assert.equal(h.http.requests.length,1);h.app('active');h.render();assert.equal(h.http.requests.length,2);h.app('active');h.render();assert.equal(h.http.requests.length,2);h.http.requests[1].reply({},403);await settle();state=h.render();assert.deepEqual(state.items,[]);assert.equal(state.selected,null);h.focus(false);h.render();h.time.advance(45000);h.render();assert.equal(h.http.requests.length,2);h.focus(true);h.render();assert.equal(h.http.requests.length,3);}finally{h.close();}
});

test('native background cancels a cursor chain before further pages and a200 private omission clears selection',async()=>{
 const h=native();try{let state=h.render({initialMode:'private',account:{scopeKey:'actor',request:async()=>{}}});const old=h.http.requests[0];h.app('background');assert.equal(old.signal.aborted,true);old.reply(page([row('late')],'next'));await settle();h.time.advance(45000);h.render();assert.equal(h.http.requests.length,1);h.app('active');h.render();assert.equal(h.http.requests.length,2);h.http.requests[1].reply(page([row('old')]));await settle();state=h.render();state.selectMapSignal(state.items[0]);h.render();h.time.advance(15000);h.render();h.http.requests[2].reply(page([]));await settle();state=h.render();assert.equal(state.selected,null);assert.deepEqual(state.items,[]);}finally{h.close();}
});

test('native timed-out read recovers on a later tick and stale failed scope cannot erase new results',async()=>{
 const h=native();try{h.render();h.time.advance(30000);await settle();let state=h.render();assert.equal(state.loading,false);assert.ok(state.error);h.time.advance(15000);h.render();assert.equal(h.http.requests.length,2);h.http.setIgnoreAbort(true);state=h.render();state.setFilters({status:'EMPTY'});h.render();assert.equal(h.http.requests[1].signal.aborted,true);assert.equal(h.http.requests.length,3);h.http.requests[2].reply(page([row('current')]));await settle();h.http.requests[1].reply({},403);await settle();state=h.render();assert.deepEqual(state.items.map(item=>item.id),['current']);assert.equal(state.error,'');}finally{h.close();}
});
