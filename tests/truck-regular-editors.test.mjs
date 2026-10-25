import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {capacityLocationSource,selectedCapacityLocation} from '../src/lib/capacity-location-selection.js';
import {locationSourceLabel} from '../src/lib/location-source.js';
import {errorMessage} from '../src/lib/errors.ts';

function renderer(){
 const stores=new Map();let slots=[],cursor=0;
 const React={createElement:(type,props,...children)=>({type,key:props?.key,props:{...props,children:children.flat(Infinity)}}),Fragment:'Fragment'};
 const hooks={useState:initial=>{const state=slots,index=cursor++;if(!(index in state))state[index]=typeof initial==='function'?initial():initial;return[state[index],value=>{state[index]=typeof value==='function'?value(state[index]):value;}];},useRef:initial=>{const index=cursor++;return slots[index]||(slots[index]={current:initial});},useMemo:compute=>compute(),useCallback:value=>value,useEffect(){},useTransition:()=>[false,callback=>callback()]};Object.assign(React,hooks);
 function compile(path,values){const parsed=ts.createSourceFile(path,readFileSync(new URL(path,import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),source=ts.createPrinter().printFile(ts.factory.updateSourceFile(parsed,parsed.statements.filter(node=>!ts.isImportDeclaration(node)))),code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText,exports={};const args={React,...hooks,...values};new Function(...Object.keys(args),'exports',code)(...Object.values(args),exports);return exports;}
 function resolve(tree,path='root'){if(Array.isArray(tree))return tree.map((child,index)=>resolve(child,`${path}/${index}`));if(!tree||typeof tree!=='object')return tree;if(typeof tree.type==='function'){const id=`${path}:${tree.type.name}:${tree.key||''}`;slots=stores.get(id)||[];stores.set(id,slots);cursor=0;return resolve(tree.type(tree.props),`${id}/content`);}return{...tree,props:{...tree.props,children:resolve(tree.props.children,`${path}/children`)}};}
 return{compile,resolve,render:(component,props)=>resolve(React.createElement(component,props))};
}
const nodes=tree=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];
const find=(tree,type,match=()=>true)=>nodes(tree).find(node=>node.type===type&&match(node));
const vehicleA='11111111-1111-4111-8111-111111111111',vehicleB='22222222-2222-4222-8222-222222222222',driverA='33333333-3333-4333-8333-333333333333',driverB='44444444-4444-4444-8444-444444444444';
const point=label=>({place_ref:label,label,lat:9,lng:38.7});
test('preferred corridor denials name the saved preference and its recovery action',()=>{
 for(const code of ['CORRIDOR_ALREADY_EXISTS','CAPACITY_ROUTE_ALREADY_EXISTS','REGULAR_CAPACITY_LIMIT','REGULAR_TRUCK_DRIVER_REQUIRED','SUPABASE_PROVIDER_REGULAR_CAPACITY_ADD_FAILED','SUPABASE_PROVIDER_REGULAR_CAPACITY_REMOVE_FAILED']){
  const message=errorMessage(Error(code));assert.match(message,/preferred corridor/i,code);assert.doesNotMatch(message,/usual routes|regular service|regular capacity route/i,code);
 }
 assert.match(errorMessage(Error('REGULAR_CAPACITY_LIMIT')),/Edit or remove it first/);
 assert.match(errorMessage(Error('REGULAR_TRUCK_DRIVER_REQUIRED')),/Open Preferred corridor from your vehicle/);
});
const corridor=(vehicle_id=vehicleA,driver_user_id=driverA)=>({id:vehicle_id,vehicle_id,driver_user_id,geometry:'ROUTE',route_points:[point('Adama'),point('Addis Ababa')],area_boundary:[]});
const vehicle=(id=vehicleA,driverId=driverA)=>({id,label:id,make:'Local',model:'Truck',cargoConfiguration:'Cargo van',plate:'LOCAL',driver:driverId?{id:driverId,name:'Assigned driver'}:null,driverLocation:{lat:9,lng:38.7,radius:20,area:'Adama',updatedAt:'2026-10-13'},current:{status:'EMPTY',availability_geometry:'ROUTE',current_route_points:[point('Adama'),point('Addis Ababa')]}});
const hosts=Object.fromEntries(['Text','Localized','Image','Link','Boxes','Gauge','MapPinned','RefreshCw','Repeat2','Route','Save','Shield','Truck','CircleDotDashed','MapPin','Plus','Trash2','CapacityLocationMap','CapacityMarketPlanning','CapacityEditDialog','CapacitySignalEditor','EthiopiaPlaceInput','SubjectDocuments','PageHeader','Flash','AlignLeft','Building2','Eye','ExternalLink','ImageIcon','Mail','MessageCircle','MessageSquare','Phone','Upload'].map(name=>[name,name]));
const common={...hosts,PublicIdentityImage:'PublicIdentityImage',WorkspaceTaskDialog:'WorkspaceTaskDialog',PublicHandleInput:'PublicHandleInput',styles:new Proxy({},{get:(_target,key)=>key}),useTranslation:()=>({t:value=>value}),useRouter:()=>({refresh(){}}),capacitySharingLabel:value=>value,capacitySharingMode:()=> 'PUBLIC',capacityLocationSource,selectedCapacityLocation,locationSourceLabel,vehicleConfigurationImage:()=>'/truck.jpg',capacityPrivacyRadii:()=>[20],relativeTime:()=> 'Today',capacityLoadPreference:()=> 'FTL',capacityLoadLabel:value=>value,readDriverLocation:async()=>{},saveDriverLocation:async()=>{}};

test('web selected truck regular map and editor ignore provider-wide and other-pair routes',()=>{
 const view=renderer(),component=view.compile('../src/components/capacity-form.tsx',common).CapacityForm,props={vehicles:[vehicle(),vehicle(vehicleB,driverB)],corridors:[{...corridor(),vehicle_id:undefined,driver_user_id:undefined,id:'legacy'},corridor(vehicleA,driverB),corridor(),corridor(vehicleB,driverB)],allowCorridors:true,renderedAt:1};
 let tree=view.render(component,props);assert.deepEqual(find(tree,'CapacityLocationMap').props.regularSignals,[corridor()]);find(tree,'button',node=>node.props['aria-label']?.startsWith('Edit preferred corridor:')).props.onClick();tree=view.render(component,props);let editor=find(tree,'CapacityMarketPlanning');assert.equal(editor.props.vehicleId,vehicleA);assert.equal(editor.props.expectedDriverId,driverA);assert.deepEqual(editor.props.corridors,[corridor()]);
 find(tree,'select',node=>node.props.id==='capacity-vehicle').props.onChange({target:{value:vehicleB}});tree=view.render(component,props);assert.deepEqual(find(tree,'CapacityLocationMap').props.regularSignals,[corridor(vehicleB,driverB)]);editor=find(tree,'CapacityMarketPlanning');assert.equal(editor.props.vehicleId,vehicleB);assert.equal(editor.props.expectedDriverId,driverB);assert.deepEqual(editor.props.corridors,[corridor(vehicleB,driverB)]);
 const unassigned=view.render(component,{...props,vehicles:[vehicle(vehicleA,'')]});assert.equal(find(unassigned,'CapacityMarketPlanning'),undefined);assert.deepEqual(find(unassigned,'CapacityLocationMap').props.regularSignals,[]);
});

test('web regular save and remove forms bind the same truck and driver and never reuse legacy IDs',()=>{
 const view=renderer(),component=view.compile('../src/components/capacity-market-planning.tsx',{...common,submitCapacityForm:async()=>{}}).CapacityMarketPlanning;
 const props={vehicleId:vehicleA,expectedDriverId:driverA,corridors:[{...corridor(),vehicle_id:undefined,driver_user_id:undefined,id:'legacy'},corridor(vehicleB,driverB),corridor()],returnTo:'/app/home',onBusyChange(){},onSaved(){},onRemoved(){},onCancel(){}};
 const tree=view.render(component,props),forms=nodes(tree).filter(node=>node.type==='form');assert.equal(forms.length,2);
 for(const form of forms){const values=Object.fromEntries(nodes(form).filter(node=>node.type==='input'&&node.props.type==='hidden').map(node=>[node.props.name,node.props.value]));assert.equal(values.vehicleId,vehicleA);assert.equal(values.expectedDriverId,driverA);assert.equal(values.id,vehicleA);assert.equal(values.returnTo,'/app/home');}
});

test('web profile editor omits retired Services while retaining authored About and contact controls',async()=>{
 const view=renderer(),component=view.compile('../src/components/provider-profile-workspace.tsx',{...common,redirect(){throw new Error('Unexpected redirect');},getOwnCompanyPage:async()=>({name:'Local provider',handle:'local-provider',services:'Legacy service text',about:'Authored About',profile_image_url:'',city:'Adama'}),getVerificationCenter:async()=>({subjects:[]}),PROVIDER_REGIONS:[],privateUploadMaxMebibytes:()=>5}).ProviderProfileWorkspace;
 const tree=view.resolve(await component({user:{id:driverA,organization_id:vehicleA,provider_handle:'local-provider'},embedded:true})),inputs=nodes(tree).filter(node=>node.props?.name);
 assert.equal(inputs.find(node=>node.props.name==='services'),undefined);assert.equal(inputs.find(node=>node.props.name==='about').props.defaultValue,'Authored About');for(const name of ['contactPhone','contactWhatsapp','contactEmail','contactWebsite','published'])assert.ok(inputs.find(node=>node.props.name===name),name);
});
