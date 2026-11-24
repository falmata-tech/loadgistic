import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as discovery from '../src/api/discovery.ts';
import {capacityIntroduction} from '../../../src/lib/platform-copy.js';
import * as transporterSearch from '../../../src/lib/transporter-search.js';
import * as capacityRefresh from '../src/map/capacity-refresh.ts';
import * as navigation from '../src/navigation/destinations.ts';
import {createTrackingSessionController} from '../src/session/tracking-session-controller.ts';
import * as refreshPolicy from '../../../src/lib/tracking-refresh-policy.js';

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

const trackingId='16000000-0000-4000-8000-000000000001',shipmentId='16000000-0000-4000-8000-000000000002',linkToken='a'.repeat(43);
const trackingView=()=>({id:trackingId,reference:'Synthetic load',state:'CONNECTED',revision:0,workspaceId:null,shipmentId,route:[{placeRef:'A',label:'A',coordinate:[38,9]},{placeRef:'B',label:'B',coordinate:[39,10]}],cargoSummary:'Synthetic cargo',pickupDate:'',deliveryDate:'',capabilities:{canIssueLink:false,canRevokeLink:false,canAcceptProvider:false},links:[],tracking:{shipmentId,code:'Reference',status:'IN_TRANSIT',updatedAt:'',trackingMode:'STATUS_ONLY',location:null,events:[]}});
function trackingEntry(token){
 const render=renderer(),requests=[];let failure=false;
 const port={now:()=>1800000000000,changed(){},request:async(path,options)=>{requests.push({path,options});if(failure)throw Object.assign(Error('Synthetic denied'),{status:401});return path==='/api/tracking/access'&&options?.body?{ok:true,data:{session:trackingView(),grant:'private.grant',expiresAt:new Date(1800000300000).toISOString()}}:{ok:true,data:trackingView()};}};
 const controller=createTrackingSessionController(port);
 const screen=render.compile('../src/screens/visitor-tracking.tsx',{
  'react-native':native,'expo-router':{useLocalSearchParams:()=>({linkToken:token})},'../session/tracking-session-provider':{useTrackingSession:()=>({controller,snapshot:controller.snapshot()})},'../localization/provider':language,
  '../components/ui':ui,'../api/tracking':{statusLabel:value=>value},'../components/tracking-workspace':{TrackingWorkspace:'TrackingWorkspace'},'../components/tracking-map':{TrackingMap:'TrackingMap'},
  '../components/map-platform':{Map:'Map',Camera:'Camera'},'../components/map-style':{mapStyle:{}},'../../../../src/lib/tracking-refresh-policy.js':refreshPolicy
 });
 return{controller,requests,port,queries:()=>requests.filter(request=>request.path.startsWith('/api/tracking/sessions/')).length,fail:()=>{failure=true;},recover:()=>{failure=false;},render:()=>render.render(screen.default)};
}

test('public Track offers Tracking ID and code over an empty basemap',()=>{
 const entry=trackingEntry(),tree=entry.render(),map=find(tree,item=>item.type==='Map');
 assert.ok(map,'entry must display the basemap before authorization');assert.equal(map.props.attribution,true);
 const mapHost=nodes(tree).find(({node})=>node===map).ancestors.at(-1);
 assert.deepEqual(style(mapHost),{position:'absolute',top:0,left:0,right:0,bottom:0});
 assert.equal(find(tree,item=>item.type==='Field'&&item.props.message==='Tracking link'),undefined);
 assert.ok(find(tree,item=>item.type==='Field'&&item.props.message==='Tracking ID'));
 assert.ok(find(tree,item=>item.type==='Field'&&item.props.message==='Tracking code'));
 assert.ok(find(tree,item=>item.type==='Button'&&item.props.message==='Sign in to view your shipments'));
 assert.equal(find(tree,item=>item.type==='Field'&&item.props.message==='Your email'),undefined);
 assert.equal(nodes(map).filter(({node})=>node.type==='Marker'||node.type==='GeoJSONSource').length,0);
 assert.equal(entry.queries(),0);assert.equal(entry.requests.length,0);
 const scroll=find(tree,item=>item.type==='ScrollView');assert.equal(scroll.props.keyboardShouldPersistTaps,'handled');
 assert.equal(scroll.props.pointerEvents,'box-none');assert.equal(style(scroll).flexGrow,0);
});

test('both credentials and retry remain usable over the empty map without an email or private list request',async()=>{
 const entry=trackingEntry(linkToken);let tree=entry.render();
 assert.equal(find(tree,item=>item.type==='Field'&&item.props.message==='Tracking ID'),undefined);
 find(tree,item=>item.type==='Field'&&item.props.message==='Tracking code').props.onChangeText('ABCD-EF23');entry.fail();
 tree=entry.render();find(tree,item=>item.type==='Button'&&item.props.message==='Open tracking').props.onPress();await settle();
 assert.deepEqual(entry.requests[0],{path:'/api/tracking/access',options:{body:{linkToken,code:'ABCDEF23'}}});
 tree=entry.render();assert.ok(find(tree,item=>item.type==='Map'));assert.ok(find(tree,item=>item.type==='ErrorText'&&item.props.message==='This Tracking link or code is unavailable. Check both and try again.'));assert.equal(entry.queries(),0);
 assert.equal(find(tree,item=>item.type==='Field'&&item.props.message==='Tracking code').props.value,'ABCD-EF23');
 assert.equal(find(tree,item=>item.type==='Button'&&item.props.message==='Open tracking').props.busy,false);
 entry.recover();find(tree,item=>item.type==='Button'&&item.props.message==='Open tracking').props.onPress();await settle();tree=entry.render();
 assert.ok(find(tree,item=>item.type==='TrackingWorkspace'));assert.equal(find(tree,item=>item.type==='Map'),undefined);
 assert.equal(entry.queries(),0,'unlock returns one authorized session rather than mounting an email shipment list');
 assert.equal(entry.requests.length,2);assert.ok(entry.requests.every(request=>request.path==='/api/tracking/access'));
});

