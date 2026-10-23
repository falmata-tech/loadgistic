import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as discovery from '../src/api/discovery.ts';
import {capacityIntroduction} from '../../../src/lib/platform-copy.js';
import * as transporterSearch from '../../../src/lib/transporter-search.js';

// Execute the real screens and verification handlers with native hosts substituted.
// These are layout/auth-boundary component checks, not backend or pixel-rendering evidence.
function renderer(){
 const stores=new Map();let current=[],cursor=0;
 const hooks={
  useState:initial=>{const slots=current,index=cursor++;if(!(index in slots))slots[index]=typeof initial==='function'?initial():initial;return[slots[index],value=>{slots[index]=typeof value==='function'?value(slots[index]):value;}];},
  useRef:initial=>{const index=cursor++;if(!(index in current))current[index]={current:initial};return current[index];},
  useMemo:factory=>factory(),useCallback:fn=>fn,useEffect:()=>{}
 };
 const node=(type,props,key)=>({type,props:props||{},key:key??null});
 function compile(path,dependencies,extra=''){
  const source=readFileSync(new URL(path,import.meta.url),'utf8');
  const compiled=ts.transpileModule(`${source}\n${extra}`,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const imports={react:hooks,'react/jsx-runtime':{jsx:node,jsxs:node},...dependencies},exports={};
  new Function('require','exports',compiled)(name=>{assert.ok(name in imports,`unexpected dependency ${name}`);return imports[name];},exports);
  return exports;
 }
 function resolve(tree,path='root'){
  if(Array.isArray(tree))return tree.map((child,index)=>resolve(child,`${path}/${index}`));
  if(!tree||typeof tree!=='object')return tree;
  if(typeof tree.type==='function'){
   const key=`${path}:${tree.type.name}:${tree.key||''}`;
   if(!stores.has(key))stores.set(key,[]);current=stores.get(key);cursor=0;
   return resolve(tree.type(tree.props),`${path}/component`);
  }
  return {...tree,props:{...tree.props,children:resolve(tree.props.children,`${path}/children`)}};
 }
 return{compile,render:Component=>resolve(node(Component,{}))};
}
function nodes(tree,ancestors=[]){
 if(Array.isArray(tree))return tree.flatMap(child=>nodes(child,ancestors));
 if(!tree||typeof tree!=='object')return[];
 return[{node:tree,ancestors},...nodes(tree.props.children,[...ancestors,tree])];
}
const find=(tree,predicate)=>nodes(tree).find(({node})=>predicate(node))?.node;
const style=node=>Object.assign({},...[node.props.style].flat().filter(Boolean));
const language={useLanguage:()=>({t:message=>message})};
const ui=Object.fromEntries(['Page','Title','Copy','Card','Button','ErrorText','Field','LoadingSpinner'].map(name=>[name,name]));
ui.palette={blue:'#155eef',blueSoft:'#eaf1ff',success:'#155eef',successSoft:'#eaf1ff',muted:'#526375',borderSoft:'#e5eaf1',canvas:'#f3f5f7'};
const native=Object.fromEntries(['ActivityIndicator','View','Text','ScrollView','Pressable','TextInput','Image'].map(name=>[name,name]));
native.StyleSheet={create:value=>value,absoluteFill:{position:'absolute',top:0,left:0,right:0,bottom:0}};
const settle=async()=>{for(let index=0;index<5;index++)await Promise.resolve();};

function trackingEntry(){
 const render=renderer(),requests=[];let queries=0,verifyError='';
 const visitor={ready:true,snapshot:{foreground:true,tracking:null},errors:{},error:'',controller:{
  verify:async(scope,handoff,code)=>{requests.push({scope,handoff,code});if(verifyError)throw new Error(verifyError);visitor.snapshot.tracking={startedAt:1};},
  clear:async()=>{visitor.snapshot.tracking=null;},touch:async()=>{}
 }};
 const shared={'react-native':native,'../session/visitor-provider':{useVisitor:()=>visitor},'../localization/provider':language};
 const access=render.compile('../src/components/visitor-access.tsx',{
  ...shared,'../api/http':{apiRequest:async(path,options)=>{requests.push({path,body:options.body});return{handoff:'synthetic-handoff',message:'Synthetic code sent',verificationRequired:true};}},
  './ui':ui,'../session/provider':{useAccount:()=>({session:null})}
 });
 const screen=render.compile('../src/screens/visitor-tracking.tsx',{
  ...shared,'../components/app-link':{AppLink:'AppLink'},'../components/visitor-access':access,'../components/ui':ui,
  '../hooks/visitor-query':{useVisitorQuery:()=>{assert.ok(visitor.snapshot.tracking,'private query must remain behind verification');queries++;return{data:{items:[],pageCount:1},loading:false,error:'',reload:async()=>{}};}},
  '../api/tracking':{statusLabel:value=>value},'../api/runtime-content':{parseTrackingPage:value=>value},
  '../components/map-platform':{Map:'Map',Camera:'Camera'},'../components/map-style':{mapStyle:{}}
 });
 return{visitor,requests,queries:()=>queries,failVerification:message=>{verifyError=message;},render:()=>render.render(screen.default)};
}

test('unverified Tracking has a full empty basemap behind its existing verification form',()=>{
 const entry=trackingEntry(),tree=entry.render(),map=find(tree,item=>item.type==='Map');
 assert.ok(map,'entry must display the basemap before verification');assert.equal(map.props.attribution,true);
 const mapHost=nodes(tree).find(({node})=>node===map).ancestors.at(-1);
 assert.deepEqual(style(mapHost),{position:'absolute',top:0,left:0,right:0,bottom:0});
 assert.ok(find(tree,item=>item.type==='Field'&&item.props.message==='Your email'));
 assert.ok(find(tree,item=>item.type==='Button'&&item.props.message==='Send email code'));
 assert.equal(nodes(map).filter(({node})=>node.type==='Marker'||node.type==='GeoJSONSource').length,0);
 assert.equal(entry.queries(),0);assert.equal(entry.requests.length,0);
 const scroll=find(tree,item=>item.type==='ScrollView');assert.equal(scroll.props.keyboardShouldPersistTaps,'handled');
 assert.equal(scroll.props.pointerEvents,'box-none');assert.equal(style(scroll).flexGrow,0);
});

test('OTP errors and resend remain usable over the empty map without private reads',async()=>{
 const entry=trackingEntry();let tree=entry.render();
 find(tree,item=>item.type==='Field'&&item.props.message==='Your email').props.onChangeText(' synthetic@example.test ');
 tree=entry.render();find(tree,item=>item.type==='Button'&&item.props.message==='Send email code').props.onPress();await settle();
 assert.deepEqual(entry.requests[0],{path:'/api/mobile/visitor/tracking/request',body:{email:'synthetic@example.test'}});
 tree=entry.render();const code=find(tree,item=>item.type==='Field'&&item.props.message==='Email verification code');
 assert.equal(code.props.autoComplete,'one-time-code');code.props.onChangeText('000000');entry.failVerification('Synthetic invalid code');
 tree=entry.render();find(tree,item=>item.type==='Button'&&item.props.message==='Open private access').props.onPress();await settle();
 tree=entry.render();assert.ok(find(tree,item=>item.type==='Map'));
 assert.ok(find(tree,item=>item.type==='ErrorText'&&item.props.message==='Synthetic invalid code'));assert.equal(entry.queries(),0);
 find(tree,item=>item.type==='Button'&&item.props.message==='Use another email or resend').props.onPress();
 tree=entry.render();assert.ok(find(tree,item=>item.type==='Field'&&item.props.message==='Your email'));
 assert.equal(find(tree,item=>item.type==='Field'&&item.props.message==='Email verification code'),undefined);
 entry.visitor.snapshot.tracking={startedAt:1};tree=entry.render();
 assert.ok(find(tree,item=>item.type==='Page'));assert.equal(find(tree,item=>item.type==='Map'),undefined);
 assert.equal(entry.queries(),1,'authorized list mounts only after the normal grant exists');
});

test('Checking access and background pause keep the empty map and do not query shipments',()=>{
 const entry=trackingEntry();entry.visitor.ready=false;
 assert.ok(find(entry.render(),item=>item.type==='Map'));assert.equal(entry.queries(),0);
 entry.visitor.ready=true;entry.visitor.snapshot.foreground=false;
 const tree=entry.render();assert.ok(find(tree,item=>item.type==='Map'));
 assert.ok(find(tree,item=>item.type==='Copy'&&item.props.message==='Private access is paused while the app is in the background.'));
 assert.equal(entry.queries(),0);
});

function capacityScreen(){
 const render=renderer(),visitor={ready:true,snapshot:{foreground:true,capacity:null},controller:{touch:async()=>{},request:async()=>{},clear:async()=>{}}};
 const screen=render.compile('../src/screens/capacity.tsx',{
  'react-native':{...native,Keyboard:{dismiss(){}}},'expo-router':{Link:'Link',useLocalSearchParams:()=>({}),useFocusEffect:()=>{}},
  '../session/chat-alert-provider':{useChatUpdates:()=>({transportUnreadCount:2})},'../hooks/content-blocks':{useBlockedProviders:()=>({blocked:[]})},
  '../localization/provider':language,'../session/visitor-provider':{useVisitor:()=>visitor},'../components/visitor-access':{VisitorAccess:'VisitorAccess'},
  '../components/app-icon':{AppIcon:'AppIcon'},'../components/CapacityMap':{__esModule:true,default:'CapacityMap'},'../api/http':{apiOrigin:'http://127.0.0.1',apiRequest:async()=>{}},
  '../api/discovery':discovery,'../components/discovery-filters':{DiscoveryFilters:'DiscoveryFilters'},'../components/results-drawer':{ResultsDrawer:'ResultsDrawer'},
  '../../../../src/lib/vehicle-configurations':{VEHICLE_CONFIGURATIONS:[]},'../components/discovery-results':{DiscoveryResults:'DiscoveryResults'},
  '../components/loading-bar':{LoadingBar:'LoadingBar'},'../../../../src/lib/platform-copy.js':{capacityIntroduction},
  '../api/public-capacity':{loadCapacity:async()=>{},loadSharedCapacity:async()=>{}},'../../../../src/lib/transporter-search.js':transporterSearch,
  '../api/business-workspaces':{loadBusinessCapacity:()=>{throw Error('business-only loader used by public Capacity');}},'../api/response':{ApiError:class ApiError extends Error{}},'../hooks/foreground-refresh':{useForegroundRefresh:()=>{}},
  '../components/ui':ui
 });
 return{render:()=>render.render(screen.default)};
}

test('Capacity keeps the map full height with search and vehicle filters after transport chat retirement',()=>{
 const capacity=capacityScreen();let tree=capacity.render();
 const workspace=find(tree,item=>item.props.testID==='capacity-map-workspace');
 assert.ok(workspace);assert.equal(style(workspace).flex,1);
 assert.equal(nodes(tree).some(({node})=>node.props.href==='/arrange-transport'||node.props.accessibilityLabel==='Need help with transport?'),false);
 const map=find(tree,item=>item.type==='CapacityMap');
 assert.ok(map,'the map remains mounted behind its floating controls');
 assert.equal(map.props.bottomInset,20,'signal controls reserve only their normal bottom offset');
 assert.ok(find(tree,item=>item.type==='Pressable'&&item.props.accessibilityLabel==='Vehicle filters'&&nodes(item).some(({node})=>node.type==='Text'&&String(node.props.children).startsWith('Filter'))));
 const search=find(tree,item=>item.type==='Pressable'&&item.props.accessibilityLabel==='Search transporters'&&nodes(item).some(({node})=>node.type==='Text'&&String(node.props.children).startsWith('Search')));
 search.props.onPress();tree=capacity.render();
 assert.equal(find(tree,item=>item.type==='ResultsDrawer').props.bottom,20,'results scrolling uses the map bottom inset');
 assert.equal(style(find(tree,item=>item.props.testID==='capacity-map-workspace')).flex,1);
});

test('the actual results drawer accepts a bottom inset while preserving its default',()=>{
 const render=renderer();
 const drawer=render.compile('../src/components/results-drawer.tsx',{
  'react-native':{...native,Animated:{View:'AnimatedView',Value:class{constructor(value){this.value=value;}},timing:()=>({start(){},stop(){}})}},
  './ui':{palette:{border:'#cbd5e1',ink:'#0b1d3a'}},'../components/ui':{palette:{blue:'#155eef',blueSoft:'#eaf1ff',success:'#155eef',successSoft:'#eaf1ff',muted:'#526375',borderSoft:'#e5eaf1',canvas:'#f3f5f7'}},'./app-icon':{AppIcon:'AppIcon'},'../localization/provider':language
 });
 const configured=()=>drawer.ResultsDrawer({bottom:112,onClose(){}});
 const regular=()=>drawer.ResultsDrawer({onClose(){}});
 assert.equal(style(find(render.render(configured),item=>item.type==='AnimatedView')).bottom,112);
 assert.equal(style(find(render.render(regular),item=>item.type==='AnimatedView')).bottom,12);
 const tree=render.render(regular),close=find(tree,item=>item.type==='Pressable'&&item.props.accessibilityLabel==='Close transporter search');
 assert.ok(find(tree,item=>item.type==='Text'&&item.props.children==='Transporter search'));
 assert.ok(style(close).minHeight>=44&&style(close).minWidth>=44);
 let closing=0,closed=0;
 const dismissing=()=>drawer.ResultsDrawer({onClosing:()=>closing++,onClose:()=>closed++});
 find(render.render(dismissing),item=>item.type==='Pressable').props.onPress();
 assert.equal(closing,1,'pending search must be invalidated when closing starts');
 assert.equal(closed,0,'existing exit animation can still finish before unmount');
});
