import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as discovery from '../src/api/discovery.ts';
import * as searchContract from '../../../src/lib/transporter-search.js';
import {capacityIntroduction} from '../../../src/lib/platform-copy.js';

// Execute the actual Capacity screen, effects and handlers with native hosts and
// the transport boundary substituted. Browser evidence is collected separately.
const nodes=tree=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];
const find=(tree,predicate)=>nodes(tree).find(predicate);
const text=tree=>tree==null||typeof tree==='boolean'?'':typeof tree==='string'||typeof tree==='number'?String(tree):Array.isArray(tree)?tree.map(text).join(' '):text(tree.props?.children);
const settle=async()=>{for(let index=0;index<10;index++)await Promise.resolve();};
const payload=(title,page=1)=>({items:[{key:title,kind:'COMPANY',title,handle:'matching-company',description:'Public freight service',city:'Adama',capacityId:'',matchingTrucks:2}],total:24,page,hasMore:page===1,configurations:[]});

function harness({mode='open',verified=true,initialQuery='',blocked=[]}={}){
 const hooks=[],effects=[];let cursor=0,effectIndex=0,dirty=false,now=0,nextTimer=0,tree,focusCallback,focusCleanup;
 const timers=new Map(),requests=[],mapLoads=[],backHandlers=new Set();
 const clock={setTimeout(callback,delay){const id=++nextTimer;timers.set(id,{callback,at:now+delay});return id;},clearTimeout:id=>timers.delete(id),advance(delta){const end=now+delta;for(;;){const next=[...timers].filter(([,timer])=>timer.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].callback();}now=end;}};
 const same=(left,right)=>left&&right&&left.length===right.length&&left.every((value,index)=>Object.is(value,right[index]));
 const memo=(factory,deps)=>{const index=cursor++,previous=hooks[index];if(!previous||!same(previous.deps,deps))hooks[index]={value:factory(),deps};return hooks[index].value;};
 const react={useState(initial){const index=cursor++;if(!(index in hooks))hooks[index]=typeof initial==='function'?initial():initial;return[hooks[index],value=>{const next=typeof value==='function'?value(hooks[index]):value;if(!Object.is(next,hooks[index])){hooks[index]=next;dirty=true;}}];},useRef(initial){const index=cursor++;return hooks[index]||(hooks[index]={current:initial});},useMemo:memo,useCallback:(callback,deps)=>memo(()=>callback,deps),useEffect(create,deps){const index=effectIndex++,previous=effects[index];if(!previous||!same(previous.deps,deps))effects[index]={deps,create,cleanup:previous?.cleanup,pending:true};}};
 const node=(type,props,key)=>({type,props:props||{},key}),native=Object.fromEntries(['View','Text','ScrollView','Pressable','TextInput'].map(name=>[name,name]));
 native.StyleSheet={create:value=>value};native.Keyboard={dismiss(){}};
 native.BackHandler={addEventListener:(event,handler)=>{assert.equal(event,'hardwareBackPress');backHandlers.add(handler);return{remove:()=>backHandlers.delete(handler)};}};
 const request=(path,signal,scope)=>new Promise((resolve,reject)=>{requests.push({path,signal,scope,resolve,reject});signal.addEventListener('abort',()=>reject(new Error('Aborted')),{once:true});});
 const visitor={ready:true,snapshot:{foreground:true,capacity:verified?{startedAt:1}:null},controller:{request:(scope,path,_options,signal)=>request(path,signal,scope),touch:async()=>{},clear:async()=>{}}};
 const truck={id:'11111111-1111-4111-8111-111111111111',provider_handle:'chosen-company'};
 const load=(...args)=>{mapLoads.push(args);args[mode==='private'?2:3]([truck]);return Promise.resolve();};
 const imports={react,'react/jsx-runtime':{jsx:node,jsxs:node},'react-native':native,'expo-router':{Link:'Link',useLocalSearchParams:()=>({}),useFocusEffect:callback=>react.useEffect(()=>{focusCallback=callback;focusCleanup=callback();return()=>focusCleanup?.();},[callback])},
  '../session/chat-alert-provider':{useChatUpdates:()=>({transportUnreadCount:0})},'../hooks/content-blocks':{useBlockedProviders:()=>({blocked})},'../localization/provider':{useLanguage:()=>({t:message=>message})},'../session/visitor-provider':{useVisitor:()=>visitor},'../session/provider':{useAccount:()=>({session:null,busy:false})},
  '../components/visitor-access':{VisitorAccess:'VisitorAccess'},'../components/app-icon':{AppIcon:'AppIcon'},'../components/CapacityMap':{__esModule:true,default:'CapacityMap'},'../api/http':{apiOrigin:'http://local.test',apiRequest:(path,{signal})=>request(path,signal)},'../api/discovery':discovery,
  '../api/business-workspaces':{loadBusinessCapacity:()=>{throw Error('business-only loader used by visitor Capacity');}},'../api/response':{ApiError:class ApiError extends Error{}},'../hooks/foreground-refresh':{useForegroundRefresh:()=>{}},'../hooks/account-query':{useAccountQuery:()=>({data:null})},
  '../components/discovery-filters':{DiscoveryFilters:'DiscoveryFilters'},'../components/results-drawer':{ResultsDrawer:'ResultsDrawer'},'../../../../src/lib/vehicle-configurations':{VEHICLE_CONFIGURATIONS:[]},'../components/discovery-results':{DiscoveryResults:'DiscoveryResults'},'../components/loading-bar':{LoadingBar:'LoadingBar'},'../../../../src/lib/platform-copy.js':{capacityIntroduction},'../../../../src/lib/transporter-search.js':searchContract,'../api/public-capacity':{loadCapacity:load,loadSharedCapacity:load}
 };
 imports['../components/ui']={palette:{blue:'#155eef',border:'#d7dfeb',borderSoft:'#e5eaf1',muted:'#526375'}};
 const source=ts.transpileModule(readFileSync(new URL('../src/screens/capacity.tsx',import.meta.url),'utf8')+'\nexports.TestCapacity=Capacity;',{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function('require','exports','setTimeout','clearTimeout',source)(name=>{assert.ok(name in imports,'Unexpected dependency '+name);return imports[name];},exports,clock.setTimeout,clock.clearTimeout);
 const props={initialQuery,initialMode:mode,initialFilters:{provider:'chosen-company',truck:truck.id,status:'EMPTY'}};
 const render=()=>{for(let pass=0;pass<10;pass++){dirty=false;cursor=effectIndex=0;tree=exports.TestCapacity(props);for(const effect of effects)if(effect.pending){effect.pending=false;effect.cleanup?.();effect.cleanup=effect.create();}if(!dirty)return tree;}throw Error('Unsettled screen');};
 return{render,clock,requests,mapLoads,visitor,backHandlerCount:()=>backHandlers.size,pressBack:()=>[...backHandlers].at(-1)?.()??false,blur:()=>focusCleanup?.(),focus:()=>{focusCleanup=focusCallback?.();},close(){for(const effect of effects)effect.cleanup?.();}};
}
const input=tree=>find(tree,node=>node.type==='TextInput');
const results=tree=>find(tree,node=>node.type==='DiscoveryResults');
const map=tree=>find(tree,node=>node.type==='CapacityMap');
const open=tree=>find(tree,node=>node.type==='Pressable'&&node.props.accessibilityLabel==='Search transporters').props.onPress();
const edit=(tree,value)=>input(tree).props.onChangeText(value);
const submit=tree=>find(tree,node=>node.type==='Pressable'&&node.props.accessibilityLabel==='Search').props.onPress();

for(const mode of ['open','private'])test(`${mode} profile search ignores truck filters and Show trucks retains the current map filters`,async()=>{
 const blocked=['hidden-company'],view=harness({mode,blocked});try{
  let tree=view.render();await settle();tree=view.render();open(tree);tree=view.render();edit(tree,'Adama');tree=view.render();submit(tree);tree=view.render();
  const query=new URL(view.requests[0].path,'http://local.test').searchParams;
  assert.deepEqual([...query.keys()].sort(),['blocked','page','q'],'only profile text, bounded page and existing blocklist belong to search');assert.equal(query.get('blocked'),JSON.stringify(blocked));
  view.requests[0].resolve(payload('Independent public match'));await settle();tree=view.render();const baseline=results(tree).props.result;
  find(tree,node=>node.type==='Pressable'&&node.props.accessibilityLabel==='Vehicle filters').props.onPress();tree=view.render();
  const next={status:'PARTIAL',vehicleCategory:'Mini Box Truck',loadType:'PTL',stopOption:'MULTI_PICK',freshness:'UPDATE_NEEDED',nearLat:'9.0',nearLng:'38.0',nearRadiusKm:'20',ownerDocs:'IDENTITY,BUSINESS_LICENSE',driverDocs:'DRIVER_IDENTITY',truckDocs:'VEHICLE_OWNERSHIP,VEHICLE_AUTHORIZATION'};
  find(tree,node=>node.type==='DiscoveryFilters').props.onApply(next);tree=view.render();await settle();tree=view.render();view.clock.advance(500);tree=view.render();
  assert.equal(view.requests.length,1,'changing map filters must not restart profile lookup');assert.equal(input(tree).props.value,'Adama');assert.equal(results(tree).props.result,baseline,'current profile matches remain available');assert.equal(view.mapLoads.length,2,'the explicit map filter application still loads trucks');
  results(tree).props.onPage(2);tree=view.render();const nextPage=new URL(view.requests[1].path,'http://local.test').searchParams;assert.deepEqual([...nextPage.keys()].sort(),['blocked','page','q']);assert.equal(nextPage.get('page'),'2');view.requests[1].resolve(payload('Independent public match',2));await settle();tree=view.render();
  const beforeIdentity=map(tree).key;results(tree).props.onMap(baseline.items[0]);tree=view.render();await settle();tree=view.render();assert.notEqual(map(tree).key,beforeIdentity);
  assert.deepEqual(view.mapLoads.at(-1)[mode==='private'?4:5],{...next,provider:'matching-company',truck:'',blocked:JSON.stringify(blocked)},'Show trucks combines explicit identity with the latest truck filters and all document requirements');assert.equal(view.requests.length,2);if(mode==='private')assert.equal(view.requests[0].scope,'capacity');
 }finally{view.close();}
});

test('native drawer-only search waits 500ms and counts trimmed Unicode characters',async()=>{
 const view=harness({initialQuery:'Saved draft'});try{
  let tree=view.render();await settle();tree=view.render();view.clock.advance(500);assert.equal(view.requests.length,0);
  open(tree);tree=view.render();edit(tree,' 😀 ');tree=view.render();view.clock.advance(500);assert.equal(view.requests.length,0);assert.ok(text(tree).includes('Enter at least two characters.'));
  edit(tree,' Ab ');tree=view.render();view.clock.advance(499);assert.equal(view.requests.length,0);
  edit(tree,'  አዲ  ');tree=view.render();view.clock.advance(499);assert.equal(view.requests.length,0);view.clock.advance(1);tree=view.render();
  assert.equal(view.requests.length,1);const query=new URL(view.requests[0].path,'http://local.test').searchParams;assert.equal(query.get('q'),'አዲ');assert.equal(query.get('page'),'1');assert.deepEqual([...query.keys()].sort(),['page','q']);assert.equal(results(tree).props.loading,true);
 }finally{view.close();}
});

test('one active request coalesces latest text, hides stale matches and preserves the map',async()=>{
 const view=harness();try{
  let tree=view.render();await settle();tree=view.render();open(tree);tree=view.render();const originalMap=map(tree);
  edit(tree,'First');tree=view.render();submit(tree);tree=view.render();const first=view.requests[0];first.resolve(payload('First match'));await settle();tree=view.render();const stale=results(tree);
  assert.equal(stale.props.result.items[0].title,'First match');edit(tree,'Second');tree=view.render();assert.equal(results(tree)?.props.result||null,null);
  stale.props.onMap(stale.props.result.items[0]);stale.props.onPage(2);stale.props.onRetry();tree=view.render();assert.equal(map(tree).key,originalMap.key,'obsolete Show trucks cannot change the map');assert.equal(view.requests.length,1,'obsolete pagination and retry cannot restart the previous query');
  view.clock.advance(500);tree=view.render();const second=view.requests[1];
  edit(tree,'Third');tree=view.render();view.clock.advance(500);tree=view.render();edit(tree,'Newest');tree=view.render();view.clock.advance(500);tree=view.render();
  assert.equal(view.requests.length,2,'typing cannot overlap a still-active search');assert.equal(second.signal.aborted,false,'transport abort is not used to assume database cancellation');
  second.resolve(payload('Obsolete second'));await settle();tree=view.render();assert.equal(view.requests.length,3);assert.equal(new URL(view.requests[2].path,'http://local.test').searchParams.get('q'),'Newest');assert.equal(results(tree).props.result,null);
  view.requests[2].resolve(payload('Current match'));await settle();tree=view.render();assert.equal(results(tree).props.result.items[0].title,'Current match');assert.equal(map(tree).key,originalMap.key);assert.equal(map(tree).props.items,originalMap.props.items);assert.equal(view.mapLoads.length,1);
 }finally{view.close();}
});

test('submit is immediate without a delayed duplicate, and changed text resets pagination',async()=>{
 const view=harness();try{
  let tree=view.render();await settle();tree=view.render();open(tree);tree=view.render();edit(tree,'Adama');tree=view.render();input(tree).props.onSubmitEditing();tree=view.render();assert.equal(view.requests.length,1);
  view.clock.advance(500);tree=view.render();assert.equal(view.requests.length,1);view.requests[0].resolve(payload('Adama match'));await settle();tree=view.render();results(tree).props.onPage(2);tree=view.render();assert.equal(new URL(view.requests[1].path,'http://local.test').searchParams.get('page'),'2');
  edit(tree,'Addis');tree=view.render();submit(tree);tree=view.render();assert.equal(view.requests.length,2);view.requests[1].resolve(payload('Old page',2));await settle();tree=view.render();assert.equal(new URL(view.requests[2].path,'http://local.test').searchParams.get('page'),'1');
 }finally{view.close();}
});

test('selecting a map marker closes search interest and reopening cannot show previous matches',async()=>{
 const view=harness();try{
  let tree=view.render();await settle();tree=view.render();open(tree);tree=view.render();edit(tree,'Adama');tree=view.render();submit(tree);tree=view.render();view.requests[0].resolve(payload('Previous match'));await settle();tree=view.render();assert.equal(results(tree).props.result.items[0].title,'Previous match');
  map(tree).props.onSelect(map(tree).props.items[0]);tree=view.render();assert.equal(results(tree),undefined);open(tree);tree=view.render();assert.equal(results(tree)?.props.result||null,null,'the old generation must stay hidden during the new pause');view.clock.advance(500);tree=view.render();assert.equal(view.requests.length,2);
 }finally{view.close();}
});

test('private foreground pause discards prior results before the same session resumes',async()=>{
 const view=harness({mode:'private'});try{
  let tree=view.render();await settle();tree=view.render();open(tree);tree=view.render();edit(tree,'Adama');tree=view.render();submit(tree);tree=view.render();view.requests[0].resolve(payload('Previous private match'));await settle();tree=view.render();assert.equal(results(tree).props.result.items[0].title,'Previous private match');
  view.visitor.snapshot.foreground=false;tree=view.render();assert.equal(results(tree),undefined);view.visitor.snapshot.foreground=true;tree=view.render();assert.equal(results(tree)?.props.result||null,null,'restoring an unchanged session cannot expose invalidated matches');view.clock.advance(500);tree=view.render();assert.equal(view.requests.length,2);
 }finally{view.close();}
});

test('leaving a retained Capacity screen cancels delayed interest and resumes only when focused',async()=>{
 const view=harness();try{
  let tree=view.render();await settle();tree=view.render();open(tree);tree=view.render();edit(tree,'Adama');tree=view.render();view.blur();tree=view.render();view.clock.advance(500);tree=view.render();assert.equal(view.requests.length,0,'an open drawer on a hidden route must not start a query');view.focus();tree=view.render();view.clock.advance(500);tree=view.render();assert.equal(view.requests.length,1);assert.equal(view.mapLoads.length,1,'route focus affects only search interest');
 }finally{view.close();}
});

test('Android Back closes only a focused search drawer and cancels its search interest',async()=>{
 const view=harness();try{
  let tree=view.render();await settle();tree=view.render();
  assert.equal(view.backHandlerCount(),0,'closed Capacity must leave Back to the navigator');
  assert.equal(view.pressBack(),false);
  open(tree);tree=view.render();edit(tree,'Adama');tree=view.render();
  assert.equal(view.backHandlerCount(),1,'focused search drawer owns Back');
  assert.equal(view.pressBack(),true,'Back is consumed instead of exiting the activity');
  tree=view.render();assert.equal(find(tree,node=>node.type==='ResultsDrawer'),undefined);
  assert.equal(view.backHandlerCount(),0,'closing the drawer removes the native subscription');
  view.clock.advance(500);tree=view.render();assert.equal(view.requests.length,0,'dismissal cancels the pending search');
  assert.equal(view.pressBack(),false,'Back returns to the navigator after dismissal');
  open(tree);tree=view.render();submit(tree);tree=view.render();assert.equal(view.requests.length,1);
  assert.equal(view.pressBack(),true);tree=view.render();
  view.requests[0].resolve(payload('Late match'));await settle();tree=view.render();
  open(tree);tree=view.render();assert.equal(results(tree)?.props.result||null,null,'late responses cannot restore a dismissed search');
 }finally{view.close();assert.equal(view.backHandlerCount(),0,'unmount removes any remaining Back listener');}
});

test('unfocused Capacity never consumes Android Back and remounting focus restores one listener',async()=>{
 const view=harness();try{
  let tree=view.render();await settle();tree=view.render();open(tree);tree=view.render();
  assert.equal(view.backHandlerCount(),1);
  view.blur();tree=view.render();assert.equal(view.backHandlerCount(),0,'blur removes the Back listener even while the drawer state is retained');
  assert.equal(view.pressBack(),false);
  view.focus();tree=view.render();assert.equal(view.backHandlerCount(),1,'focus reinstalls exactly one listener');
 }finally{view.close();assert.equal(view.backHandlerCount(),0,'unmount removes the focused listener');}
});

test('inline clear and drawer close cancel pending work without changing truck state',async()=>{
 const view=harness();try{
  let tree=view.render();await settle();tree=view.render();open(tree);tree=view.render();const original=map(tree);
  edit(tree,'Active');tree=view.render();submit(tree);tree=view.render();edit(tree,'Queued');tree=view.render();view.clock.advance(500);tree=view.render();
  const clear=find(tree,node=>node.type==='Pressable'&&node.props.accessibilityLabel==='Clear search');assert.ok(clear);assert.ok(clear.props.style.minHeight>=44&&clear.props.style.minWidth>=44);clear.props.onPress();tree=view.render();assert.equal(input(tree).props.value,'');assert.equal(results(tree),undefined);assert.equal(view.requests[0].signal.aborted,false,'clear discards interest while issued work remains bounded');view.clock.advance(500);tree=view.render();assert.equal(view.requests.length,1);assert.equal(map(tree).key,original.key);assert.equal(map(tree).props.items,original.props.items);assert.equal(view.mapLoads.length,1);
  edit(tree,'Closed');tree=view.render();find(tree,node=>node.type==='ResultsDrawer').props.onClose();tree=view.render();view.clock.advance(500);tree=view.render();assert.equal(view.requests.length,1);open(tree);tree=view.render();view.clock.advance(500);tree=view.render();assert.equal(view.requests.length,1,'reopening cannot overlap the already issued request');view.requests[0].resolve(payload('Cleared match'));await settle();tree=view.render();assert.equal(view.requests.length,2);assert.equal(new URL(view.requests[1].path,'http://local.test').searchParams.get('q'),'Closed');assert.equal(results(tree).props.result,null);
 }finally{view.close();}
});

test('submit uses the newest input event and access loss or unmount aborts cleanup',async()=>{
 const view=harness({mode:'private'});try{
  let tree=view.render();await settle();tree=view.render();open(tree);tree=view.render();edit(tree,'Latest event');input(tree).props.onSubmitEditing();tree=view.render();assert.equal(new URL(view.requests[0].path,'http://local.test').searchParams.get('q'),'Latest event');view.clock.advance(500);tree=view.render();assert.equal(view.requests.length,1,'an immediate submit consumes even an input effect that has not mounted yet');
  view.visitor.snapshot.capacity=null;tree=view.render();assert.equal(view.requests[0].signal.aborted,true);await settle();tree=view.render();assert.equal(results(tree),undefined);view.clock.advance(500);assert.equal(view.requests.length,1);
 }finally{view.close();}
 const unmounted=harness();let tree=unmounted.render();await settle();tree=unmounted.render();open(tree);tree=unmounted.render();edit(tree,'Pending');tree=unmounted.render();submit(tree);tree=unmounted.render();unmounted.close();assert.equal(unmounted.requests[0].signal.aborted,true);await settle();unmounted.clock.advance(500);assert.equal(unmounted.requests.length,1);
});

test('private search remains behind its session and timeout is bounded and retryable',async()=>{
 const denied=harness({mode:'private',verified:false});try{const tree=denied.render();assert.equal(find(tree,node=>node.type==='ResultsDrawer'),undefined);denied.clock.advance(500);assert.equal(denied.requests.length,0);assert.equal(denied.mapLoads.length,0);}finally{denied.close();}
 const view=harness({mode:'private'});try{
  let tree=view.render();await settle();tree=view.render();open(tree);tree=view.render();edit(tree,'Adama');tree=view.render();submit(tree);tree=view.render();const request=view.requests[0];assert.equal(request.scope,'capacity');assert.ok(request.path.startsWith('/api/mobile/visitor/capacity/search?'));
  view.clock.advance(searchContract.TRANSPORTER_SEARCH_TIMEOUT_MS-1);assert.equal(request.signal.aborted,false);view.clock.advance(1);await settle();tree=view.render();assert.equal(request.signal.aborted,true);assert.equal(results(tree).props.loading,false);assert.ok(results(tree).props.error);results(tree).props.onRetry();tree=view.render();assert.equal(view.requests.length,2);assert.equal(view.requests[1].path,request.path);
  view.requests[1].resolve({items:[]});await settle();tree=view.render();assert.ok(results(tree).props.error,'malformed responses remain retryable');results(tree).props.onRetry();tree=view.render();view.requests[2].resolve(payload('Authorized match'));await settle();tree=view.render();assert.equal(results(tree).props.result.items[0].title,'Authorized match');assert.equal(view.mapLoads.length,1);
 }finally{view.close();}
});
