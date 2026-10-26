import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as navigation from '../src/navigation/destinations.ts';
import * as discovery from '../src/api/discovery.ts';
import {providerHomeTab,providerHomeTabs} from '../../../src/lib/provider-workspace.js';
import {signupBenefits} from '../../../src/lib/platform-copy.js';

// Execute the actual entry, Home and shell handlers. Native hosts, session and
// transport are bounded ports; installed workflows and authorization remain
// separate evidence. Pane drafts expose actual component remounts.
const nodes=tree=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];
const find=(tree,type,predicate=()=>true)=>nodes(tree).find(node=>node.type===type&&predicate(node));
const settle=async()=>{for(let index=0;index<8;index++)await Promise.resolve();};
const provider=(extra={})=>({state:'ACTIVE',user:{id:'synthetic-provider',role:'TRANSPORTER',operatingModel:'FLEET_TRANSPORTER',ownsProviderAccount:true,canManageFleet:true,drivesTruck:true,...extra},access:{granted:true,status:'FREE_ACCESS'}});
const truck='11111111-1111-4111-8111-111111111111';
function runtime({session=provider(),params={},path='/account',busy=false}={}){
 const stores=new Map();let slots=[],cursor=0,dirty=false;
 const hooks={
  useState(initial){const state=slots,index=cursor++;if(!(index in state))state[index]=typeof initial==='function'?initial():initial;return[state[index],value=>{const next=typeof value==='function'?value(state[index]):value;if(!Object.is(next,state[index])){state[index]=next;dirty=true;}}];},
  useRef(initial){const index=cursor++;return slots[index]||(slots[index]={current:initial});},useMemo:compute=>compute(),useCallback:value=>value,useEffect(){},useContext:()=>false,
 };
 const React={createElement:(type,props,...children)=>({type,key:props?.key,props:{...props,children:children.flat(Infinity)}}),Fragment:'Fragment'};
 const calls=[],account={session,busy,error:'',request:async()=>({}),requestCode:async()=>'synthetic-handoff',verifyCode:async()=>account.session};
 const router={navigate:href=>calls.push({method:'navigate',href}),replace:href=>calls.push({method:'replace',href}),setParams:next=>{calls.push({method:'setParams',params:next});Object.assign(params,next);},canGoBack:()=>false};
 const hosts=Object.fromEntries(['View','Text','Pressable','Image','ScrollView','Modal','SafeAreaView','StatusBar','AppIcon','Button','Field','ErrorText','LoadingSpinner','Page','Copy','Title','Card','Switch','Redirect','WorkspaceTabs','ChatUpdatesButton','ExternalButton','ActionLink','AppLink'].map(name=>[name,name]));
 const common={React,...hooks,...hosts,...navigation,...discovery,providerHomeTab,providerHomeTabs,signupBenefits,router,require:()=>0,
  useAccount:()=>account,useLocalSearchParams:()=>params,usePathname:()=>path,useLanguage:()=>({t:message=>message}),useAccountQuery:()=>({data:null}),
  StyleSheet:{create:value=>value,absoluteFill:{}},Keyboard:{dismiss(){},addListener:()=>({remove(){}})},palette:{ink:'#0b1d3a'},
  languages:[],BackgroundNoticeLayout:{},navigationHeaderEdges:()=>['top'],blockChatReading(){},useChatUpdates:()=>({unreadCount:0,open(){}}),
 };
 function compile(file,values={},extra=''){
  const parsed=ts.createSourceFile(file,readFileSync(new URL(file,import.meta.url),'utf8')+extra,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const source=ts.createPrinter().printFile(ts.factory.updateSourceFile(parsed,parsed.statements.filter(node=>!ts.isImportDeclaration(node))));
  const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText,exports={},ports={...common,...values};
  new Function(...Object.keys(ports),'exports',code)(...Object.values(ports),exports);return exports;
 }
 function draftPane(name){return function Pane(props){const [draft,setDraft]=hooks.useState('');return React.createElement('Pane',{...props,name,draft,onChange:setDraft});};}
 function resolve(tree,pathKey='root'){
  if(Array.isArray(tree))return tree.map((child,index)=>resolve(child,`${pathKey}/${index}`));
  if(!tree||typeof tree!=='object')return tree;
  if(typeof tree.type==='function'){
   const key=`${pathKey}:${tree.type.name}:${tree.key||''}`;slots=stores.get(key)||[];stores.set(key,slots);cursor=0;
   return resolve(tree.type(tree.props),`${key}/component`);
  }
  return{...tree,props:{...tree.props,children:resolve(tree.props.children,`${pathKey}/children`)}};
 }
 function render(component,props={},deep=true){for(let pass=0;pass<10;pass++){dirty=false;slots=stores.get('shallow')||[];stores.set('shallow',slots);cursor=0;const tree=deep?resolve(React.createElement(component,props)):component(props);if(!dirty)return tree;}throw Error('Unsettled screen');}
 return{account,params,calls,compile,render,draftPane,setPath:next=>{path=next;}};
}

test('provider Home eligibility is explicit and every other actor retains public discovery',()=>{
 assert.equal(typeof navigation.hasProviderHome,'function');
 for(const role of ['TRANSPORTER','DRIVER'])assert.equal(navigation.hasProviderHome(provider({role})),true);
 const active=provider();
 for(const session of [null,{...active,state:'ONBOARDING'},{...active,state:'JOIN_FLEET'},{...active,access:null},{...active,access:{granted:false}},...['CUSTOMER','ADMIN','SUPPORT'].map(role=>provider({role}))])assert.equal(navigation.hasProviderHome(session),false);
 assert.equal(navigation.workspaceHome(active),'/account?tab=capacity');
 assert.equal(navigation.workspaceHome({...active,access:{granted:false}}),'/account');
});

test('provider entry carries only bounded existing public search and identity context',()=>{
 assert.equal(typeof navigation.providerHomeHref,'function');
 const href=navigation.providerHomeHref(provider(),{q:'  አዲስ & Adama  ',provider:'safe-provider',truck,view:'private',redirect:'https://foreign.test',token:'private'});
 const params=new URL(href,'https://local.test').searchParams;
 assert.equal(href.split('?')[0],'/account');assert.deepEqual([...params.keys()].sort(),['provider','q','tab','truck']);
 assert.equal(params.get('tab'),'market');assert.equal(params.get('q'),'አዲስ & Adama');assert.equal(params.get('provider'),'safe-provider');assert.equal(params.get('truck'),truck);
 for(const invalid of [{},{view:'private'},{q:'x'.repeat(121),provider:'../private',truck:'bad'},{q:['Adama'],provider:['safe-provider'],truck:[truck]},{q:'x',provider:'a',truck:'http://foreign.test'}])assert.equal(navigation.providerHomeHref(provider(),invalid),'/account?tab=capacity');
 assert.equal(new URL(navigation.providerHomeHref(provider(),{q:'x'.repeat(120)}),'https://local.test').searchParams.get('q').length,120);
 for(const [capabilities,tab] of [[{drivesTruck:true,canManageFleet:true},'capacity'],[{drivesTruck:false,canManageFleet:true},'vehicles'],[{drivesTruck:false,canManageFleet:false},'market']]){
  const session=provider(capabilities);assert.equal(navigation.providerHomeHref(session),`/account?tab=${tab}`);assert.equal(navigation.workspaceHome(session),`/account?tab=${tab}`);
  for(const context of [{q:'Adama'},{provider:'safe-provider'},{truck}])assert.equal(new URL(navigation.providerHomeHref(session,context),'https://local.test').searchParams.get('tab'),'market');
 }
});

test('pure Home navigation preserves current tabs and leaves non-provider destinations unchanged',()=>{
 assert.equal(navigation.navigationTarget('/account','/account',provider()),null);
 for(const path of ['/shipments','/featured','/fleet','/'])assert.equal(navigation.navigationTarget(path,'/account',provider()),'/account?tab=capacity');
 assert.equal(navigation.navigationTarget('/account','/shipments',provider()),'/shipments');
 for(const session of [null,{...provider(),state:'ONBOARDING'},{...provider(),state:'JOIN_FLEET'},{...provider(),access:{granted:false}},provider({role:'CUSTOMER'})])assert.equal(navigation.navigationTarget('/','/account',session),'/account');
 const customer={...provider({role:'CUSTOMER'}),user:{...provider({role:'CUSTOMER'}).user,selectedBusinessWorkspace:{permissions:{capacity:true,tracking:true}}}};
 assert.equal(navigation.workspaceHome(customer),'/business-capacity');
});

test('actual root entry restores before choosing context and redirects only eligible providers',()=>{
 const view=runtime({params:{q:'Adama',provider:'safe-provider',truck},busy:true});
 const screen=view.compile('../src/screens/capacity.tsx').default;
 let tree=view.render(screen,{},false);assert.ok(find(tree,'LoadingSpinner'));assert.equal(find(tree,'Redirect'),undefined);assert.notEqual(tree.type.name,'Capacity');
 view.account.busy=false;tree=view.render(screen,{},false);assert.equal(tree.type,'Redirect');assert.equal(tree.props.href,navigation.providerHomeHref(view.account.session,view.params));
 for(const session of [null,{...provider(),state:'ONBOARDING'},{...provider(),state:'JOIN_FLEET'},{...provider(),access:{granted:false}},...['CUSTOMER','ADMIN','SUPPORT'].map(role=>provider({role}))]){
  view.account.session=session;tree=view.render(screen,{},false);assert.equal(tree.type.name,'Capacity');assert.equal(find(tree,'Redirect'),undefined);
 }
});

test('actual ordinary root entry opens work while valid public intent opens Market',()=>{
 for(const [capabilities,tab] of [[{drivesTruck:true,canManageFleet:true},'capacity'],[{drivesTruck:false,canManageFleet:true},'vehicles'],[{drivesTruck:false,canManageFleet:false},'market']]){
  for(const params of [{},{view:'private'},{q:'x'},{q:['Adama'],provider:['safe-provider'],truck:[truck]}]){
   const view=runtime({session:provider(capabilities),params}),screen=view.compile('../src/screens/capacity.tsx').default;
   assert.equal(view.render(screen,{},false).props.href,`/account?tab=${tab}`);
  }
  for(const params of [{q:'Adama'},{provider:'safe-provider'},{truck}]){
   const view=runtime({session:provider(capabilities),params}),screen=view.compile('../src/screens/capacity.tsx').default;
   const target=new URL(view.render(screen,{},false).props.href,'https://local.test');assert.equal(target.searchParams.get('tab'),'market');
   for(const [key,value] of Object.entries(params))assert.equal(target.searchParams.get(key),value);
  }
 }
});

test('actual private entry retains guest/business access boundaries without a provider redirect loop',()=>{
 for(const [session,href] of [[null,'/account?from=capacity'],[provider(),'/account?tab=capacity'],[{...provider(),access:{granted:false}},'/']]){
  const view=runtime({session,params:{view:'private'}}),screen=view.compile('../src/screens/capacity.tsx').default;
  assert.equal(view.render(screen,{},false).props.href,href);
  if(href==='/'){delete view.params.view;assert.equal(view.render(screen,{},false).type.name,'Capacity');}
 }
 for(const granted of [true,false]){
  const session=provider({role:'CUSTOMER',selectedBusinessWorkspace:{id:'synthetic-workspace',permissions:{capacity:granted}}});
  const view=runtime({session,params:{view:'private'}}),screen=view.compile('../src/screens/capacity.tsx').default,tree=view.render(screen,{},false);
  if(granted){assert.equal(tree.type.name,'Capacity');assert.equal(tree.props.initialMode,'private');assert.equal(tree.props.business.workspaceId,'synthetic-workspace');}
  else{assert.equal(tree.type,'Page');assert.equal(find(tree,'Copy').props.message,'Vehicles shared with you are not available for this account.');}
 }
});

test('actual provider Home defaults to authorized work, orders Market last and requests balanced tabs',()=>{
 for(const [capabilities,ids] of [
  [{drivesTruck:true,canManageFleet:true},['capacity','vehicles','market']],
  [{drivesTruck:false,canManageFleet:true},['vehicles','market']],
  [{role:'DRIVER',operatingModel:'COMPANY_DRIVER',ownsProviderAccount:false,drivesTruck:true,canManageFleet:false},['capacity','market']],
  [{drivesTruck:false,canManageFleet:false},['market']],
 ]){
  const view=runtime({session:provider(capabilities)}),screen=view.compile('../src/screens/account.tsx',{DriverHome:view.draftPane('capacity'),FleetScreen:view.draftPane('vehicles'),PublicCapacityHome:view.draftPane('market')}).default;
  const tree=view.render(screen),tabs=find(tree,'WorkspaceTabs');assert.equal(tabs.props.value,ids[0]);assert.deepEqual(tabs.props.items.map(item=>item.id),ids);assert.equal(tabs.props.items.at(-1).message,'Analyze the Market');assert.equal(tabs.props.balanced,true);assert.equal(find(tree,'Pane').props.name,ids[0]);
  view.params.tab='market';const explicit=view.render(screen);assert.equal(find(explicit,'WorkspaceTabs').props.value,'market');assert.ok(find(explicit,'Pane',node=>node.props.name==='market'));
 }
});

test('rendered balanced provider tabs fill the row equally and permit translated wrapping without changing other tab rows',()=>{
 const flatten=style=>Object.assign({},...[style].flat(Infinity).filter(value=>value&&typeof value==='object'));
 const catalogs=[{},JSON.parse(readFileSync(new URL('../../../src/lib/i18n/messages/am.json',import.meta.url),'utf8')),JSON.parse(readFileSync(new URL('../../../src/lib/i18n/messages/om.json',import.meta.url),'utf8'))];
 for(const capabilities of [{drivesTruck:true,canManageFleet:true},{drivesTruck:false,canManageFleet:true},{drivesTruck:true,canManageFleet:false}])for(const catalog of catalogs){
  const view=runtime(),calls=[],t=label=>catalog[label]||label,screen=view.compile('../src/components/workspace-task.tsx',{useLanguage:()=>({t})}).WorkspaceTabs;
  const items=providerHomeTabs(capabilities).map(tab=>({id:tab.id,message:tab.label}));
  const tree=view.render(screen,{balanced:true,value:items[0].id,items,onChange:value=>calls.push(value)});
  assert.equal(tree.type,'View');assert.equal(tree.props.accessibilityRole,'tablist');const row=flatten(tree.props.style);assert.equal(row.width,'100%');assert.equal(row.flexDirection,'row');assert.equal(row.flexShrink,0);assert.equal(row.height,undefined);assert.equal(row.maxHeight,undefined);
  const buttons=nodes(tree).filter(node=>node.type==='Pressable');assert.equal(buttons.length,items.length);
  for(const [index,button] of buttons.entries()){
   const cell=flatten(button.props.style),text=find(button,'Text'),label=flatten(text.props.style);assert.equal(cell.flex,1);assert.equal(cell.minWidth,0);assert.ok(cell.minHeight>=44);assert.equal(cell.justifyContent,'center');assert.equal(label.textAlign,'center');assert.equal(label.flex,1);assert.equal(label.fontSize,14);assert.equal(text.props.numberOfLines,undefined);assert.equal(text.props.adjustsFontSizeToFit,undefined);assert.equal(button.props.accessibilityLabel,t(items[index].message));assert.equal(button.props['aria-selected'],index===0);
  }
  buttons.at(-1).props.onPress();assert.deepEqual(calls,['market']);
  const legacy=view.render(screen,{value:items[0].id,items,onChange(){}});assert.equal(legacy.type,'ScrollView');assert.equal(legacy.props.horizontal,true);assert.equal(flatten(legacy.props.style).height,52);
 }
});

test('actual Account keeps invitation, onboarding, customer and limited entry before provider Home',()=>{
 for(const [session,params,type,href] of [
  [{...provider(),state:'JOIN_FLEET'},{tab:'market'},'Invitations'],
  [{...provider(),state:'ONBOARDING'},{tab:'market'},'Redirect','/signup'],
  [{...provider(),state:'ONBOARDING'},{setup:'provider',tab:'market'},'Onboarding'],
  [provider({role:'CUSTOMER'}),{tab:'market'},'Redirect','/business-capacity'],
  [{...provider(),access:{granted:false}},{tab:'market'},'Dashboard'],
 ]){
  const view=runtime({session,params}),screen=view.compile('../src/screens/account.tsx',{businessHome:()=>'/business-capacity'}).default;
  const tree=view.render(screen,{},false);assert.equal(typeof tree.type==='string'?tree.type:tree.type.name,type);if(href)assert.equal(tree.props.href,href);
 }
});

test('actual Home URL tab changes retain visited drafts while explicit public identity resets only Market',()=>{
 const view=runtime({params:{tab:'capacity',q:'Adama',provider:'safe-provider',truck}});
 const screen=view.compile('../src/screens/account.tsx',{DriverHome:view.draftPane('capacity'),FleetScreen:view.draftPane('vehicles'),PublicCapacityHome:view.draftPane('market')}).default;
 let tree=view.render(screen);find(tree,'Pane',node=>node.props.name==='capacity').props.onChange('unsaved capacity');tree=view.render(screen);
 find(tree,'WorkspaceTabs').props.onChange('vehicles');tree=view.render(screen);find(tree,'Pane',node=>node.props.name==='vehicles').props.onChange('unsaved fleet');tree=view.render(screen);
 find(tree,'WorkspaceTabs').props.onChange('market');tree=view.render(screen);find(tree,'Pane',node=>node.props.name==='market').props.onChange('market filter');tree=view.render(screen);
 assert.equal(find(tree,'Pane',node=>node.props.name==='capacity').props.draft,'unsaved capacity');assert.equal(find(tree,'Pane',node=>node.props.name==='vehicles').props.draft,'unsaved fleet');
 assert.deepEqual(view.calls,[{method:'setParams',params:{tab:'vehicles'}},{method:'setParams',params:{tab:'market'}}]);
 assert.equal(find(tree,'Pane',node=>node.props.name==='market').props.initialQuery,'Adama');assert.deepEqual(find(tree,'Pane',node=>node.props.name==='market').props.initialFilters,{provider:'safe-provider',truck});
 const calls=view.calls.length;find(tree,'WorkspaceTabs').props.onChange('market');tree=view.render(screen);assert.equal(view.calls.length,calls);assert.equal(find(tree,'Pane',node=>node.props.name==='market').props.draft,'market filter');
 view.params.provider='other-provider';tree=view.render(screen);assert.equal(find(tree,'Pane',node=>node.props.name==='market').props.draft,'');assert.equal(find(tree,'Pane',node=>node.props.name==='capacity').props.draft,'unsaved capacity');assert.equal(find(tree,'Pane',node=>node.props.name==='vehicles').props.draft,'unsaved fleet');
 view.params.tab='capacity';tree=view.render(screen);assert.equal(find(tree,'WorkspaceTabs').props.value,'capacity');assert.equal(find(tree,'Pane',node=>node.props.name==='capacity').props.draft,'unsaved capacity');
 view.account.session=provider({id:'different-provider'});tree=view.render(screen);assert.equal(find(tree,'Pane',node=>node.props.name==='capacity').props.draft,'','another actor cannot inherit drafts');
});

test('actual public Home receives bounded deep-link context and own ids without injecting private supply',()=>{
 const view=runtime();const screen=view.compile('../src/screens/capacity.tsx',{useAccountQuery:path=>{assert.equal(path,'/api/mobile/capacity');return{data:{vehicles:[{current:{id:'public-own'}},{current:{id:'private-own'}},{current:null}]}};}}).PublicCapacityHome;
 let tree=view.render(screen,{active:true,initialQuery:'  Adama  ',initialFilters:{provider:'safe-provider',truck,status:'OFF_DUTY'}},false);
 assert.equal(tree.type.name,'Capacity');assert.equal(tree.props.initialQuery,'Adama');assert.deepEqual(tree.props.initialFilters,{provider:'safe-provider',truck});assert.deepEqual(tree.props.ownSignalIds,['public-own','private-own']);assert.equal(tree.props.items,undefined,'private workspace records are only decoration ids, never map supply');
 tree=view.render(screen,{active:false,initialQuery:'x'.repeat(121),initialFilters:{provider:'../bad',truck:'bad'}},false);assert.equal(tree.props.initialQuery,'');assert.deepEqual(tree.props.initialFilters,{provider:'',truck:''});assert.equal(tree.props.active,false);
});

test('actual native marker ownership decorates only the loaded public-result intersection',()=>{
 const file=readFileSync(new URL('../src/components/CapacityMap.tsx',import.meta.url),'utf8'),source=ts.createSourceFile('CapacityMap.tsx',file,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),declarations=[];
 function visit(node){if(ts.isVariableDeclaration(node)&&['ownIds','data','ownData'].includes(node.name.getText(source)))declarations.push(node.getText(source));ts.forEachChild(node,visit);}
 visit(source);assert.equal(declarations.length,3);
 const code=ts.transpileModule(`${declarations.map(declaration=>`const ${declaration};`).join('\n')}return {data,ownData};`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
 const items=[{id:'public-own'},{id:'public-other'}],actual=new Function('items','ownSignalIds','useMemo','capacityMapData',code)(items,['public-own','private-own','draft-own','off-duty-own'],compute=>compute(),rows=>rows);
 assert.deepEqual(actual.ownData,[items[0]]);assert.deepEqual(actual.data,[items[1]]);assert.deepEqual([...actual.data,...actual.ownData].map(item=>item.id).sort(),['public-other','public-own']);
});

test('actual Home controls open default work from elsewhere and preserve a current Market tab',()=>{
 for(const path of ['/shipments','/account']){
  const view=runtime({path,params:{tab:'market',q:'Adama'}}),screen=view.compile('../src/components/navigation-shell.tsx').NavigationShell;
  const tree=view.render(screen),home=find(tree,'Pressable',node=>node.props.accessibilityRole==='tab'&&node.props.accessibilityLabel==='Home');assert.ok(home);home.props.onPress();find(tree,'Pressable',node=>node.props.accessibilityRole==='button'&&node.props.accessibilityLabel==='Home').props.onPress();
  assert.deepEqual(view.calls,path==='/account'?[]:[{method:'navigate',href:'/account?tab=capacity'},{method:'navigate',href:'/account?tab=capacity'}]);assert.equal(view.params.tab,'market');assert.equal(view.params.q,'Adama');
 }
});

test('actual sign-in routes providers to default work while preserving invitation and onboarding precedence',async()=>{
 for(const [session,params,target] of [
  [provider(),{},'/account?tab=capacity'],[provider({role:'DRIVER',ownsProviderAccount:false,canManageFleet:false}),{},'/account?tab=capacity'],[provider({drivesTruck:false}),{},'/account?tab=vehicles'],[provider({drivesTruck:false,canManageFleet:false}),{},'/account?tab=market'],[provider(),{from:'workspaces'},'/workspaces'],
  [{...provider(),state:'ONBOARDING'}, {},'/signup'],[{...provider(),state:'JOIN_FLEET'},{},null],[{...provider(),access:{granted:false}},{},null],
 ]){
  const view=runtime({session,params}),screen=view.compile('../src/screens/account.tsx').AuthEntry;
  let tree=view.render(screen,{mode:'LOGIN'});find(tree,'Field',node=>node.props.message==='Email').props.onChangeText('synthetic@example.test');tree=view.render(screen,{mode:'LOGIN'});await find(tree,'Button',node=>node.props.label==='Send code').props.onPress();await settle();tree=view.render(screen,{mode:'LOGIN'});find(tree,'Field',node=>node.props.message==='Sign-in code').props.onChangeText('123456');tree=view.render(screen,{mode:'LOGIN'});await find(tree,'Button',node=>node.props.label==='Sign in').props.onPress();await settle();
  assert.deepEqual(view.calls,target?[{method:'replace',href:target}]:[]);
 }
});