test('checking an exact-session resume and background pause retain the neutral map without private markers',async()=>{
 const entry=trackingEntry();await entry.controller.open(linkToken,'ABCD-EF23');entry.controller.setForeground(false);
 let tree=entry.render();assert.ok(find(tree,item=>item.type==='Map'));assert.equal(find(tree,item=>item.type==='TrackingWorkspace'),undefined);
 assert.ok(find(tree,item=>item.type==='Copy'&&item.props.message==='Private access is paused while the app is in the background.'));
 assert.equal(entry.queries(),0);
 let resolve;entry.port.request=async(path,options)=>{entry.requests.push({path,options});return new Promise(done=>resolve=done);};entry.controller.setForeground(true);tree=entry.render();
 assert.ok(find(tree,item=>item.type==='Map'));assert.ok(find(tree,item=>item.type==='LoadingSpinner'));assert.equal(find(tree,item=>item.type==='TrackingWorkspace'),undefined);
 assert.equal(entry.queries(),1);assert.equal(entry.requests.at(-1).path,`/api/tracking/sessions/${trackingId}`);assert.equal(entry.requests.at(-1).options.trackingGrant,'private.grant');
 assert.equal(nodes(tree).filter(({node})=>node.type==='Marker'||node.type==='GeoJSONSource').length,0);
 resolve({ok:true,data:trackingView()});await settle();assert.ok(find(entry.render(),item=>item.type==='TrackingWorkspace'));
});

function capacityScreen(){
 const render=renderer(),visitor={ready:true,snapshot:{foreground:true,capacity:null},controller:{touch:async()=>{},request:async()=>{},clear:async()=>{}}};
 const screen=render.compile('../src/screens/capacity.tsx',{
  'react-native':{...native,Keyboard:{dismiss(){}}},'expo-router':{Link:'Link',useLocalSearchParams:()=>({}),useFocusEffect:()=>{}},
  '../session/chat-alert-provider':{useChatUpdates:()=>({transportUnreadCount:2})},'../hooks/content-blocks':{useBlockedProviders:()=>({blocked:[]})},
  '../localization/provider':language,'../session/visitor-provider':{useVisitor:()=>visitor},'../session/provider':{useAccount:()=>({session:null,busy:false})},'../components/visitor-access':{VisitorAccess:'VisitorAccess'},
  '../components/app-link':{AppLink:'AppLink'},'../components/app-icon':{AppIcon:'AppIcon'},'../components/CapacityMap':{__esModule:true,default:'CapacityMap'},'../api/http':{apiOrigin:'http://127.0.0.1',apiRequest:async()=>{}},
  '../api/discovery':discovery,'../components/discovery-filters':{DiscoveryFilters:'DiscoveryFilters'},'../components/results-drawer':{ResultsDrawer:'ResultsDrawer'},
  '../../../../src/lib/vehicle-configurations':{VEHICLE_CONFIGURATIONS:[]},'../components/discovery-results':{DiscoveryResults:'DiscoveryResults'},
  '../components/loading-bar':{LoadingBar:'LoadingBar'},'../../../../src/lib/platform-copy.js':{capacityIntroduction},
  '../api/public-capacity':{loadCapacity:async()=>{},loadSharedCapacity:async()=>{}},'../../../../src/lib/transporter-search.js':transporterSearch,
  '../map/capacity-refresh':capacityRefresh,
  '../navigation/destinations':navigation,
  '../api/business-workspaces':{loadBusinessCapacity:()=>{throw Error('business-only loader used by public Capacity');}},'../api/response':{ApiError:class ApiError extends Error{}},'../hooks/foreground-refresh':{useForegroundRefresh:()=>{}},'../hooks/account-query':{useAccountQuery:()=>({data:null})},
  '../components/ui':ui
 });
 return{render:()=>render.render(screen.default)};
}

test('Capacity keeps the map full height with search and vehicle filters after transport chat retirement',()=>{
 const capacity=capacityScreen();let tree=capacity.render();
 const heading=nodes(tree).find(({node})=>node.type==='Text'&&node.props.children===capacityIntroduction.title);
 assert.ok(heading,'one brief heading identifies the capacity task');
 assert.equal(heading.node.props.accessibilityRole,'header');
 const intro=heading.ancestors.at(-1);
 assert.equal(nodes(intro).filter(({node})=>node.type==='Text').length,1,'welcome prose does not take space above the mobile map');
 const tabs=nodes(tree).filter(({node})=>node.props.accessibilityRole==='tab');
 assert.equal(tabs.length,2);
 for(const {node} of tabs)assert.ok(style(node).minHeight>=44,'map choices keep a useful touch target');
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
