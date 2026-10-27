import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as discovery from '../src/api/discovery.ts';
import * as filterPresentation from '../../../src/lib/capacity-filter-presentation.ts';
const {CAPACITY_FILTER_PRESENTATION:presentation}=filterPresentation;

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
ui.palette={ink:'#0b1d3a',border:'#cbd5e1'};
const common={'react-native':native,'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},'../localization/provider':{useLanguage:()=>({t:message=>message})},'../api/discovery':discovery,'./ui':ui,'./app-icon':{AppIcon:'AppIcon'},'../../../../src/lib/capacity-filter-presentation':filterPresentation};

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
 find(render(),node=>node.type==='Button'&&node.props.label==='All vehicle types').props.onPress();
 for(const name of ['Cargo van','Pickup truck']){const checkbox=find(render(),node=>node.type==='Pressable'&&node.props.accessibilityLabel===name);assert.equal(checkbox.props.accessibilityRole,'checkbox');assert.equal(checkbox.props['aria-checked'],checkbox.props.accessibilityState.checked);checkbox.props.onPress();assert.equal(find(render(),node=>node.type==='Modal').props.visible,true);}
 assert.equal(value,'Cargo van,Pickup truck');assert.ok(nodes(render()).some(node=>node.props?.label==='2 vehicle types'));
 assert.equal(nodes(render()).filter(node=>node.type==='Pressable'&&node.props.accessibilityState?.checked).length,2);
 find(render(),node=>node.type==='Pressable'&&node.props.accessibilityLabel==='Cargo van').props.onPress();assert.equal(value,'Pickup truck');
 find(render(),node=>node.type==='Button'&&node.props.message==='All vehicle types').props.onPress();assert.equal(value,'');
 const single=component('../src/components/configuration-picker.tsx',{'react-native':native,'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},'../api/http':{apiOrigin:'https://loadgistic.com'},'./ui':ui,'../localization/provider':{useLanguage:()=>({t:message=>message})}});
 const renderSingle=()=>single.render('ConfigurationPicker',props());
 find(renderSingle(),node=>node.type==='Button').props.onPress();find(renderSingle(),node=>node.type==='Pressable'&&node.props.accessibilityLabel==='Cargo van').props.onPress();
 assert.equal(value,'Cargo van');assert.equal(find(renderSingle(),node=>node.type==='Modal').props.visible,false,'registration remains one configuration and closes after selection');
});

test('native option groups combine in a draft, preserve all document requirements and apply only on confirmation',()=>{
 const screen=component('../src/components/discovery-filters.tsx',{...common,'../location/capture':{captureNearbyLocation:async()=>{throw new Error('unused GPS');}},'./place-picker':{PlacePicker:'PlacePicker'},'./multiple-configuration-picker':{MultipleConfigurationPicker:'MultipleConfigurationPicker'}});
 const applied=[],initial={originPlaceRef:'city',originLabel:'User city',originRadiusKm:'25',truckDocs:'VEHICLE_OWNERSHIP',loadType:'FTL'};
 const render=()=>screen.render('DiscoveryFilters',{initial,configurations:[],onApply:filters=>applied.push(filters),onClose(){}});
 const expand=key=>{const button=find(render(),node=>node.type==='Pressable'&&node.props.accessibilityLabel===presentation.groups[key].label);if(!button.props.accessibilityState.expanded)button.props.onPress();};
 const choose=(label,title)=>{const group=find(render(),node=>typeof node.type==='function'&&node.props.label===label);const options=group.type(group.props);find(options,node=>node.type==='Pressable'&&node.props.accessibilityLabel===title).props.onPress();};
 assert.equal(nodes(render()).some(node=>node.props?.label==='Space needed'),false,'Retired space filter is absent');
 expand('availability');expand('location');expand('more');
 for(const [group,a,b]of [['Load status','Empty vehicle','Partly loaded'],['Location source','GPS device','Driver’s phone'],['Stops','Multiple pickups','Multiple drop-offs'],['Updated','Within 12 hours','More than 12 hours ago']]){choose(group,a);choose(group,b);}
 choose('Available space','50% or more');
 find(render(),node=>node.type==='MultipleConfigurationPicker').props.onChange('Cargo van,Pickup truck');
 const documents=find(render(),node=>typeof node.type==='function'&&node.props.label==='Vehicle documents');
 find(documents.type(documents.props),node=>node.type==='Pressable'&&node.props.accessibilityLabel==='Permission to use vehicle').props.onPress();
 choose('Vehicle documents','Vehicle operating licence');
 assert.equal(applied.length,0,'editing draft must not query/change the map');
 find(render(),node=>node.type==='Pressable'&&node.props.accessibilityLabel==='Show vehicles').props.onPress();
 const {loadType:_removed,...preserved}=initial;
 assert.deepEqual(applied[0],{...preserved,truckDocs:'VEHICLE_OWNERSHIP,VEHICLE_AUTHORIZATION,VEHICLE_OPERATING_LICENSE',vehicleCategory:'Cargo van,Pickup truck',minAvailablePercent:'50',locationSource:'GPS,MOBILE',status:'EMPTY,PARTIAL',stopOption:'MULTI_DROP,MULTI_PICK',freshness:'FRESH,UPDATE_NEEDED'});
 choose('Location source','Any location source');assert.equal(applied.length,1);
 find(render(),node=>node.type==='Pressable'&&node.props.accessibilityLabel==='Reset vehicle filters').props.onPress();
 find(render(),node=>node.type==='Pressable'&&node.props.accessibilityLabel==='Show vehicles').props.onPress();assert.deepEqual(applied[1],{});
 assert.equal(initial.truckDocs,'VEHICLE_OWNERSHIP');
});
test('native photo age filter appears only in a business private Capacity map',()=>{
 const screen=component('../src/components/discovery-filters.tsx',{...common,'../location/capture':{captureNearbyLocation:async()=>{throw new Error('unused GPS');}},'./place-picker':{PlacePicker:'PlacePicker'},'./multiple-configuration-picker':{MultipleConfigurationPicker:'MultipleConfigurationPicker'}});
 const applied=[];
 const render=(privateBusiness)=>screen.render('DiscoveryFilters',{initial:{},configurations:[],privateBusiness,onApply:value=>applied.push(value),onClose(){}});
 const expand=()=>find(render(true),node=>node.type==='Pressable'&&node.props.accessibilityLabel==='More filters').props.onPress();
 expand();
 assert.equal(nodes(render(false)).some(node=>node.props.label==='Cargo space photo'),false);
 const group=find(render(true),node=>typeof node.type==='function'&&node.props.label==='Cargo space photo');
 assert.ok(group);
 find(group.type(group.props),node=>node.type==='Pressable'&&node.props.accessibilityLabel==='Within 24 hours').props.onPress();
 find(render(true),node=>node.type==='Pressable'&&node.props.accessibilityLabel==='Show vehicles').props.onPress();
 assert.equal(applied[0].photoPresent,'true');assert.equal(applied[0].photoMaxAgeHours,'24');
});

test('native filter groups are ordered, icon-led, accessible and keep hidden drafts when collapsed',()=>{
 const screen=component('../src/components/discovery-filters.tsx',{...common,'../location/capture':{captureNearbyLocation:async()=>{throw new Error('unused GPS');}},'./place-picker':{PlacePicker:'PlacePicker'},'./multiple-configuration-picker':{MultipleConfigurationPicker:'MultipleConfigurationPicker'}});
 const render=()=>screen.render('DiscoveryFilters',{initial:{originPlaceRef:'origin-ref',originLabel:'Addis Ababa',originRadiusKm:'25',destinationPlaceRef:'destination-ref',destinationLabel:'Adama',destinationRadiusKm:'50'},configurations:[],onApply(){},onClose(){}});
 const headings=()=>nodes(render()).filter(node=>node.type==='Pressable'&&node.props.testID===undefined&&Object.values(presentation.groups).some(group=>group.label===node.props.accessibilityLabel));
 assert.deepEqual(headings().map(node=>node.props.accessibilityLabel),['Vehicle','Area or route','Vehicle location','More filters']);
 assert.deepEqual(headings().map(node=>node.props.accessibilityState.expanded),[true,true,false,false]);
 const vehicle=nodes(find(render(),node=>node.props?.testID==='capacity-filter-vehicle'));
 const vehicleTypeIndex=vehicle.findIndex(node=>node.type==='MultipleConfigurationPicker');
 const loadStatusIndex=vehicle.findIndex(node=>node.type?.name==='Options'&&node.props.label==='Load status');
 const availableSpaceIndex=vehicle.findIndex(node=>node.type?.name==='Options'&&node.props.label==='Available space');
 assert.ok(vehicleTypeIndex>=0&&vehicleTypeIndex<loadStatusIndex&&loadStatusIndex<availableSpaceIndex,'vehicle type, load status and available space follow the matching decision');
 const chevrons=()=>headings().map(header=>nodes(header).filter(node=>node.type==='AppIcon').at(-1)?.props.name);
 assert.deepEqual(chevrons(),['chevronUp','chevronUp','chevronDown','chevronDown']);
 assert.equal(nodes(render()).some(node=>node.type==='PlacePicker'&&node.props.label==='Vehicle in or near a city'),false);
 headings().find(node=>node.props.accessibilityLabel==='Vehicle location').props.onPress();
 const location=nodes(find(render(),node=>node.props?.testID==='capacity-filter-location'));
 const cityIndex=location.findIndex(node=>node.type==='PlacePicker'&&node.props.label==='Vehicle in or near a city');
 const nearbyIndex=location.findIndex(node=>node.type==='Button'&&node.props.label==='Use my approximate area');
 const sourceIndex=location.findIndex(node=>node.type?.name==='Options'&&node.props.label==='Location source');
 assert.ok(cityIndex>=0&&cityIndex<nearbyIndex&&nearbyIndex<sourceIndex,'location proceeds from city to nearby area to source');
 assert.ok(nodes(render()).some(node=>node.type==='AppIcon'&&node.props.name==='truck'));
 assert.equal(nodes(render()).some(node=>node.type==='PlacePicker'&&node.props.label==='Origin'),true,'existing endpoint links open their Route query');
 const routeNodes=nodes(find(render(),node=>node.props?.testID==='capacity-filter-availability'));
 const routeIndex=predicate=>routeNodes.findIndex(predicate);
 const routeOrder=[
  routeIndex(node=>node.type==='PlacePicker'&&node.props.label==='Origin'),
  routeIndex(node=>node.type==='PlacePicker'&&node.props.label==='Destination'),
  routeIndex(node=>node.type?.name==='Options'&&node.props.label==='Origin range'),
  routeIndex(node=>node.type?.name==='Options'&&node.props.label==='Destination range'),
  routeIndex(node=>node.type?.name==='Options'&&node.props.label==='Direction'),
 ];
 assert.ok(routeOrder.every((index,i)=>index>=0&&(!i||routeOrder[i-1]<index)),'route proceeds from endpoints to ranges, direction and stops');
 const more=headings().find(node=>node.props.accessibilityLabel==='More filters');more.props.onPress();
 const moreNodes=nodes(find(render(),node=>node.props?.testID==='capacity-filter-more'));
 const updatedIndex=moreNodes.findIndex(node=>node.type?.name==='Options'&&node.props.label==='Updated');
 const documentsIndex=moreNodes.findIndex(node=>node.type?.name==='Documents');
 const stopsIndex=moreNodes.findIndex(node=>node.type?.name==='Options'&&node.props.label==='Stops');
 assert.ok(updatedIndex>=0&&stopsIndex>updatedIndex&&documentsIndex>stopsIndex,'freshness and independent stops precede document checks');
 find(render(),node=>node.type==='PlacePicker'&&node.props.label==='Origin').props.onChange({placeRef:'adama-ref',label:'Adama'});
 headings().find(node=>node.props.accessibilityLabel==='Area or route').props.onPress();
 assert.equal(nodes(render()).some(node=>node.type==='PlacePicker'&&node.props.label==='Origin'),false,'closing a section hides its controls');
 headings().find(node=>node.props.accessibilityLabel==='Area or route').props.onPress();
 assert.equal(find(render(),node=>node.type==='PlacePicker'&&node.props.label==='Origin').props.value.label,'Adama','reopening keeps the unsubmitted filter draft');
});

test('native filter controls consume the shared web/Expo labels, radii and defaults',async()=>{
 assert.deepEqual(presentation.cityDistance,{defaultKm:50,choices:[['5','5 km'],['10','10 km'],['25','25 km'],['50','50 km'],['100','100 km'],['200','200 km'],['300','300 km']]});
 assert.deepEqual(presentation.nearbyDistance,{defaultKm:20,choices:[['5','5 km'],['10','10 km'],['20','20 km'],['50','50 km'],['100','100 km']]});
 assert.deepEqual(presentation.routeDistance,{defaultKm:50,choices:[['10','10 km'],['25','25 km'],['50','50 km'],['100','100 km'],['200','200 km']]});
 const screen=component('../src/components/discovery-filters.tsx',{...common,'../location/capture':{captureNearbyLocation:async()=>({approximateLat:9.1,approximateLng:38.8})},'./place-picker':{PlacePicker:'PlacePicker'},'./multiple-configuration-picker':{MultipleConfigurationPicker:'MultipleConfigurationPicker'}});
 const render=(initial={originPlaceRef:'origin-id',originLabel:'Addis Ababa',truckCityPlaceRef:'city-id',truckCityLabel:'Adama'})=>screen.render('DiscoveryFilters',{initial,configurations:[],onApply(){},onClose(){}});
 const expand=label=>{const button=find(render(),node=>node.type==='Pressable'&&node.props.accessibilityLabel===label);if(!button.props.accessibilityState.expanded)button.props.onPress();};
 expand('Area or route');expand('More filters');
 const optionGroups=()=>nodes(render()).filter(node=>typeof node.type==='function'&&Array.isArray(node.props.choices)).map(node=>node.type(node.props));
 const radioLabels=tree=>nodes(tree).filter(node=>node.type==='Pressable'&&node.props.accessibilityRole==='radio').map(node=>node.props.accessibilityLabel);
 assert.deepEqual(radioLabels(optionGroups().find(group=>nodes(group).some(node=>node.type==='Text'&&node.props.children==='Origin range'))),presentation.routeDistance.choices.map(([,label])=>label));
 const anySource=optionGroups().find(group=>nodes(group).some(node=>node.type==='Text'&&node.props.children==='Location source'));
 assert.ok(nodes(anySource).some(node=>node.type==='Pressable'&&node.props.accessibilityLabel===presentation.locationSource.anyLabel));
 assert.ok(nodes(optionGroups().find(group=>nodes(group).some(node=>node.type==='Text'&&node.props.children===presentation.stops.label))).some(node=>node.type==='Pressable'&&node.props.accessibilityLabel===presentation.stops.anyLabel));
 assert.ok(nodes(optionGroups().find(group=>nodes(group).some(node=>node.type==='Text'&&node.props.children===presentation.freshness.label))).some(node=>node.type==='Pressable'&&node.props.accessibilityLabel===presentation.freshness.anyLabel));
 const city=optionGroups().find(group=>nodes(group).some(node=>node.type==='Text'&&node.props.children==='Distance from city'));
 assert.deepEqual(radioLabels(city),presentation.cityDistance.choices.map(([,label])=>label));
 assert.ok(nodes(city).some(node=>node.type==='Pressable'&&node.props.accessibilityLabel==='50 km'&&node.props.accessibilityState.checked));
 const nearbyButton=find(render(),node=>node.type==='Button'&&node.props.label==='Use my approximate area');await nearbyButton.props.onPress();
 const nearby=optionGroups().find(group=>nodes(group).some(node=>node.type==='Text'&&node.props.children==='Distance from my area'));
 assert.deepEqual(radioLabels(nearby),presentation.nearbyDistance.choices.map(([,label])=>label));
 assert.ok(nodes(nearby).some(node=>node.type==='Pressable'&&node.props.accessibilityLabel==='20 km'&&node.props.accessibilityState.checked));
 const docs=nodes(render()).filter(node=>typeof node.type==='function'&&node.type.name==='Documents');
 assert.deepEqual(docs.map(node=>node.props.label),presentation.documents.groups.map(group=>group.label));
 assert.deepEqual(docs.map(node=>node.props.options),presentation.documents.groups.map(group=>group.options));
});

test('native Area/Route query drafts survive switching while Apply prunes only the inactive shape',()=>{
 const screen=component('../src/components/discovery-filters.tsx',{...common,'../location/capture':{captureNearbyLocation:async()=>{throw new Error('unused GPS');}},'./place-picker':{PlacePicker:'PlacePicker'},'./multiple-configuration-picker':{MultipleConfigurationPicker:'MultipleConfigurationPicker'}}),applied=[];
 const initial={currentAreaPlaceRef:'area-ref',currentAreaLabel:'Addis Ababa',currentAreaRadiusKm:'25',originPlaceRef:'origin-ref',originLabel:'Adama',originRadiusKm:'50',destinationPlaceRef:'destination-ref',destinationLabel:'Dire Dawa',directionMode:'EITHER',stopOption:'MULTI_PICK',truckCityPlaceRef:'point-ref',truckCityLabel:'Sebeta',locationSource:'GPS',status:'PARTIAL'};
 const render=()=>screen.render('DiscoveryFilters',{initial,configurations:[],onApply:value=>applied.push(value),onClose(){}});
 const mode=label=>find(render(),node=>node.type==='Pressable'&&node.props.accessibilityLabel===label&&node.props.accessibilityRole==='radio');
 assert.equal(mode('Route').props.accessibilityState.checked,true);mode('Area').props.onPress();
 let area=find(render(),node=>node.type==='PlacePicker'&&node.props.label==='Area');assert.deepEqual(area.props.value,{placeRef:'area-ref',label:'Addis Ababa'});area.props.onChange({placeRef:'second-area',label:'Bishoftu'});
 mode('Route').props.onPress();assert.equal(find(render(),node=>node.type==='PlacePicker'&&node.props.label==='Origin').props.value.placeRef,'origin-ref');
 find(render(),node=>node.type==='Pressable'&&node.props.accessibilityLabel==='Show vehicles').props.onPress();assert.equal(applied[0].currentAreaPlaceRef,undefined);assert.equal(applied[0].currentAreaLabel,undefined);assert.equal(applied[0].currentAreaRadiusKm,undefined);assert.equal(applied[0].originPlaceRef,'origin-ref');assert.equal(applied[0].truckCityPlaceRef,'point-ref');assert.equal(applied[0].locationSource,'GPS');
 mode('Area').props.onPress();assert.equal(find(render(),node=>node.type==='PlacePicker'&&node.props.label==='Area').props.value.placeRef,'second-area');find(render(),node=>node.type==='Pressable'&&node.props.accessibilityLabel==='Show vehicles').props.onPress();assert.equal(applied[1].currentAreaPlaceRef,'second-area');assert.equal(applied[1].currentAreaRadiusKm,'25');for(const key of ['originPlaceRef','originLabel','originRadiusKm','destinationPlaceRef','destinationLabel','directionMode'])assert.equal(applied[1][key],undefined,key);assert.equal(applied[1].stopOption,'MULTI_PICK','stop preferences remain independent of query shape');assert.equal(applied[1].status,'PARTIAL');assert.equal(applied[1].truckCityPlaceRef,'point-ref');assert.equal(initial.currentAreaPlaceRef,'area-ref');
});
