import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as searchContract from '../src/lib/transporter-search.js';
import * as filterPresentation from '../src/lib/capacity-filter-presentation.ts';
const {CAPACITY_FILTER_PRESENTATION}=filterPresentation;

const nodes=tree=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];
const find=(tree,type,predicate=()=>true)=>nodes(tree).find(node=>node.type===type&&predicate(node));
const text=tree=>tree==null||typeof tree==='boolean'?'':typeof tree==='string'||typeof tree==='number'?String(tree):Array.isArray(tree)?tree.map(text).join(' '):tree.type==='Text'?tree.props.message:text(tree.props?.children);
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const settle=async()=>{for(let index=0;index<8;index++)await Promise.resolve();};

function harness(name){
 const states=[],refs=[],effects=[],memos=[];let stateIndex,refIndex,effectIndex,memoIndex,dirty=false,now=0,nextTimer=0;
 const timers=new Map(),requests=[];
 const clock={setTimeout(callback,delay){const id=++nextTimer;timers.set(id,{callback,at:now+delay});return id;},clearTimeout:id=>timers.delete(id),advance(delta){const end=now+delta;for(;;){const next=[...timers].filter(([,timer])=>timer.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].callback();}now=end;}};
 const react={
  useState(initial){const index=stateIndex++;if(!(index in states))states[index]=typeof initial==='function'?initial():initial;return [states[index],value=>{const next=typeof value==='function'?value(states[index]):value;if(!Object.is(next,states[index])){states[index]=next;dirty=true;}}];},
  useRef(initial){const index=refIndex++;return refs[index]||(refs[index]={current:initial});},useMemo(callback,deps){const index=memoIndex++,previous=memos[index];if(!previous||deps.some((value,position)=>!Object.is(value,previous.deps[position])))memos[index]={deps,value:callback()};return memos[index].value;},useCallback:callback=>callback,
  useEffect(create,deps){const index=effectIndex++,previous=effects[index];if(!previous||deps.some((value,position)=>!Object.is(value,previous.deps[position])))effects[index]={deps,create,cleanup:previous?.cleanup,pending:true};}
 };
 const node=(type,props,key)=>({type,props:props||{},key}),simple=new Proxy({},{get:(_target,key)=>key});
 const imports={react:{__esModule:true,default:react},'react/jsx-runtime':{jsx:node,jsxs:node,Fragment:'Fragment'},'next/link':{__esModule:true,default:'Link'},'next/form':{__esModule:true,default:'form'},'lucide-react':simple,
  '@/components/localization':{Text:'Text',Localized:'Localized'},'./localization':{Text:'Text',Localized:'Localized'},'./content-safety':{useBlockedProviders:()=>({blocked:[]})},
  '@/lib/transporter-search.js':searchContract,'@/lib/capacity-filter-presentation':filterPresentation,'./transporter-search.module.css':{__esModule:true,default:simple},
  '@/lib/capacity-map-loading.js':{loadCapacityMapWindow:()=>{throw Error('Unexpected map fetch');},reconcileCapacityMapWindow:()=>{throw Error('Unexpected map reconciliation');}},
  '@/lib/location-privacy.js':{BUSINESS_SEARCH_PRIVACY_KM:20,obscureCoordinate:()=>{throw Error('Unexpected location');},isValidCoordinate:()=>true},
  './capacity-configuration-picker':{CapacityConfigurationPicker:'Configuration'},'./capacity-multi-options':{CapacityMultiOptions:'Options'},'./ethiopia-place-input':{EthiopiaPlaceInput:'Place'},
  './public-capacity-map':{PublicCapacityMap:'Map'},'./map-truck-details':{MapTruckDetails:'Details'},'./loading-state':{LoadingIndicator:'Loading'},
  './capacity-search-results':{CapacitySearchResults:'Results',CapacityDocumentFilters:'Documents'}
 };
 const source=readFileSync(new URL(`../src/components/${name}.tsx`,import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const browser={setTimeout:clock.setTimeout,setInterval:()=>0,clearInterval(){},isSecureContext:true};
 const document={visibilityState:'visible',addEventListener(){},removeEventListener(){}};
 const exports={};new Function('require','exports','window','document',compiled)(key=>{assert.ok(key in imports,'Unexpected dependency '+key);return imports[key];},exports,browser,document);
 let props,tree,childKey,hasChild=false;
 const render=value=>{props=value||props;for(let pass=0;pass<10;pass++){
  dirty=false;stateIndex=refIndex=effectIndex=memoIndex=0;tree=name==='public-capacity-feed'?exports.PublicCapacityFeed(props):exports.CapacitySearchResults(props);
  if(name==='public-capacity-feed'){
   if(tree.type==='Results')tree=tree.props.render({...tree,props:{...tree.props,render:undefined}});
   if(hasChild&&childKey!==tree.key){states.splice(stateIndex);refs.splice(refIndex);memos.splice(memoIndex);for(const effect of effects.splice(effectIndex))effect.cleanup?.();}
   childKey=tree.key;hasChild=true;tree=tree.type(tree.props);
  }
  for(const effect of effects)if(effect.pending){effect.pending=false;effect.cleanup?.();effect.cleanup=effect.create();}if(!dirty)return tree;
 }throw Error('Unsettled component');};
 const previous={setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout,fetch:globalThis.fetch,requestAnimationFrame:globalThis.requestAnimationFrame};
 globalThis.setTimeout=clock.setTimeout;globalThis.clearTimeout=clock.clearTimeout;globalThis.requestAnimationFrame=callback=>callback();
 globalThis.fetch=(url,options)=>{const pending=deferred();requests.push({url,signal:options.signal,...pending});return pending.promise;};
 return {render,clock,requests,close(){for(const effect of effects)effect.cleanup?.();Object.assign(globalThis,previous);}};
}
const feedProps={initial:{items:[{id:'truck-1',provider_handle:'chosen'}],hasMore:false,nextCursor:null,pageSize:200},query:{status:'EMPTY',provider:'chosen',truck:'truck-1'}};
const input=tree=>find(tree,'Localized',node=>node.props.id==='capacity-market-search');
const form=tree=>find(tree,'form',node=>String(node.props.className).includes('capacity-people-search-form'));
const open=tree=>find(tree,'Localized',node=>node.props['aria-controls']==='capacity-filter-drawer').props.onClick();
const edit=(tree,value)=>input(tree).props.onChange({target:{value},currentTarget:{value}});
const submit=tree=>form(tree).props.onSubmit({preventDefault(){}});
const results=tree=>{const result=find(tree,'Results');return result?.props.active===false?undefined:result;};
const payload=title=>({items:[{kind:'COMPANY',key:title,title,handle:'provider',matching_trucks:2}],total:16,hasMore:true});

test('provider cards lead with chosen account identity without legacy category styling or private names',async()=>{
 const view=harness('capacity-search-results');try{
  let tree=view.render({query:{q:'Meron'},view:'open',searchPath:'/'});
  view.requests[0].resolve({ok:true,json:async()=>({items:[{key:'provider',kind:'OWNER_OPERATOR',accountName:'Blue Road',managerName:'Meron',title:'Legacy first name',handle:'blue-road',matching_trucks:1,owner:'PRIVATE-FATHER-NAME',city:'Adama'}],total:1,hasMore:false})});await settle();tree=view.render();
  assert.equal(text(find(tree,'h3')),'Blue Road');assert.equal(text(find(tree,'span',node=>node.props.className==='capacity-result-identifier')).replace(/\s+/g,''),'@blue-road');assert.ok(text(tree).includes('Account manager'));assert.ok(text(tree).includes('Meron'));assert.ok(!text(tree).includes('PRIVATE-FATHER-NAME'));
  const card=find(tree,'article');assert.equal(card.props.className,'capacity-result-card');assert.ok(!text(tree).includes('Owner-operator'));assert.ok(text(tree).includes('Transport Provider'));
  assert.ok(text(card).includes('{count} vehicles'));assert.ok(!text(card).includes('{count} matching vehicles'));
 }finally{view.close();}
});

test('provider result links the account and all matching vehicles without a driver-only card',async()=>{
 const view=harness('capacity-search-results');try{
  let tree=view.render({query:{q:'Blue Road'},view:'open',searchPath:'/'});
  view.requests[0].resolve({ok:true,json:async()=>({items:[{key:'provider',kind:'COMPANY',accountName:'Blue Road',managerName:'Meron',title:'Blue Road',handle:'blue-road',capacity_id:null,matching_trucks:2}],total:1,hasMore:false})});await settle();tree=view.render();
  assert.equal(text(find(tree,'h3')),'Blue Road');assert.ok(text(tree).includes('Transport Provider'));assert.ok(!text(tree).includes('Dawit'));
  const map=new URL(find(tree,'Link',node=>text(node).includes('Show vehicles on map')).props.href,'http://localhost');assert.equal(map.searchParams.get('provider'),'blue-road');assert.equal(map.searchParams.has('truck'),false);
  assert.equal(find(tree,'Link',node=>text(node)==='Profile').props.href,'/@blue-road');
 }finally{view.close();}
});

test('drawer-only Unicode minimum and 500ms typing pause coalesce into one current search',()=>{
 const view=harness('public-capacity-feed');try{
  let tree=view.render({...feedProps,query:{...feedProps.query,q:'Saved draft'}});view.clock.advance(500);tree=view.render();assert.equal(results(tree),undefined);
  open(tree);tree=view.render();edit(tree,'😀');tree=view.render();view.clock.advance(500);tree=view.render();assert.equal(results(tree),undefined);
  assert.ok(text(tree).includes('Enter at least two characters.'));
  edit(tree,'  Ab  ');tree=view.render();view.clock.advance(499);tree=view.render();assert.equal(results(tree),undefined);
  edit(tree,'  Addis  ');tree=view.render();view.clock.advance(499);tree=view.render();assert.equal(results(tree),undefined);
  view.clock.advance(1);tree=view.render();assert.deepEqual(results(tree).props.query,{q:'Addis'});
  assert.equal(find(tree,'Localized',node=>node.props.as==='aside').props['aria-label'],'Transporter search');
 }finally{view.close();}
});

test('typing and clear discard results immediately while preserving applied map state and identity',()=>{
 const view=harness('public-capacity-feed');try{
  let tree=view.render(feedProps);open(tree);tree=view.render();const before=find(tree,'Map').props;
  edit(tree,'First');tree=view.render();submit(tree);tree=view.render();assert.ok(results(tree));
  edit(tree,'Second');tree=view.render();assert.equal(results(tree),undefined);view.clock.advance(500);tree=view.render();assert.equal(results(tree).props.query.q,'Second');
  find(tree,'Localized',node=>node.props['aria-label']==='Clear search').props.onClick();tree=view.render();assert.equal(input(tree).props.value,'');assert.equal(results(tree),undefined);view.clock.advance(500);tree=view.render();assert.equal(results(tree),undefined);
  const after=find(tree,'Map').props;assert.equal(after.selectedId,before.selectedId);assert.equal(after.items,before.items);assert.equal(after.viewer,before.viewer);assert.equal(after.keepItemsInView,true);
  edit(tree,'Again');tree=view.render();submit(tree);tree=view.render();find(tree,'Map').props.onSelect('truck-1');tree=view.render();assert.equal(results(tree),undefined);open(tree);tree=view.render();assert.equal(results(tree),undefined);view.clock.advance(500);tree=view.render();assert.equal(results(tree).props.query.q,'Again');
 }finally{view.close();}
});

test('composition suppresses lookup and immediate submission consumes its delayed duplicate',()=>{
 const view=harness('public-capacity-feed');try{
  let tree=view.render(feedProps);open(tree);tree=view.render();input(tree).props.onCompositionStart();tree=view.render();edit(tree,'አዲ');tree=view.render();view.clock.advance(500);tree=view.render();assert.equal(results(tree),undefined);
  submit(tree);tree=view.render();assert.equal(results(tree),undefined);
  let prevented=false;input(tree).props.onKeyDown({key:'Enter',nativeEvent:{isComposing:true},preventDefault(){prevented=true;}});assert.equal(prevented,true);
  input(tree).props.onCompositionEnd({currentTarget:{value:'አዲ'}});tree=view.render();submit(tree);tree=view.render();const current=results(tree);assert.equal(current.props.query.q,'አዲ');
  view.clock.advance(500);tree=view.render();assert.equal(results(tree).key,current.key);
  find(tree,'Localized',node=>node.props['aria-label']==='Close transporter search').props.onClick();tree=view.render();assert.equal(results(tree),undefined);view.clock.advance(500);tree=view.render();assert.equal(results(tree),undefined);
 }finally{view.close();}
});

test('one issued lookup settles before the latest queued query; late body cannot render obsolete matches',async()=>{
 const view=harness('capacity-search-results');try{
  let tree=view.render({query:{q:'First'},mapQuery:{status:'EMPTY',provider:'chosen'},view:'open',searchPath:'/'});const first=view.requests[0],body=deferred();first.resolve({ok:true,json:()=>body.promise});await settle();
  tree=view.render({query:{q:'Second'},mapQuery:{status:'EMPTY',provider:'chosen'},view:'open',searchPath:'/'});assert.equal(first.signal.aborted,false);assert.equal(view.requests.length,1);assert.ok(!text(tree).includes('Obsolete match'));
  body.resolve(payload('Obsolete match'));await settle();tree=view.render();assert.equal(view.requests.length,2);assert.ok(!text(tree).includes('Obsolete match'));
  const second=view.requests[1];second.resolve({ok:true,json:async()=>payload('Current match')});await settle();tree=view.render();assert.ok(text(tree).includes('Current match'));
  const link=find(tree,'Link',node=>text(node).includes('Show vehicles on map'));const url=new URL(link.props.href,'http://localhost');assert.equal(url.searchParams.get('status'),'EMPTY');assert.equal(url.searchParams.get('provider'),'provider');assert.equal(url.searchParams.has('q'),false);
  view.render({query:{q:'Third'},view:'open',searchPath:'/'});view.close();assert.equal(view.requests[2].signal.aborted,true);
 }finally{view.close();}
});

test('bounded timeout retains private view and retry starts the same authorized request',async()=>{
 const view=harness('capacity-search-results');try{
  let tree=view.render({query:{q:'Addis',status:'EMPTY'},view:'private',searchPath:'/'});const request=view.requests[0],url=new URL(request.url,'http://localhost');assert.equal(url.searchParams.get('view'),'private');assert.equal(url.searchParams.get('page'),'1');
  view.clock.advance(searchContract.TRANSPORTER_SEARCH_TIMEOUT_MS);tree=view.render();assert.equal(request.signal.aborted,true);assert.ok(text(tree).includes('Search is temporarily unavailable. Please try again.'));
  find(tree,'button',node=>text(node).includes('Try again')).props.onClick();tree=view.render();assert.equal(view.requests.length,2);assert.equal(view.requests[1].url,request.url);
  view.requests[1].resolve({ok:false,json:async()=>({})});await settle();tree=view.render();assert.ok(text(tree).includes('Search is temporarily unavailable. Please try again.'));
 }finally{view.close();}
});

test('query change resets bounded result pagination to page one',async()=>{
 const view=harness('capacity-search-results');try{
  let tree=view.render({query:{q:'First'},view:'open',searchPath:'/'});view.requests[0].resolve({ok:true,json:async()=>payload('First match')});await settle();tree=view.render();
  find(tree,'button',node=>text(node)==='Next').props.onClick();tree=view.render();assert.equal(new URL(view.requests[1].url,'http://localhost').searchParams.get('page'),'2');
  view.requests[1].resolve({ok:true,json:async()=>payload('Page two')});await settle();tree=view.render();
  tree=view.render({query:{q:'Second'},view:'open',searchPath:'/'});assert.equal(new URL(view.requests.at(-1).url,'http://localhost').searchParams.get('page'),'1');assert.ok(!text(tree).includes('First match'));
 }finally{view.close();}
});

test('clear and close invalidate interest without overlapping a still-issued lookup',async()=>{
 const view=harness('capacity-search-results');try{
  const props={query:{q:'First'},view:'open',searchPath:'/'};let tree=view.render(props);const first=view.requests[0];
  tree=view.render({...props,active:false,query:{q:''}});assert.equal(tree,null);assert.equal(first.signal.aborted,false);
  tree=view.render({...props,query:{q:'Latest'},active:true});assert.equal(view.requests.length,1);
  tree=view.render({...props,active:false,query:{q:''}});first.resolve({ok:true,json:async()=>payload('Obsolete')});await settle();tree=view.render();assert.equal(tree,null);assert.equal(view.requests.length,1);
  tree=view.render({...props,query:{q:'Newest'},active:true});assert.equal(view.requests.length,2);assert.equal(new URL(view.requests[1].url,'http://localhost').searchParams.get('q'),'Newest');
 }finally{view.close();}
});

test('access scope changes abort old transport and malformed decoding remains retryable',async()=>{
 const view=harness('capacity-search-results');try{
  const props={query:{q:'Addis'},view:'open',searchPath:'/'};view.render(props);const first=view.requests[0];
  let tree=view.render({...props,view:'private'});assert.equal(first.signal.aborted,true);assert.equal(view.requests.length,2);assert.equal(new URL(view.requests[1].url,'http://localhost').searchParams.get('view'),'private');
  view.requests[1].resolve({ok:true,json:async()=>null});await settle();tree=view.render();assert.ok(text(tree).includes('Search is temporarily unavailable. Please try again.'));
  find(tree,'button',node=>text(node).includes('Try again')).props.onClick();view.render();assert.equal(view.requests.length,3);
 }finally{view.close();}
});

test('profile search ignores every truck filter while Show trucks receives the actual map query',()=>{
 const restrictive={status:'PARTIAL',vehicleCategory:'Cargo van',loadType:'PTL',stopOption:'SPLIT_STOP',freshness:'FRESH',ownerDocs:'IDENTITY',driverDocs:'DRIVER_IDENTITY',truckDocs:'VEHICLE_OWNERSHIP',origin:'Origin',destination:'Destination',originPlaceRef:'origin-ref',destinationPlaceRef:'destination-ref',truckCity:'City',nearLat:'9',nearLng:'38',nearRadiusKm:'20',provider:'chosen',truck:'truck-1'};
 for(const apiPath of ['/api/public/capacity','/api/shared-capacity']){
  const view=harness('public-capacity-feed');try{
   let tree=view.render({...feedProps,query:restrictive,apiPath});open(tree);tree=view.render();edit(tree,'Same transporter');tree=view.render();submit(tree);tree=view.render();
   assert.deepEqual(results(tree).props.query,{q:'Same transporter'});assert.deepEqual(results(tree).props.mapQuery,restrictive);assert.equal(results(tree).props.view,apiPath==='/api/shared-capacity'?'private':'open');
  }finally{view.close();}
 }
});

test('web map exposes location-source choices in open and shared filters without a separate space-needed control',()=>{
 for(const [apiPath,searchPath] of [['/api/public/capacity','/'],['/api/shared-capacity','/shared-capacity']]){
  const view=harness('public-capacity-feed');try{
   let tree=view.render({...feedProps,apiPath,searchPath,query:{locationSource:'GPS,MOBILE'}});
   const source=find(tree,'Options',node=>node.props.name==='locationSource');
   assert.ok(source);assert.equal(source.props.value,'GPS,MOBILE');
   assert.deepEqual(source.props.options,[['GPS','GPS device'],['MOBILE','Driver’s phone'],['MANUAL','Manually entered']]);
   assert.equal(find(tree,'Options',node=>node.props.name==='loadType'),undefined);
   assert.equal(find(tree,'Link',node=>text(node).trim()==='Clear').props.href,searchPath);
   const trigger=find(tree,'Localized',node=>String(node.props.className).includes('capacity-filter-trigger'));
   assert.equal(trigger.props['aria-label'],'Vehicle filters');assert.equal(text(trigger).trim(),'Filter 1');
   source.props.onChange('MANUAL');tree=view.render();
   assert.equal(find(tree,'Options',node=>node.props.name==='locationSource').props.value,'MANUAL');
  }finally{view.close();}
 }
});

test('applied map-query changes reset only map state and retain the live search boundary',()=>{
 const view=harness('public-capacity-feed');try{
  let tree=view.render({...feedProps,query:{status:'EMPTY'}});open(tree);tree=view.render();edit(tree,'Current profile');tree=view.render();submit(tree);tree=view.render();const version=results(tree).props.requestVersion;
  tree=view.render({...feedProps,query:{status:'PARTIAL',vehicleCategory:'Cargo van',ownerDocs:'IDENTITY'}});
  assert.equal(input(tree).props.value,'Current profile');assert.equal(find(tree,'Localized',node=>node.props.as==='aside').props['aria-hidden'],false);assert.equal(results(tree).props.requestVersion,version);assert.deepEqual(results(tree).props.query,{q:'Current profile'});
 }finally{view.close();}
});

test('the profile worker retains its page and result without another request when only map filters change',async()=>{
 const view=harness('capacity-search-results');try{
  const props={query:{q:'Current'},mapQuery:{status:'EMPTY'},view:'open',searchPath:'/'};let tree=view.render(props);view.requests[0].resolve({ok:true,json:async()=>payload('Current')});await settle();tree=view.render();
  find(tree,'button',node=>text(node)==='Next').props.onClick();tree=view.render();view.requests[1].resolve({ok:true,json:async()=>payload('Current page two')});await settle();tree=view.render();
  tree=view.render({...props,mapQuery:{status:'PARTIAL',vehicleCategory:'Cargo van',ownerDocs:'IDENTITY'}});assert.equal(view.requests.length,2);assert.ok(text(tree).includes('Current page two'));
  const url=new URL(find(tree,'Link',node=>text(node).includes('Show vehicles on map')).props.href,'http://localhost');assert.equal(url.searchParams.get('status'),'PARTIAL');assert.equal(url.searchParams.get('vehicleCategory'),'Cargo van');assert.equal(url.searchParams.get('ownerDocs'),'IDENTITY');
 }finally{view.close();}
});

test('web availability query mode changes only successful form fields and leaves reported location independent',()=>{
 const view=harness('public-capacity-feed');try{
  const props={...feedProps,query:{currentAreaPlaceRef:'area-ref',currentArea:'Addis Ababa',currentAreaRadiusKm:'50',originPlaceRef:'origin-ref',origin:'Adama',destinationPlaceRef:'destination-ref',destination:'Dire Dawa',directionMode:'EITHER',truckCityPlaceRef:'point-ref',truckCity:'Sebeta',locationSource:'GPS'}};
  let tree=view.render(props);const groups=nodes(tree).filter(node=>node.type==='details'&&node.props['data-filter-section']);assert.deepEqual(groups.map(node=>node.props['data-filter-section']),['vehicle','availability','location','more']);assert.equal(groups[1].props.open,true);assert.equal(groups[2].props.open,true,'active physical location filters stay visible');
  const mode=value=>find(tree,'button',node=>nodes(node).some(child=>child.type==='Text'&&child.props.message===value));
  assert.equal(mode('Route').props['aria-pressed'],true,'existing route links open their route query');
  let area=find(tree,'fieldset',node=>node.props['data-query-shape']==='AREA'),route=find(tree,'fieldset',node=>node.props['data-query-shape']==='ROUTE');assert.equal(area.props.disabled,true);assert.equal(route.props.disabled,false);
  mode('Area').props.onClick();tree=view.render();area=find(tree,'fieldset',node=>node.props['data-query-shape']==='AREA');route=find(tree,'fieldset',node=>node.props['data-query-shape']==='ROUTE');assert.equal(area.props.disabled,false);assert.equal(route.props.disabled,true);assert.equal(route.props.hidden,true);assert.equal(find(route,'Options',node=>node.props.name==='stopOption'),undefined);assert.ok(find(find(tree,'details',node=>node.props['data-filter-section']==='more'),'Options',node=>node.props.name==='stopOption'),'Stops stay outside the inactive route fieldset');
  assert.equal(find(area,'Place').props.placeRefName,'currentAreaPlaceRef');assert.equal(find(area,'Place').props.defaultPlaceRef,'area-ref');assert.equal(find(area,'select').props.defaultValue,'50');assert.equal(find(route,'Place').props.defaultPlaceRef,'origin-ref','inactive route fields remain mounted with saved draft values');assert.ok(find(tree,'Place',node=>node.props.placeRefName==='truckCityPlaceRef'));
  mode('Route').props.onClick();tree=view.render();assert.equal(find(tree,'fieldset',node=>node.props['data-query-shape']==='ROUTE').props.disabled,false);assert.equal(find(tree,'fieldset',node=>node.props['data-query-shape']==='AREA').props.disabled,true);assert.equal(nodes(tree).some(node=>node.props?.name==='availabilityGeometry'||node.props?.name==='preferredOnly'),false);
 }finally{view.close();}
});
test('web starts with an Area query and collapses unused physical vehicle location',()=>{
 const view=harness('public-capacity-feed');try{const tree=view.render({...feedProps,query:{}});assert.equal(find(tree,'button',node=>nodes(node).some(child=>child.type==='Text'&&child.props.message==='Area'))?.props['aria-pressed'],true);assert.equal(find(tree,'details',node=>node.props['data-filter-section']==='location').props.open,false);}finally{view.close();}
});
