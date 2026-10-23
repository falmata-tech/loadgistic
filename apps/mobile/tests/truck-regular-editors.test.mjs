import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {workspaceCapabilities} from '../src/navigation/destinations.ts';
import {currentDrivingTruck} from '../src/navigation/current-driving-pair.ts';

// Real screen state/handlers with native views and transport substituted. This
// proves caller scope, not SQL authorization or native pixels.
function renderer(){
 const stores=new Map();let slots=[],cursor=0;
 const React={createElement:(type,props,...children)=>({type,key:props?.key,props:{...props,children:children.flat(Infinity)}}),Fragment:'Fragment'};
 const hooks={useState:initial=>{const state=slots,index=cursor++;if(!(index in state))state[index]=typeof initial==='function'?initial():initial;return[state[index],value=>{state[index]=typeof value==='function'?value(state[index]):value;}];},useRef:initial=>{const index=cursor++;return slots[index]||(slots[index]={current:initial});},useMemo:compute=>compute(),useCallback:value=>value,useEffect(){}};
 function compile(path,values){const parsed=ts.createSourceFile(path,readFileSync(new URL(path,import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),source=ts.createPrinter().printFile(ts.factory.updateSourceFile(parsed,parsed.statements.filter(node=>!ts.isImportDeclaration(node)))),code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText,exports={};const args={React,...hooks,...values};new Function(...Object.keys(args),'exports',code)(...Object.values(args),exports);return exports;}
 function resolve(tree,path='root'){if(Array.isArray(tree))return tree.map((child,index)=>resolve(child,`${path}/${index}`));if(!tree||typeof tree!=='object')return tree;if(typeof tree.type==='function'){const id=`${path}:${tree.type.name}:${tree.key||''}`;slots=stores.get(id)||[];stores.set(id,slots);cursor=0;return resolve(tree.type(tree.props),`${id}/content`);}return{...tree,props:{...tree.props,children:resolve(tree.props.children,`${path}/children`)}};}
 return{compile,render:(component,props={})=>resolve(React.createElement(component,props))};
}
const nodes=tree=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];
const find=(tree,type,match=()=>true)=>nodes(tree).find(node=>node.type===type&&match(node));
const settle=async()=>{for(let index=0;index<8;index++)await Promise.resolve();};
const vehicleA='11111111-1111-4111-8111-111111111111',vehicleB='22222222-2222-4222-8222-222222222222',driverA='33333333-3333-4333-8333-333333333333',driverB='44444444-4444-4444-8444-444444444444';
const place=label=>({placeRef:label,label,coordinate:[38.7,9.0]});
const service=(vehicleId=vehicleA,driverId=driverA)=>({id:vehicleId,vehicleId,driverId,geometry:'ROUTE',route:[place('Adama'),place('Addis Ababa')],center:place('Adama'),boundary:[]});
const native=Object.fromEntries(['ActivityIndicator','Redirect','Page','Title','Copy','Card','Button','ErrorText','Choices','Cities','PlacePicker','View','Text','Pressable','ScrollView','Modal','SafeAreaView','Switch','Image','Field','WorkspaceSection','WorkspaceAction','WorkspaceTaskHeader','WorkspaceFact','TrackingMap','Map','Camera','AppIcon','AppLink','TruckLocationSource'].map(name=>[name,name]));
const t=(message,values={})=>message.replace(/\{(\w+)\}/g,(match,key)=>String(values[key]??match));
const common={...native,WorkspaceTaskPane:({active,children})=>active?{type:'View',props:{children}}:null,workspaceCapabilities,currentDrivingTruck,PublicImage:'PublicImage',useLanguage:()=>({t,locale:'en'}),StyleSheet:{create:value=>value,absoluteFill:{}},emptyPlace:()=>({placeRef:'',label:'',coordinate:null}),CoveragePreview:'CoveragePreview',palette:{blue:'#155eef',ink:'#0b1d3a',muted:'#526375',border:'#cbd5e1'},useFocusEffect(){},useForegroundRefresh(){},locationAreaLabel:area=>area,capacitySharingLabel:value=>value,capacityLoadLabel:value=>value,capacityLoadExplanation:value=>value,AppState:{currentState:'active',addEventListener:()=>({remove(){}})},mapStyle:{}};

function regular(){
 const view=renderer(),requests=[],paths=[];let data={services:[service(),service(vehicleB,driverB),{...service(),vehicleId:'',driverId:'',id:'legacy'}]},saved=0;
 const account={session:{user:{id:driverA,role:'DRIVER',operatingModel:'OWNER_OPERATOR'}},request:async(path,body)=>{requests.push({path,body});return{};}};
 const screen=view.compile('../src/screens/regular-service.tsx',{...common,useAccount:()=>account,useAccountQuery:path=>{paths.push(path);return{data,error:'',loading:false,reload:async()=>{}};},Alert:{alert:(_title,_copy,buttons)=>buttons.find(button=>button.style==='destructive').onPress()}}).default;
 return{render:props=>view.render(screen,{vehicleId:vehicleA,expectedDriverId:driverA,onSaved:()=>saved++,...props}),requests,paths,data:value=>{data=value;},request:handler=>{account.request=handler;},saved:()=>saved};
}

test('native regular editor sends the selected truck and current driver on save and remove',async()=>{
 const view=regular();let tree=view.render();assert.equal(view.paths[0],`/api/mobile/regular-service?vehicleId=${vehicleA}&expectedDriverId=${driverA}`);
 find(tree,'Button',node=>node.props.message==='Edit regular service').props.onPress();tree=view.render();find(tree,'Cities').props.onChange([place('Bahir Dar'),place('Gondar')]);tree=view.render();find(tree,'Button',node=>node.props.message==='Save regular service').props.onPress();await settle();
 assert.equal(view.requests.length,1);assert.deepEqual(view.requests[0].body,{action:'SAVE',vehicleId:vehicleA,expectedDriverId:driverA,replaceId:vehicleA,geometry:'ROUTE',routePlaces:[{placeRef:'Bahir Dar'},{placeRef:'Gondar'}],areaCenterPlaceRef:'Adama',areaBoundaryPlaces:[]});
 tree=view.render();find(tree,'Button',node=>node.props.message==='Remove regular service').props.onPress();tree=view.render();assert.equal(view.requests.length,1,'opening confirmation must not remove the route');find(tree,'Button',node=>node.props.message==='Keep service').props.onPress();tree=view.render();assert.equal(find(tree,'Button',node=>node.props.message==='Remove'),undefined);assert.ok(find(tree,'Button',node=>node.props.message==='Edit regular service'));
 find(tree,'Button',node=>node.props.message==='Remove regular service').props.onPress();tree=view.render();find(tree,'Button',node=>node.props.message==='Remove').props.onPress();await settle();assert.deepEqual(view.requests[1].body,{action:'REMOVE',vehicleId:vehicleA,expectedDriverId:driverA,id:vehicleA,confirm:true});assert.equal(view.saved(),2);
});

test('native regular removal failure retains the confirmed route and requires a successful refresh',async()=>{
 const view=regular();view.request(async()=>{throw Error('Truck assignment changed.');});let tree=view.render();find(tree,'Button',node=>node.props.message==='Remove regular service').props.onPress();tree=view.render();find(tree,'Button',node=>node.props.message==='Remove').props.onPress();await settle();tree=view.render();assert.equal(view.saved(),0);assert.ok(find(tree,'CoveragePreview'),'a failed command must not optimistically remove saved geometry');assert.equal(find(tree,'ErrorText',node=>Boolean(node.props.message)).props.message,'Truck assignment changed.');assert.ok(find(tree,'Copy',node=>node.props.message==='Refresh to check your saved routes before trying again.'));assert.ok(find(tree,'Button',node=>node.props.message==='Keep service'));assert.equal(find(tree,'Button',node=>node.props.message==='Remove').props.busy,false);
});

test('native regular editor never guesses an unscoped route and resets draft state per pair',()=>{
 const view=regular();let tree=view.render({vehicleId:'',expectedDriverId:''});assert.equal(view.paths.length,0,'a missing pair cannot fetch a provider-global route');assert.equal(find(tree,'Redirect').props.href,'/fleet');
 tree=view.render();find(tree,'Button',node=>node.props.message==='Edit regular service').props.onPress();tree=view.render();find(tree,'Cities').props.onChange([place('Unsaved A'),place('Unsaved B')]);
 tree=view.render({vehicleId:vehicleB,expectedDriverId:driverB});find(tree,'Button',node=>node.props.message==='Edit regular service').props.onPress();tree=view.render({vehicleId:vehicleB,expectedDriverId:driverB});assert.deepEqual(find(tree,'Cities').props.items,service(vehicleB,driverB).route,'another pair does not inherit the draft');
 view.data({services:[{...service(),vehicleId:'',driverId:'',id:'legacy'},service(vehicleA,driverB)]});tree=view.render();assert.equal(find(tree,'Button',node=>node.props.message==='Remove regular service'),undefined,'ambiguous or other-driver routes cannot be edited as this pair');
});

test('company-driver Home displays only its authorized pair regular overlay and keeps owner-only editing',()=>{
 const view=renderer(),paths=[],truck={id:vehicleA,driverId:driverA,driver:'Assigned driver',label:'Assigned truck',plate:'LOCAL',canLocate:false,location:{coordinate:[38.7,9],radius:20,area:'Adama',updatedAt:'2026-10-13'},current:null,regularServices:[service(),service(vehicleB,driverB),{...service(),driverId:driverB}]};
 const screen=view.compile('../src/screens/driver-home.tsx',{...common,useAccount:()=>({session:{state:'ACTIVE',user:{id:driverA,role:'DRIVER',operatingModel:'COMPANY_DRIVER'}}}),useAccountQuery:path=>{paths.push(path);return{data:{vehicles:[truck],canPublish:false},error:'',reload:async()=>{}};},useCapacityLocation:()=>({busy:false,error:'',shareLocation(){}}),RegularService:'RegularService',CapacityEditor:'CapacityEditor'}).DriverHome;
 const tree=view.render(screen);assert.equal(find(tree,'TrackingMap').props.regular.length,1);assert.deepEqual(find(tree,'TrackingMap').props.regular[0].places,service().route);assert.ok(!nodes(tree).some(node=>node.type==='Pressable'&&node.props.accessibilityLabel==='Usual routes'));assert.deepEqual(paths,['/api/mobile/capacity']);
});

test('Home discards an open regular editor when the active driver assignment changes',()=>{
 const view=renderer(),truck={id:vehicleA,driverId:driverA,driver:'Assigned driver',label:'Assigned truck',plate:'LOCAL',canLocate:false,location:{coordinate:[38.7,9],radius:20,area:'Adama',updatedAt:'2026-10-13'},current:null,regularServices:[service()]};
 const screen=view.compile('../src/screens/driver-home.tsx',{...common,useAccount:()=>({session:{state:'ACTIVE',user:{id:driverA,role:'DRIVER',operatingModel:'OWNER_OPERATOR',currentDriverId:driverA,currentDrivenVehicleId:vehicleA}}}),useAccountQuery:()=>({data:{vehicles:[truck],canPublish:true},error:'',reload:async()=>{}}),useCapacityLocation:()=>({busy:false,error:'',shareLocation(){}}),RegularService:'RegularService',CapacityEditor:'CapacityEditor'}).DriverHome;
 let tree=view.render(screen);find(tree,'Pressable',node=>node.props.accessibilityLabel==='Manage usual routes').props.onPress();tree=view.render(screen);assert.equal(find(tree,'RegularService').props.expectedDriverId,driverA);assert.equal(find(tree,'Modal').props.visible,true);
 truck.driverId=driverB;tree=view.render(screen);assert.equal(find(tree,'RegularService'),undefined,'a new active pair must not inherit the previous open editor');assert.equal(find(tree,'Modal'),undefined);assert.equal(find(tree,'TrackingMap'),undefined,'a stale session cannot display the new driver’s job as the owner’s own');assert.ok(find(tree,'Copy',node=>node.props.message==='Choose the vehicle you drive in Fleet.'));
});

test('selected fleet capacity exposes Usual routes only for the selected assigned pair and an owner',()=>{
 const view=renderer();let operatingModel='FLEET_OWNER';
 const truck=(id,driverId)=>({id,driverId,driver:driverId?'Assigned driver':'',label:'Fleet truck',plate:'LOCAL',canLocate:false,current:null,location:null,regularServices:[service(id,driverId)]});
 let vehicles=[truck(vehicleA,driverA),truck(vehicleB,driverB)];
 const screen=view.compile('../src/screens/manage-capacity.tsx',{...common,RegularService:'RegularService',ProfileSetup:'ProfileSetup',useAccount:()=>({session:{state:'ACTIVE',user:{id:driverA,role:operatingModel==='COMPANY_DRIVER'?'DRIVER':'TRANSPORTER',operatingModel,ownsProviderAccount:operatingModel!=='COMPANY_DRIVER',canManageFleet:operatingModel!=='COMPANY_DRIVER'}}}),useAccountQuery:()=>({data:{vehicles,canPublish:false,profilePublished:true},error:'',reload:async()=>{}}),useCapacityLocation:()=>({busy:false,error:''}),capacitySharingMode:()=> 'PUBLIC',CAPACITY_SHARING_CHOICES:[],CAPACITY_LOAD_CHOICES:[],privacyRadii:[20]}).default;
 let tree=view.render(screen,{embedded:true,vehicleId:vehicleB});
 assert.equal(find(tree,'RegularService'),undefined,'opening a vehicle does not expose a second, duplicate route editor');
 find(tree,'Pressable',node=>node.props.accessibilityLabel==='Manage usual routes').props.onPress();tree=view.render(screen,{embedded:true,vehicleId:vehicleB});
 assert.equal(find(tree,'Modal').props.visible,true);const routeEditor=find(tree,'RegularService');assert.equal(routeEditor.props.vehicleId,vehicleB);assert.equal(routeEditor.props.expectedDriverId,driverB);
 assert.equal(find(tree,'AppLink',node=>node.props.href==='/regular-service'),undefined,'the fleet entry cannot open an unscoped editor');
 find(tree,'Pressable',node=>node.props.accessibilityLabel==='Close capacity editor').props.onPress();tree=view.render(screen,{embedded:true,vehicleId:vehicleB});operatingModel='COMPANY_DRIVER';tree=view.render(screen,{embedded:true,vehicleId:vehicleB});assert.equal(find(tree,'RegularService'),undefined,'assigned company drivers retain location/duty controls without regular mutations');assert.equal(find(tree,'Pressable',node=>node.props.accessibilityLabel==='Manage usual routes'),undefined);find(tree,'Pressable',node=>node.props.accessibilityLabel==='Update duty status').props.onPress();tree=view.render(screen,{embedded:true,vehicleId:vehicleB});assert.equal(find(tree,'Modal').props.visible,true);assert.ok(find(tree,'Pressable',node=>node.props.accessibilityLabel==='Close capacity editor'));
 operatingModel='FLEET_OWNER';vehicles=[truck(vehicleB,'')];tree=view.render(screen,{embedded:true,vehicleId:vehicleB});assert.equal(find(tree,'RegularService'),undefined,'an unassigned truck cannot own a new regular route');
});

test('Account settings has no provider-wide regular editor while preserving the profile and documents',()=>{
 const view=renderer(),screen=view.compile('../src/screens/account-settings.tsx',{...common,useAccount:()=>({session:{state:'ACTIVE',user:{id:driverA,role:'TRANSPORTER',name:'Local provider'},access:{granted:true}},busy:false}),hasWorkspace:()=>true,accountSections:()=>['PROFILE'],Profile:'Profile',RegularService:'RegularService',Documents:'Documents',AccountDetails:'AccountDetails',Security:'Security',DriverPhoto:'DriverPhoto'}).default;
 let tree=view.render(screen);assert.equal(find(tree,'RegularService'),undefined);assert.equal(find(tree,'Profile'),undefined);find(tree,'WorkspaceAction',node=>node.props.message==='Transporter profile').props.onPress();tree=view.render(screen);assert.ok(find(tree,'Profile'));find(tree,'WorkspaceTaskHeader').props.onBack();tree=view.render(screen);find(tree,'WorkspaceAction',node=>node.props.message==='Provider documents').props.onPress();tree=view.render(screen);assert.ok(find(tree,'Documents'));
});

test('profile editor omits stale Services from the UI and from its saved command',async()=>{
 const view=renderer(),requests=[],profile={headline:'Local headline',about:'Authored About',services:'Legacy services must stay stored',basePlaceRef:'Adama',basePlaceLabel:'Adama',baseRegionCode:'AMHARA',contactPhone:'',contactWhatsapp:'',contactEmail:'',contactWebsite:'',showContactPhone:false,showContactWhatsapp:false,showContactEmail:false,showContactWebsite:false,published:true},workspace={profile,regions:[],name:'Local provider',handle:'local-provider',imageUrl:'',customImage:false};
 const screen=view.compile('../src/screens/profile.tsx',{...common,apiOrigin:'https://local.test',useAccount:()=>({session:{user:{id:driverA}},request:async(path,body)=>{requests.push({path,body});return workspace;}}),useAccountQuery:()=>({data:workspace,error:'',loading:false}),useFileSelection:()=>({file:null,setFile(){}}),PrivateFile:'PrivateFile',FilePicker:'FilePicker',uploadBody(){},Alert:{alert(){}}}).default;
 let tree=view.render(screen);assert.equal(find(tree,'Field',node=>node.props.message==='Transport services'),undefined);find(tree,'Button',node=>node.props.message==='Edit transporter profile').props.onPress();tree=view.render(screen);find(tree,'Field',node=>node.props.message==='About your business').props.onChangeText('Updated authored About');tree=view.render(screen);find(tree,'Button',node=>node.props.message==='Save transporter profile').props.onPress();await settle();assert.equal(requests[0].body.about,'Updated authored About');assert.equal(Object.hasOwn(requests[0].body,'services'),false);assert.equal(Object.hasOwn(requests[0].body,'basePlaceLabel'),false);
});


test('selected Fleet capacity keeps its map in first use and provides four focused owner tasks',()=>{
 const view=renderer(),pauses=[],truck={id:vehicleA,driverId:driverA,driver:'Assigned driver',label:'Fleet truck',plate:'LOCAL',configuration:'Box truck',canLocate:true,canSetManualLocation:true,location:null,current:null,regularServices:[]};
 const screen=view.compile('../src/screens/manage-capacity.tsx',{...common,RegularService:'RegularService',ProfileSetup:'ProfileSetup',useAccount:()=>({session:{state:'ACTIVE',user:{id:driverA,role:'TRANSPORTER',ownsProviderAccount:true,canManageFleet:true}}}),useAccountQuery:()=>({data:{vehicles:[truck],canPublish:true,profilePublished:false},error:'',reload:async()=>{}}),useCapacityLocation:(_truck,paused)=>{pauses.push(paused);return{busy:false,error:''};},capacitySharingMode:()=> 'PUBLIC',CAPACITY_SHARING_CHOICES:[],CAPACITY_LOAD_CHOICES:[],privacyRadii:[20]}).default;
 let tree=view.render(screen,{embedded:true,vehicleId:vehicleA,active:false});assert.equal(pauses.at(-1),true);
 let map=find(tree,'TrackingMap');assert.ok(map,'first use still renders the map');assert.equal(map.props.fill,true);assert.equal(map.props.location,null,'no device fix is invented');assert.equal(map.props.vehicleConfiguration,'Box truck');assert.equal(map.props.regular.length,0);assert.ok(find(tree,'Text',node=>node.props.children?.includes?.('No signal on the map yet')));assert.equal(find(tree,'ProfileSetup'),undefined,'account setup does not leak into a vehicle task');
 for(const label of ['Update capacity','Update sharing settings','Manage usual routes','Set vehicle location'])assert.ok(find(tree,'Pressable',node=>node.props.accessibilityLabel===label),`${label} is reachable from the map`);
 assert.equal(find(tree,'Field'),undefined,'opening Fleet does not start editing');
 tree=view.render(screen,{embedded:true,vehicleId:vehicleA,active:true});assert.equal(pauses.at(-1),false);
 find(tree,'Pressable',node=>node.props.accessibilityLabel==='Update capacity').props.onPress();tree=view.render(screen,{embedded:true,vehicleId:vehicleA,active:true});assert.equal(find(tree,'Modal').props.visible,true);assert.ok(find(tree,'TrackingMap'),'the selected map stays mounted underneath the editor');assert.ok(find(tree,'Button',node=>node.props.message==='Save capacity'));assert.ok(find(tree,'Pressable',node=>node.props.accessibilityLabel==='Close capacity editor'));
 for(const heading of ['Availability','Load type','Where is this vehicle available?'])assert.ok(find(tree,'Text',node=>node.props.children===heading||(Array.isArray(node.props.children)&&node.props.children.includes(heading))),`${heading} gives the capacity task a clear place in the workflow`);
 for(const icon of ['truck','boxes','route'])assert.ok(find(tree,'AppIcon',node=>node.props.name===icon),`${icon} identifies a capacity section`);
 find(tree,'Pressable',node=>node.props.accessibilityLabel==='Close capacity editor').props.onPress();tree=view.render(screen,{embedded:true,vehicleId:vehicleA,active:true});assert.equal(find(tree,'Modal').props.visible,false);assert.ok(find(tree,'TrackingMap'));
});

test('saved capacity geometry stays on the owner map and sharing opens only its own editor',()=>{
 const view=renderer(),route=[place('Adama'),place('Addis Ababa')],current={status:'EMPTY',visibility:'PRIVATE',sharingMode:'PRIVATE',exclusiveEmail:'',exclusiveName:'',updatedAt:'2026-10-20T12:00:00Z',acceptedLoads:'FTL',availabilityGeometry:'ROUTE',route,boundary:[],areaCenter:place('Adama'),acceptsMultiPick:false,acceptsMultiDrop:false};
 const truck={id:vehicleA,driverId:driverA,driver:'Assigned driver',label:'Fleet truck',plate:'LOCAL',configuration:'Box truck',canLocate:false,location:null,current,regularServices:[]};
 const screen=view.compile('../src/screens/manage-capacity.tsx',{...common,RegularService:'RegularService',ProfileSetup:'ProfileSetup',useAccount:()=>({session:{state:'ACTIVE',user:{id:driverA,role:'TRANSPORTER',ownsProviderAccount:true,canManageFleet:true}}}),useAccountQuery:()=>({data:{vehicles:[truck],canPublish:true,profilePublished:true},error:'',reload:async()=>{}}),useCapacityLocation:()=>({busy:false,error:''}),capacitySharingMode:()=> 'PRIVATE',CAPACITY_SHARING_CHOICES:[['PRIVATE','Private']],CAPACITY_LOAD_CHOICES:[],privacyRadii:[20]}).default;
 let tree=view.render(screen,{embedded:true,vehicleId:vehicleA,active:true});let map=find(tree,'TrackingMap');assert.deepEqual(map.props.coverage.places,route);assert.equal(map.props.coverage.partial,false);assert.ok(find(tree,'Pressable',node=>node.props.accessibilityLabel==='Update sharing settings').props.disabled===false);
 find(tree,'Pressable',node=>node.props.accessibilityLabel==='Update sharing settings').props.onPress();tree=view.render(screen,{embedded:true,vehicleId:vehicleA,active:true});assert.equal(find(tree,'Modal').props.visible,true);assert.ok(find(tree,'Button',node=>node.props.message==='Save sharing settings'));assert.equal(find(tree,'Text',node=>node.props.children==='Availability'||(Array.isArray(node.props.children)&&node.props.children.includes('Availability'))),undefined,'the Sharing task does not repeat Capacity controls');assert.ok(find(tree,'TrackingMap'),'saved geometry stays mounted beneath the focused task');
});
