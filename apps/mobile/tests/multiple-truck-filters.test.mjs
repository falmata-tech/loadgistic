import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as discovery from '../src/api/discovery.ts';

// Real component state/handlers with native hosts substituted; pixels/API are
// checked separately in the running Expo browser workflow.
function component(path,dependencies){
 const state=[];let cursor=0;
 const react={useState:initial=>{const i=cursor++;if(!(i in state))state[i]=typeof initial==='function'?initial():initial;return[state[i],value=>{state[i]=typeof value==='function'?value(state[i]):value;}];},useRef:initial=>{const i=cursor++;if(!(i in state))state[i]={current:initial};return state[i];}};
 const jsx=(type,props)=>({type,props:props||{}}),exports={};
 const imports={react,'react/jsx-runtime':{jsx,jsxs:jsx},...dependencies};
 const source=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports',source)(name=>{assert.ok(name in imports,`unexpected dependency ${name}`);return imports[name];},exports);
 return{exports,render:(name,props)=>{cursor=0;return exports[name](props);}};
}
function nodes(tree){if(Array.isArray(tree))return tree.flatMap(nodes);if(!tree||typeof tree!=='object')return[];return[tree,...nodes(tree.props?.children)];}
const find=(tree,match)=>{const node=nodes(tree).find(match);assert.ok(node,'expected component control');return node;};
const native=Object.fromEntries(['Modal','Pressable','ScrollView','Image','Text','View'].map(name=>[name,name]));
const ui=Object.fromEntries(['Page','Title','Button','Copy','ErrorText'].map(name=>[name,name]));
ui.palette={teal:'#0c7275',ink:'#172c46',border:'#cbdadb'};
const common={'react-native':native,'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},'../localization/provider':{useLanguage:()=>({t:message=>message})},'../api/discovery':discovery,'./ui':ui};

test('native courier pickers preserve distinct artwork and canonical values behind translated labels',()=>{
 const options=[{name:'Courier car',image:'/vehicle-configurations/courier-car.jpg'},{name:'Courier motorcycle',image:'/vehicle-configurations/courier-motorcycle.jpg'}];
 const language={'../localization/provider':{useLanguage:()=>({t:message=>'translated '+message})}};
 const single=component('../src/components/configuration-picker.tsx',{...common,...language,'../api/http':{apiOrigin:'https://loadgistic.com'}});let chosen='';
 const render=()=>single.render('ConfigurationPicker',{value:chosen,options,onChange:value=>{chosen=value;}});
 let tree=render();find(tree,node=>node.type==='Pressable'&&node.props.accessibilityLabel==='translated Courier motorcycle').props.onPress();
 assert.equal(chosen,'Courier motorcycle');tree=render();
 assert.equal(find(tree,node=>node.type==='Image'&&node.props.accessibilityLabel==='translated Courier motorcycle').props.source.uri,'https://loadgistic.com/vehicle-configurations/courier-motorcycle.jpg');
 const multi=component('../src/components/multiple-configuration-picker.tsx',{...common,...language,'../api/http':{apiOrigin:'https://loadgistic.com'},'./app-icon':{AppIcon:'AppIcon'}});let value='';
 const renderMulti=()=>multi.render('MultipleConfigurationPicker',{value,options,onChange:next=>{value=next;}});
 find(renderMulti(),node=>node.type==='Pressable'&&node.props.accessibilityLabel==='translated Courier car').props.onPress();
 find(renderMulti(),node=>node.type==='Pressable'&&node.props.accessibilityLabel==='translated Courier motorcycle').props.onPress();
 assert.equal(value,'Courier car,Courier motorcycle');
 assert.equal(nodes(renderMulti()).filter(node=>node.type==='Pressable'&&node.props.accessibilityState?.checked).length,2);
});

test('native pictured filter picker toggles several configurations without closing or changing fleet picker behavior',()=>{
 const options=[{name:'Cargo van',image:'/vehicle-configurations/cargo-van.jpg'},{name:'Pickup truck',image:'/vehicle-configurations/pickup-truck.jpg'}];
 const multi=component('../src/components/multiple-configuration-picker.tsx',{...common,'../api/http':{apiOrigin:'https://loadgistic.com'},'./app-icon':{AppIcon:'AppIcon'}});
 let value='';const props=()=>({value,options,onChange:next=>{value=next;}}),render=()=>multi.render('MultipleConfigurationPicker',props());
 find(render(),node=>node.type==='Button'&&node.props.label==='Any configuration').props.onPress();
 for(const name of ['Cargo van','Pickup truck']){const checkbox=find(render(),node=>node.type==='Pressable'&&node.props.accessibilityLabel===name);assert.equal(checkbox.props.accessibilityRole,'checkbox');assert.equal(checkbox.props['aria-checked'],checkbox.props.accessibilityState.checked);checkbox.props.onPress();assert.equal(find(render(),node=>node.type==='Modal').props.visible,true);}
 assert.equal(value,'Cargo van,Pickup truck');assert.ok(nodes(render()).some(node=>node.props?.label==='2 configurations selected'));
 assert.equal(nodes(render()).filter(node=>node.type==='Pressable'&&node.props.accessibilityState?.checked).length,2);
 find(render(),node=>node.type==='Pressable'&&node.props.accessibilityLabel==='Cargo van').props.onPress();assert.equal(value,'Pickup truck');
 find(render(),node=>node.type==='Button'&&node.props.message==='Any configuration').props.onPress();assert.equal(value,'');
 const single=component('../src/components/configuration-picker.tsx',{'react-native':native,'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},'../api/http':{apiOrigin:'https://loadgistic.com'},'./ui':ui,'../localization/provider':{useLanguage:()=>({t:message=>message})}});
 const renderSingle=()=>single.render('ConfigurationPicker',props());
 find(renderSingle(),node=>node.type==='Button').props.onPress();find(renderSingle(),node=>node.type==='Pressable'&&node.props.accessibilityLabel==='Cargo van').props.onPress();
 assert.equal(value,'Cargo van');assert.equal(find(renderSingle(),node=>node.type==='Modal').props.visible,false,'registration remains one configuration and closes after selection');
});

test('native option groups combine in a draft, preserve all document requirements and apply only on confirmation',()=>{
 const screen=component('../src/components/discovery-filters.tsx',{...common,'../location/capture':{captureNearbyLocation:async()=>{throw new Error('unused GPS');}},'./place-picker':{PlacePicker:'PlacePicker'},'./multiple-configuration-picker':{MultipleConfigurationPicker:'MultipleConfigurationPicker'}});
 const applied=[],initial={originPlaceRef:'city',originLabel:'User city',originRadiusKm:'25',truckDocs:'VEHICLE_OWNERSHIP',loadType:'FTL'};
 const render=()=>screen.render('DiscoveryFilters',{initial,configurations:[],onApply:filters=>applied.push(filters),onClose(){}});
 const choose=(label,title)=>{const group=find(render(),node=>typeof node.type==='function'&&node.props.label===label);const options=group.type(group.props);find(options,node=>node.type==='Pressable'&&node.props.accessibilityLabel===title).props.onPress();};
 assert.equal(nodes(render()).some(node=>node.props?.label==='Space needed'),false,'Retired space filter is absent');
 for(const [group,a,b]of [["Vehicle's current load",'Empty vehicle','Partly loaded'],['Location source','GPS device','Driver’s phone'],['Stops','Multiple pickups','Multiple deliveries'],['Capacity updated','Within 12 hours','Over 12 hours ago']]){choose(group,a);choose(group,b);}
 find(render(),node=>node.type==='MultipleConfigurationPicker').props.onChange('Cargo van,Pickup truck');
 const documents=find(render(),node=>typeof node.type==='function'&&node.props.label==='Vehicle documents');
 find(documents.type(documents.props),node=>node.type==='Pressable'&&node.props.accessibilityLabel==='Permission to use vehicle').props.onPress();
 choose('Vehicle documents','Vehicle operating licence');
 assert.equal(applied.length,0,'editing draft must not query/change the map');
 find(render(),node=>node.type==='Button'&&node.props.message==='Show matching vehicles').props.onPress();
 const {loadType:_removed,...preserved}=initial;
 assert.deepEqual(applied[0],{...preserved,truckDocs:'VEHICLE_OWNERSHIP,VEHICLE_AUTHORIZATION,VEHICLE_OPERATING_LICENSE',vehicleCategory:'Cargo van,Pickup truck',locationSource:'GPS,MOBILE',status:'EMPTY,PARTIAL',stopOption:'MULTI_DROP,MULTI_PICK',freshness:'FRESH,UPDATE_NEEDED'});
 choose('Location source','Any');assert.equal(applied.length,1);
 find(render(),node=>node.type==='Button'&&node.props.message==='Reset vehicle filters').props.onPress();
 find(render(),node=>node.type==='Button'&&node.props.message==='Show matching vehicles').props.onPress();assert.deepEqual(applied[1],{});
 assert.equal(initial.truckDocs,'VEHICLE_OWNERSHIP');
});
