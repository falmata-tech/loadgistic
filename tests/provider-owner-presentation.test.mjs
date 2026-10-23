import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {workspaceCapabilities} from '../apps/mobile/src/navigation/destinations.ts';
import {accountSections,hasWorkspace,activeDestination,isWorkspace,publicDestinations,workspaceDestinations,workspaceRoleLabel} from '../apps/mobile/src/navigation/destinations.ts';
import {fleetDriverEditorKey} from '../apps/mobile/src/navigation/current-driving-pair.ts';
import {providerWorkspaceCapabilities} from '../src/lib/provider-workspace.js';
import {paginateResults} from '../src/lib/pagination.js';
import {capacityLocationSource,selectedCapacityLocation} from '../src/lib/capacity-location-selection.js';
import {locationSourceLabel} from '../src/lib/location-source.js';

// Run the actual presentation/submit handlers. Database authority, HTTP adapters,
// native rendering and browser pixels have their own focused checks.
function runtime(){
 const stores=new Map();let slots=[],cursor=0;
 const React={createElement:(type,props,...children)=>({type,key:props?.key,props:{...props,children:children.flat(Infinity)}}),Fragment:'Fragment'};
 const hooks={useState:initial=>{const state=slots,index=cursor++;if(!(index in state))state[index]=typeof initial==='function'?initial():initial;return[state[index],value=>{state[index]=typeof value==='function'?value(state[index]):value;}];},useRef:initial=>{const index=cursor++;return slots[index]||(slots[index]={current:initial});},useMemo:compute=>compute(),useEffect(){},useId:()=> 'scoped-field'};
 Object.assign(React,hooks);
 const hosts=Object.fromEntries(['Localized','Text','View','Pressable','AppIcon','Button','Copy','ErrorText','Link','KeyRound','ShieldCheck','BadgeCheck','Truck','Page','Title','Card','Field','ActivityIndicator','Image','Modal','ScrollView','Switch','SafeAreaView','Redirect','WorkspaceSection','WorkspaceTabs','WorkspaceTaskHeader','WorkspaceFact','WorkspaceAction','TruckControls','Documents','CapacityManagement','VehicleLifecycle','DriverContact','TrailerSetup','FleetInvitation','PublicCapacityMap','FleetDevices','TruckLocationSource','CapacityLocationMap','LocateFixed','Power','PowerOff','CapacityForm'].map(name=>[name,name]));
 const common={React,...hooks,...hosts,workspaceCapabilities,fleetDriverEditorKey,palette:{ink:'#0b1d3a',blue:'#155eef',muted:'#526375',border:'#cbd5e1'},apiOrigin:'http://local.test',StyleSheet:{create:value=>value},useLanguage:()=>({t:(message,values={})=>message.replace(/\{(\w+)\}/g,(match,key)=>String(values[key]??match))}),styles:new Proxy({},{get:(_value,key)=>key})};
 function compile(path,ports={}){const file=readFileSync(path,'utf8'),parsed=ts.createSourceFile(path,file,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),source=ts.createPrinter().printFile(ts.factory.updateSourceFile(parsed,parsed.statements.filter(node=>!ts.isImportDeclaration(node)))),code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText,exports={},args={...common,...ports};if(/\bconst styles\s*=/.test(source))delete args.styles;new Function(...Object.keys(args),'exports',code)(...Object.values(args),exports);return exports;}
 function resolve(tree,path='root'){if(Array.isArray(tree))return tree.map((child,index)=>resolve(child,`${path}/${index}`));if(!tree||typeof tree!=='object')return tree;if(typeof tree.type==='function'){const key=`${path}:${tree.type.name}:${tree.key||''}`;slots=stores.get(key)||[];stores.set(key,slots);cursor=0;return resolve(tree.type(tree.props),`${key}/children`);}return{...tree,props:{...tree.props,children:resolve(tree.props.children,`${path}/children`)}};}
 common.WorkspaceTaskPane=compile('apps/mobile/src/components/workspace-task.tsx',{useEffect:callback=>callback()}).WorkspaceTaskPane;
 return{compile,render:(component,props={})=>resolve(React.createElement(component,props))};
}
const nodes=value=>!value||typeof value!=='object'?[]:Array.isArray(value)?value.flatMap(nodes):[value,...nodes(value.props?.children)];
const find=(tree,type,match=()=>true)=>nodes(tree).find(node=>node.type===type&&match(node));
const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
const publication={canPublish:false,liveTruckCount:1,qualifyingTruckCount:0,qualifyingOwnershipCount:0,qualifyingLicenceCount:0};
const blank={verified:false,reviewedAt:null,expiresOn:null};

test('web permits one unreviewed Live truck, gates additional trucks and keeps withdrawal available after qualification loss',()=>{
 const view=runtime(),ui=view.compile('src/components/truck-authority.tsx');
 let tree=view.render(ui.TruckPublicationControl,{vehicleId:'truck',state:'DRAFT',publication}),button=find(tree,'button');
 assert.equal(button.props.disabled,true);assert.equal(find(tree,'form').props.action,'/api/fleet/vehicles/truck/publication');assert.equal(find(tree,'input',node=>node.props.name==='state').props.value,'LIVE');
 tree=view.render(ui.TruckPublicationControl,{vehicleId:'truck',state:'DRAFT',publication:{...publication,canPublish:true,liveTruckCount:0}});assert.equal(find(tree,'button').props.disabled,false);
 tree=view.render(ui.TruckPublicationControl,{vehicleId:'truck',state:'LIVE',publication});assert.equal(find(tree,'button').props.disabled,false);assert.equal(find(tree,'input',node=>node.props.name==='state').props.value,'DRAFT');assert.ok(find(tree,'Text',node=>node.props.message==='Capacity follows the sharing settings you choose.'));
 tree=view.render(ui.TruckPublicationControl,{vehicleId:'truck',state:'LIVE',publication:{...publication,liveTruckCount:2}});assert.equal(find(tree,'button').props.disabled,false);assert.ok(find(tree,'Text',node=>node.props.message==='Visibility is paused. Keep one vehicle live or complete verification.'));
 tree=view.render(ui.TruckPublicationControl,{vehicleId:'truck',state:'DRAFT',publication:{...publication,canPublish:true,qualifyingTruckCount:1}});assert.equal(find(tree,'button').props.disabled,false);
});
test('truck badges follow reviewed facts rather than declared use, and financing never claims ownership',()=>{
 const view=runtime(),ui=view.compile('src/components/truck-authority.tsx');
 let tree=view.render(ui.TruckAuthorityBadges,{authority:{ownership:blank,permission:blank,operatingLicence:{...blank,holderBasis:'FINANCED'},useBasis:'OWNED'}});assert.ok(find(tree,'Text',node=>node.props.message==='Not yet verified. Confirm details directly.'));assert.equal(find(tree,'Text',node=>node.props.message==='Ownership verified'),undefined);
 tree=view.render(ui.TruckAuthorityBadges,{authority:{ownership:blank,permission:blank,operatingLicence:{verified:true,reviewedAt:'2026-10-14',expiresOn:'2027-10-14',holderBasis:'FINANCED'}}});assert.ok(find(tree,'Text',node=>node.props.message==='Financed · licence reviewed'));assert.equal(find(tree,'Text',node=>node.props.message==='Ownership verified'),undefined);
 tree=view.render(ui.TruckAuthorityBadges,{authority:{ownership:{...blank,verified:true},permission:{...blank,verified:true},operatingLicence:blank}});assert.ok(find(tree,'Text',node=>node.props.message==='Ownership verified'));assert.ok(find(tree,'Text',node=>node.props.message==='Permission verified'));
});
test('profile summary consumes full authoritative counts and does not add financing twice',()=>{
 const view=runtime(),ui=view.compile('src/components/truck-authority.tsx'),summary={total:7,ownershipVerified:2,operatingLicenceVerified:2,permissionVerified:1,notYetVerified:2,financedVerified:1};
 const tree=view.render(ui.ProviderTruckSummary,{summary});assert.equal(find(tree,'Text',node=>node.props.message==='{count} vehicles').props.values.count,7);
 assert.deepEqual(nodes(tree).filter(node=>node.type==='Text'&&node.props.values).map(node=>node.props.values.count),[7,2,2,1,2]);assert.equal(view.render(ui.ProviderTruckSummary,{}),null);
});
test('native publication waits for the exact saved operation and cannot duplicate an in-flight write',async()=>{
 const view=runtime(),writes=[];let release;const pending=new Promise(resolve=>{release=resolve;});let reloads=0;
 const ui=view.compile('apps/mobile/src/components/truck-authority.tsx',{useAccount:()=>({request:async(path,body)=>{writes.push({path,body});await pending;}})});
 const props={vehicleId:'truck',state:'DRAFT',publication:{...publication,canPublish:true,qualifyingTruckCount:1},onSaved:async()=>{reloads++;}};
 let tree=view.render(ui.TruckPublicationControl,props);find(tree,'Button').props.onPress();find(tree,'Button').props.onPress();assert.deepEqual(writes,[{path:'/api/mobile/fleet/publication',body:{vehicleId:'truck',state:'LIVE'}}]);assert.equal(reloads,0);release();await settle();assert.equal(reloads,1);
 tree=view.render(ui.TruckPublicationControl,{...props,state:'LIVE',publication});assert.equal(find(tree,'Button').props.disabled,false);find(tree,'Button').props.onPress();await settle();assert.equal(writes[1].body.state,'DRAFT');
});
test('native publication distinguishes the single unreviewed truck from a paused unverified fleet',()=>{
 const view=runtime(),ui=view.compile('apps/mobile/src/components/truck-authority.tsx',{useAccount:()=>({request:async()=>{}})}),props={vehicleId:'truck',onSaved:async()=>{}};
 let tree=view.render(ui.TruckPublicationControl,{...props,state:'DRAFT',publication:{...publication,canPublish:true,liveTruckCount:0}});assert.equal(find(tree,'Button').props.disabled,false);
 tree=view.render(ui.TruckPublicationControl,{...props,state:'DRAFT',publication});assert.equal(find(tree,'Button').props.disabled,true);
 tree=view.render(ui.TruckPublicationControl,{...props,state:'LIVE',publication});assert.equal(find(tree,'Button').props.disabled,false);assert.equal(find(tree,'Copy').props.message,'Capacity follows the sharing settings you choose.');
 tree=view.render(ui.TruckPublicationControl,{...props,state:'LIVE',publication:{...publication,liveTruckCount:2}});assert.equal(find(tree,'Button').props.disabled,false);assert.equal(find(tree,'Copy').props.message,'Visibility is paused. Keep one vehicle live or complete verification.');
 const badge=view.render(ui.TruckAuthorityBadges,{authority:{ownership:blank,permission:blank,operatingLicence:blank}});assert.ok(nodes(badge).some(node=>node.type==='Text'&&node.props.children?.includes('Not yet verified. Confirm details directly.')));
});
test('native publication denial remains an error and does not claim the truck went live',async()=>{
 const view=runtime();let reloads=0;const ui=view.compile('apps/mobile/src/components/truck-authority.tsx',{useAccount:()=>({request:async()=>{throw Error('Provider verification is required.');}})}),props={vehicleId:'truck',state:'DRAFT',publication:{...publication,canPublish:true,qualifyingTruckCount:1},onSaved:async()=>{reloads++;}};
 let tree=view.render(ui.TruckPublicationControl,props);find(tree,'Button').props.onPress();await settle();tree=view.render(ui.TruckPublicationControl,props);assert.equal(find(tree,'ErrorText').props.message,'Provider verification is required.');assert.equal(find(tree,'Button').props.message,'Go live');assert.equal(reloads,0);
});
test('native fleet adds a financed Draft without silently choosing it as the owner driving truck',async()=>{
 const view=runtime(),writes=[],account={session:{state:'ACTIVE',user:{id:'owner',role:'DRIVER',operatingModel:'SELF_MANAGED_DRIVER',ownsProviderAccount:true,canManageFleet:true,drivesTruck:true},access:{granted:true}},request:async(path,body)=>writes.push({path,body})};
 const data={canManage:true,canAddTruck:true,canManageDrivers:true,singleTruck:false,publication,vehicles:[],drivers:[],retired:[],invitations:[],configurations:[{name:'Pickup truck',image:'/pickup.jpg'}],driverPage:1,driverPageCount:1,retiredPage:1,retiredPageCount:1};
 const screen=view.compile('apps/mobile/src/screens/fleet.tsx',{useAccount:()=>account,useAccountQuery:()=>({data,error:'',reload:async()=>{},reloadConfirmed:async()=>true}),ProviderPublicationNotice:'ProviderPublicationNotice',TruckAuthorityBadges:'TruckAuthorityBadges',TruckPublicationControl:'TruckPublicationControl'}).default;
 let tree=view.render(screen);
 find(tree,'Button',node=>node.props.message==='Add vehicle').props.onPress();
 tree=view.render(screen);
 assert.equal(find(tree,'Button',node=>node.props.message==='Add vehicle').props.disabled,true);
 find(tree,'Button',node=>node.props.message==='I am buying this vehicle through financing').props.onPress();
 find(tree,'Field',node=>node.props.message==='Make').props.onChangeText('Make');
 find(tree,'Field',node=>node.props.message==='Model').props.onChangeText('Model');
 find(tree,'Field',node=>node.props.message==='Plate').props.onChangeText('Plate');
 find(tree,'Button',node=>node.props.label==='Choose vehicle type').props.onPress();
 tree=view.render(screen);
 assert.equal(find(tree,'Modal').props.visible,true);
 find(tree,'Pressable',node=>node.key==='Pickup truck').props.onPress();
 tree=view.render(screen);
 assert.equal(find(tree,'Modal').props.visible,false);
 find(tree,'Button',node=>node.props.message==='Add vehicle').props.onPress();
 await settle();
 assert.equal(writes.length,1);assert.equal(writes[0].body.action,'ADD_TRUCK');assert.equal(writes[0].body.useBasis,'FINANCED');assert.equal(writes[0].body.cargoConfiguration,'Pickup truck');assert.equal('driverId'in writes[0].body,false);assert.equal('state'in writes[0].body,false);
});
test('native self-assignment preserves owner authority and omits employee removal controls',async()=>{
 const view=runtime(),writes=[],account={session:{state:'ACTIVE',user:{id:'owner',role:'TRANSPORTER',ownsProviderAccount:true,canManageFleet:true,drivesTruck:true},access:{granted:true}},request:async(path,body)=>writes.push({path,body})};
 const data={canManage:true,canAddTruck:true,canManageDrivers:true,singleTruck:false,publication,vehicles:[{id:'truck',make:'Make',model:'Model',configuration:'Pickup truck',image:'/pickup.jpg',publicationState:'DRAFT'}],drivers:[{id:'owner',isOwner:true,name:'Owner',phone:'phone',email:'owner@example.test',vehicleId:'truck',canManageCapacity:false,canManageTracking:false}],retired:[],invitations:[],configurations:[],driverPage:1,driverPageCount:1,retiredPage:1,retiredPageCount:1};
 const screen=view.compile('apps/mobile/src/screens/fleet.tsx',{useAccount:()=>account,useAccountQuery:()=>({data,error:'',reload:async()=>{},reloadConfirmed:async()=>true}),ProviderPublicationNotice:'ProviderPublicationNotice',TruckAuthorityBadges:'TruckAuthorityBadges',TruckPublicationControl:'TruckPublicationControl'}).default;
 let tree=view.render(screen);find(tree,'WorkspaceTabs').props.onChange('DRIVERS');tree=view.render(screen);find(tree,'Pressable',node=>node.props.accessibilityLabel==='Manage driver: Owner').props.onPress();tree=view.render(screen);find(tree,'Button',node=>node.props.message==='Edit assignment and access').props.onPress();tree=view.render(screen);assert.equal(find(tree,'DriverContact'),undefined);assert.equal(find(tree,'Switch',node=>node.props.accessibilityLabel==='Driver can update capacity'),undefined);find(tree,'Button',node=>node.props.message==='Save assignment and access').props.onPress();await settle();assert.deepEqual(writes,[{path:'/api/mobile/fleet',body:{action:'ASSIGN_DRIVER',driverId:'owner',vehicleId:'truck',canManageCapacity:true,canManageTracking:true}}]);
});
test('web driving-owner Home selects their exact driver assignment while fleet-only owners retain the fleet Home',async()=>{
 const view=runtime();let user={id:'owner',active:true,role:'TRANSPORTER',organization_id:'fleet',owns_provider_account:true,can_manage_fleet:true,drives_truck:true,current_driver_id:'owner',current_driven_vehicle_id:'mine'};
 const vehicles=[{id:'employee-truck',assigned_driver:{id:'employee'}},{id:'mine',assigned_driver:{id:'owner'}}],capacities=vehicles.map(vehicle=>({vehicle_id:vehicle.id})),corridors=vehicles.map(vehicle=>({vehicle_id:vehicle.id}));
 const screen=view.compile('src/app/app/home/page.tsx',{providerWorkspaceCapabilities,requireUser:async()=>user,getWorkspaceAccess:async()=>({granted:true}),getProviderCapacityWorkspace:async()=>({vehicles,capacities,corridors,access:{kind:'OWNER',can_manage_capacity:true}}),DriverCapacityHome:'DriverCapacityHome',FleetWorkspace:'FleetWorkspace',redirect(){throw Error('REDIRECT');}}).default;
 let tree=await screen({searchParams:Promise.resolve({})});assert.equal(tree.type,'DriverCapacityHome');assert.deepEqual(tree.props.vehicles.map(vehicle=>vehicle.id),['mine']);assert.deepEqual(tree.props.capacities.map(capacity=>capacity.vehicle_id),['mine']);assert.deepEqual(tree.props.corridors.map(corridor=>corridor.vehicle_id),['mine']);assert.equal(tree.props.ownsFleet,true);
 vehicles[1].assigned_driver.id='someone-else';tree=await screen({searchParams:Promise.resolve({})});assert.deepEqual(tree.props.vehicles,[],'a stale current-truck ID cannot replace proof of the current assigned driver');
 user={...user,drives_truck:false,current_driver_id:null,current_driven_vehicle_id:null};tree=await screen({searchParams:Promise.resolve({})});assert.equal(tree.type,'FleetWorkspace');
});
test('web personal-provider fleet lists multiple trucks and opens self-assignment only in its chosen task',async()=>{
 const {selectedCapacityLocation}=await import('../src/lib/capacity-location-selection.js');
 let detailError='NOT_FOUND';
 const view=runtime(),user={id:'owner',active:true,role:'DRIVER',provider_profile_id:'profile'},vehicles=[{id:'one',make:'Make',model:'One',publication_status:'DRAFT'},{id:'two',make:'Make',model:'Two',publication_status:'DRAFT'}];
 const screen=view.compile('src/components/provider-fleet-workspace.tsx',{requireUser:async()=>user,canManageProviderVehicles:()=>true,getProviderPublication:async()=>publication,getVerificationCenter:async()=>({subjects:[]}),retiredVehiclePage:async()=>({items:[],page:1,pageCount:1,total:0}),pendingFleetInvitations:async()=>[],fleetReturnPath:value=>value,getProviderCapacityWorkspace:async()=>({vehicles,capacities:[]}),getFleetDriverPage:async()=>({items:[{id:'owner',is_owner:true,name:'Owner',assigned_vehicle_id:'one',can_manage_capacity:true,can_manage_tracking:true}],page:1,pageCount:1,total:1}),getFleetDriver:async()=>{throw Error(detailError);},paginateResults,selectedCapacityLocation,relativeTime:()=>'',vehicleConfigurationImage:()=>'/truck.jpg',ProviderPublicationNotice:'ProviderPublicationNotice',PageHeader:'PageHeader',Flash:'Flash',Pagination:'Pagination',VerificationBadges:'VerificationBadges',StatusPill:'StatusPill',FleetInvitations:'FleetInvitations',FleetDriverContact:'FleetDriverContact',SubjectDocuments:'SubjectDocuments',VehicleLifecycleControl:'VehicleLifecycleControl',WorkspaceTaskDialog:'WorkspaceTaskDialog',Truck:'Truck',Eye:'Eye',KeyRound:'KeyRound',Plus:'Plus',Save:'Save',UserRound:'UserRound',Satellite:'Satellite',ArrowLeft:'ArrowLeft',ArrowRight:'ArrowRight',Check:'Check',redirect(){throw Error('Unexpected single-truck redirect');}}).FleetWorkspace;
 let tree=await screen({searchParams:Promise.resolve({})});assert.equal(nodes(tree).filter(node=>node.type==='Link'&&node.props.href?.match(/^\/app\/fleet\/(one|two)$/)).length,2);assert.equal(find(tree,'form'),undefined,'opening Fleet shows trucks, not editable driver forms');assert.equal(find(tree,'Text',node=>node.props.message==='Retired trucks'),undefined,'an empty retired-truck section is omitted');
 tree=await screen({searchParams:Promise.resolve({view:'drivers'})});assert.equal(find(tree,'form'),undefined,'the driver list is read-first');assert.equal(find(tree,'FleetInvitations').props.showAdd,false,'the contextual header owns the only Add driver action');
 tree=await screen({searchParams:Promise.resolve({view:'drivers',driver:'owner'})});assert.equal(find(tree,'FleetDriverContact'),undefined);assert.equal(find(tree,'input',node=>node.props.name==='canManageCapacity').props.value,'on');assert.equal(find(tree,'input',node=>node.props.name==='canManageTracking').props.value,'on');assert.ok(find(tree,'WorkspaceTaskDialog',node=>node.props.triggerLabel==='Edit assignment'));assert.ok(find(tree,'form',node=>node.props.action==='/api/fleet/drivers/owner/permissions'));
 tree=await screen({searchParams:Promise.resolve({view:'drivers',driver:'foreign'})});assert.ok(find(tree,'Text',node=>node.props.message==='This driver is no longer available in your fleet.'));assert.equal(find(tree,'form'),undefined);
 detailError='SUPABASE_FLEET_DRIVER_DETAIL_FAILED';tree=await screen({searchParams:Promise.resolve({view:'drivers',driver:'off-page'})});assert.ok(find(tree,'Text',node=>node.props.message==='Unable to load driver details. Try again.'));assert.equal(find(tree,'Text',node=>node.props.message==='This driver is no longer available in your fleet.'),undefined);assert.equal(find(tree,'form'),undefined);
});
test('web truck operating-licence upload asks for expiry and binds the exact truck subject',()=>{
 const view=runtime(),ui=view.compile('src/components/verification-form.tsx',{DatePicker:'DatePicker',FileCheck2:'FileCheck2',FileText:'FileText',Upload:'Upload'}),props={subjects:[{subject_type:'VEHICLE',subject_id:'truck',name:'Truck',type:'Truck',allowed_types:['VEHICLE_OPERATING_LICENSE']}]};
 const tree=view.render(ui.VerificationForm,props);assert.equal(find(tree,'input',node=>node.props.name==='relatedVehicleId').props.value,'truck');assert.equal(find(tree,'DatePicker').props.required,true);assert.ok(find(tree,'Text',node=>node.props.message==='Licence expires'));assert.ok(find(tree,'Text',node=>node.props.message==='Vehicle operating licence'));
});
test('native operating-licence submit requires expiry, retains its exact truck and never treats submission as an approved fact',async()=>{
 const view=runtime(),writes=[],subject={id:'truck',kind:'VEHICLE',name:'Truck',allowedTypes:['VEHICLE_OPERATING_LICENSE'],badges:[],pending:0,vehicles:[]};let file={uri:'local-document'};
 const ui=view.compile('apps/mobile/src/screens/documents.tsx',{DatePicker:'DatePicker',Choices:'Choices',FilePicker:'FilePicker',PrivateFile:'PrivateFile',documentSubjects:items=>items,useFileSelection:()=>({file,setFile:value=>{file=value;}}),uploadBody:(body,file)=>({...body,file}),useAccount:()=>({session:{user:{id:'owner'}},request:async(path,body)=>writes.push({path,body})}),useAccountQuery:()=>({data:{subjects:[subject],requests:[]},error:'',reload:async()=>{},reloadConfirmed:async()=>true})}).default;
 let tree=view.render(ui);find(tree,'Button',node=>node.props.message==='Submit a document').props.onPress();tree=view.render(ui);find(tree,'Choices').props.onChange('VEHICLE_OPERATING_LICENSE');tree=view.render(ui);assert.equal(find(tree,'DatePicker').props.message,'Licence expires');assert.equal(find(tree,'Button',node=>node.props.message==='Send for review').props.disabled,true);find(tree,'Button',node=>node.props.message==='Send for review').props.onPress();await settle();assert.equal(writes.length,0);
 find(tree,'DatePicker').props.onChange('2999-01-01');tree=view.render(ui);find(tree,'Button',node=>node.props.message==='Send for review').props.onPress();await settle();assert.equal(writes.length,1);assert.equal(writes[0].body.subjectId,'truck');assert.equal(writes[0].body.relatedVehicleId,'truck');assert.equal(writes[0].body.verificationType,'VEHICLE_OPERATING_LICENSE');assert.equal(writes[0].body.expiresOn,'2999-01-01');assert.equal('verified'in writes[0].body,false);tree=view.render(ui);assert.ok(find(tree,'Copy',node=>node.props.children?.includes('Document submitted for review.')));
});
test('an employed driver cannot mount owner fleet queries from an old or direct mobile route',()=>{
 const view=runtime(),paths=[],screen=view.compile('apps/mobile/src/screens/fleet.tsx',{useAccount:()=>({session:{state:'ACTIVE',user:{id:'employee',role:'DRIVER',operatingModel:'COMPANY_DRIVER',ownsProviderAccount:false,canManageFleet:false,drivesTruck:true},access:{granted:true}}}),useAccountQuery:path=>{paths.push(path);throw Error('Owner query must not mount');}}).default;
 const tree=view.render(screen);assert.equal(find(tree,'Redirect').props.href,'/account');assert.deepEqual(paths,[]);
});

test('native fleet separates tasks and opens saved details before any editor',()=>{
 const view=runtime(),account={session:{state:'ACTIVE',user:{id:'owner',role:'TRANSPORTER',ownsProviderAccount:true,canManageFleet:true,drivesTruck:false},access:{granted:true}}};
 const data={canManage:true,canAddTruck:true,canManageDrivers:true,publication,vehicles:[{id:'truck',make:'Make',model:'Model',plate:'PLATE',configuration:'Pickup truck',image:'/pickup.jpg',publicationState:'LIVE',capacityStatus:'OFF_DUTY'}],drivers:[{id:'employee',isOwner:false,name:'Employee',email:'employee@example.test',phone:'phone',vehicleId:'truck',canManageCapacity:true,canManageTracking:false}],retired:[],invitations:[],configurations:[],driverPage:1,driverPageCount:1,retiredPage:1,retiredPageCount:1};
 const screen=view.compile('apps/mobile/src/screens/fleet.tsx',{useAccount:()=>account,useAccountQuery:()=>({data,error:'',reload:async()=>{},reloadConfirmed:async()=>true}),ProviderPublicationNotice:'ProviderPublicationNotice',TruckAuthorityBadges:'TruckAuthorityBadges',TruckPublicationControl:'TruckPublicationControl'}).default;
 let tree=view.render(screen);assert.equal(find(tree,'TruckControls'),undefined);assert.equal(find(tree,'Button',node=>node.props.message==='Add driver'),undefined);assert.equal(find(tree,'FleetDevices'),undefined);assert.equal(find(tree,'Button',node=>node.props.message==='Retired trucks'),undefined);assert.ok(find(tree,'Text',node=>node.props.children?.includes('Live')));
 find(tree,'Pressable',node=>node.props.accessibilityLabel==='Manage vehicle: Make Model · PLATE').props.onPress();tree=view.render(screen);assert.ok(find(tree,'CapacityManagement'));assert.equal(find(tree,'TruckControls'),undefined);find(tree,'WorkspaceTabs').props.onChange('DETAILS');tree=view.render(screen);assert.ok(find(tree,'TruckControls'));find(tree,'WorkspaceTaskHeader').props.onBack();tree=view.render(screen);
 find(tree,'WorkspaceTabs').props.onChange('DRIVERS');tree=view.render(screen);assert.equal(nodes(tree).filter(node=>node.type==='Button'&&node.props.message==='Add driver').length,1);find(tree,'Pressable',node=>node.props.accessibilityLabel==='Manage driver: Employee').props.onPress();tree=view.render(screen);assert.equal(find(tree,'Button',node=>node.props.message==='Save assignment and access'),undefined);assert.equal(find(tree,'Switch'),undefined);find(tree,'Button',node=>node.props.message==='Edit assignment and access').props.onPress();tree=view.render(screen);assert.ok(find(tree,'Button',node=>node.props.message==='Save assignment and access'));find(tree,'Button',node=>node.props.message==='Cancel').props.onPress();tree=view.render(screen);assert.equal(find(tree,'Switch'),undefined);
});

test('restricted web employees keep a map with duty/location actions and no capacity editor',()=>{
 const view=runtime(),screen=view.compile('src/components/driver-capacity-home.tsx',{useRouter:()=>({refresh(){}}),useTranslation:()=>({t:(message,values={})=>message.replace(/\{(\w+)\}/g,(match,key)=>String(values[key]??match))}),StatusPill:'StatusPill',capacityLocationSource,selectedCapacityLocation,locationSourceLabel,relativeTime:()=> 'Today'}).DriverCapacityHome;
 const vehicle={id:'truck',make:'Make',model:'Model',platform_number:'TRUCK',assigned_driver:{id:'employee'},driver_location:{lat:9,lng:39,radius:20,area:'Approximate area',updatedAt:'2026-10-15'}};
 let tree=view.render(screen,{vehicles:[vehicle],capacities:[{vehicle_id:'truck',status:'OFF_DUTY'}],corridors:[],access:{kind:'COMPANY',can_manage_capacity:false},query:{},renderedAt:0});
 assert.ok(find(tree,'section',node=>node.props['data-testid']==='restricted-driver-map'));assert.ok(find(tree,'CapacityLocationMap'));assert.equal(find(tree,'CapacityForm'),undefined);assert.equal(find(tree,'button',node=>node.props['aria-label']==='Available').props.disabled,true);assert.ok(find(tree,'Localized',node=>node.props.as==='button'&&node.props['aria-label']==='Edit capacity location'));
 tree=view.render(screen,{vehicles:[vehicle],capacities:[{vehicle_id:'truck',status:'EMPTY',availability_geometry:'ROUTE',current_route_points:[{lat:9,lng:39,label:'A'},{lat:10,lng:40,label:'B'}]}],corridors:[],access:{kind:'COMPANY',can_manage_capacity:false},query:{},renderedAt:0});
 assert.equal(find(tree,'button',node=>node.props['aria-label']==='Off Duty').props.disabled,false);assert.equal(find(tree,'CapacityLocationMap').props.routePoints.length,2);
});

test('web Account never places another employee’s documents under the owner’s personal details',async()=>{
 const view=runtime(),user={id:'owner',active:true,role:'TRANSPORTER',organization_id:'company',owns_provider_account:true,can_manage_fleet:true,drives_truck:true};
 const screen=view.compile('src/app/app/more/page.tsx',{requireUser:async()=>user,getWorkspaceAccess:async()=>({granted:true}),providerWorkspaceCapabilities,getDriverPortraitWorkspace:async()=>null,getVerificationCenter:async()=>({subjects:[{subject_type:'DRIVER',subject_id:'owner'},{subject_type:'DRIVER',subject_id:'employee'}],requests:[]}),createSupabaseServerClient:async()=>({auth:{getUser:async()=>({data:{user:{}}})}}),accountDeactivationBlockers:async()=>[],PageHeader:'PageHeader',Flash:'Flash',UserRound:'UserRound',AccountDetailsForm:'AccountDetailsForm',SubjectDocuments:'SubjectDocuments',ProviderProfileWorkspace:'ProviderProfileWorkspace',AccountSecurityControls:'AccountSecurityControls',AccountDeletionForm:'AccountDeletionForm',LogoutButton:'LogoutButton',WorkspaceTaskDialog:'WorkspaceTaskDialog',Localized:'Localized',Building2:'Building2',FileCheck:'FileCheck',FileCheck2:'FileCheck2',Camera:'Camera',DriverPortraitEditor:'DriverPortraitEditor',ShieldCheck:'ShieldCheck',ChevronRight:'ChevronRight',ArrowLeft:'ArrowLeft',Pencil:'Pencil'}).default;
 const tree=await screen({searchParams:Promise.resolve({tab:'documents'})});assert.deepEqual(nodes(tree).filter(node=>node.type==='SubjectDocuments').map(node=>[node.props.kind,node.props.id]),[['DRIVER','owner']]);
});

test('native Account keeps both provider and own-driver documents together without opening an editor',()=>{
 for(const role of ['DRIVER','TRANSPORTER']){
  const view=runtime(),session={state:'ACTIVE',user:{id:'owner',role,ownsProviderAccount:true,canManageFleet:true,drivesTruck:true},access:{granted:true}};
  const screen=view.compile('apps/mobile/src/screens/account-settings.tsx',{useAccount:()=>({session}),accountSections,hasWorkspace,AccountDetails:'AccountDetails',Security:'Security',DriverPhoto:'DriverPhoto',Profile:'Profile',Documents:'Documents'}).default;
  let tree=view.render(screen);assert.equal(find(tree,'Documents'),undefined);assert.equal(find(tree,'AccountDetails'),undefined);find(tree,'WorkspaceAction',node=>node.props.message==='Your documents').props.onPress();tree=view.render(screen);const panels=nodes(tree).filter(node=>node.type==='Documents');assert.equal(panels.length,1);assert.deepEqual(panels[0].props.scope,{kind:'ACCOUNT',includeDriver:true,driverId:'owner',includeOwner:true});
 }
});

test('employed My truck exposes its scoped documents and returns to Home for driving actions',()=>{
 const view=runtime(),session={state:'ACTIVE',user:{id:'employee',role:'DRIVER',ownsProviderAccount:false,canManageFleet:false,drivesTruck:true,operatingModel:'COMPANY_DRIVER'},access:{granted:true}};
 const screen=view.compile('apps/mobile/src/screens/manage-capacity.tsx',{useAccount:()=>({session}),useAccountQuery:()=>({data:{vehicles:[{id:'assigned',label:'Assigned truck',plate:'PLATE',driver:'Employee',current:{status:'OFF_DUTY'},location:null}],canPublish:false},error:'',reload:async()=>{},reloadConfirmed:async()=>true}),AppLink:'AppLink'}).default;
 const tree=view.render(screen);assert.equal(find(tree,'AppLink').props.href,'/account');assert.equal(find(tree,'Button',node=>node.props.message==='Save capacity'),undefined);assert.deepEqual(find(tree,'Documents').props.scope,{kind:'ENTITY',subjectKind:'VEHICLE',id:'assigned'});
});

test('mobile members can open Support directly from Menu without notification history',()=>{
 const view=runtime(),navigations=[],session={state:'ACTIVE',user:{id:'employee',role:'DRIVER',operatingModel:'COMPANY_DRIVER'},access:{granted:true}};
 const ports={router:{navigate:path=>navigations.push(path)},require:()=>({}),useContext:()=>false,useAccount:()=>({session}),useChatUpdates:()=>({unreadCount:0,open(){}}),BackgroundNoticeLayout:{},navigationHeaderEdges:()=>[],useNavigation:()=>({navigate(){}}),usePathname:()=>'/account',hasWorkspace,activeDestination,isWorkspace,publicDestinations,workspaceDestinations,workspaceRoleLabel,StatusBar:'StatusBar',ChatUpdatesButton:'ChatUpdatesButton',ExternalButton:'ExternalButton',languages:[],Keyboard:{dismiss(){},addListener:()=>({remove(){}})}};
 const screen=view.compile('apps/mobile/src/components/navigation-shell.tsx',ports).NavigationShell;
 let tree=view.render(screen);find(tree,'Pressable',node=>node.props.accessibilityLabel==='Open menu').props.onPress();tree=view.render(screen);
 assert.ok(find(tree,'Text',node=>node.props.children?.includes('Support')));find(tree,'Pressable',node=>find(node,'Text',text=>text.props.children?.includes('Support'))).props.onPress();assert.deepEqual(navigations,['/support']);
});

test('workspace sections keep user labels raw and preserve mounted drafts when collapsed',()=>{
 const view=runtime(),translated=[],screen=view.compile('apps/mobile/src/components/workspace-section.tsx',{useLanguage:()=>({t:key=>{translated.push(key);return `translated:${key}`;}}),Keyboard:{dismiss(){}}}).WorkspaceSection,props={label:'Capacity',icon:'gps'},WithDraft=props=>screen({...props,children:{type:'DraftField',props:{children:[]}}});
 let tree=view.render(WithDraft,props);assert.equal(find(tree,'Pressable').props.accessibilityLabel,'Capacity');assert.equal(find(tree,'DraftField'),undefined);assert.deepEqual(translated,[]);
 find(tree,'Pressable').props.onPress();tree=view.render(WithDraft,props);assert.ok(find(tree,'DraftField'));find(tree,'Pressable').props.onPress();tree=view.render(WithDraft,props);assert.ok(find(tree,'View',node=>node.props.accessibilityElementsHidden===true&&find(node,'DraftField')));assert.deepEqual(translated,[]);
 tree=view.render(WithDraft,{message:'Truck documents',icon:'documents'});assert.equal(find(tree,'Pressable').props.accessibilityLabel,'translated:Truck documents');
});

test('native assignment keeps a saved checkpoint when its readback fails and Refresh never repeats the command',async()=>{
 const view=runtime(),writes=[];let confirmed=false,reads=0,error='';const account={session:{state:'ACTIVE',user:{id:'owner',role:'TRANSPORTER',ownsProviderAccount:true,canManageFleet:true,drivesTruck:true},access:{granted:true}},request:async(path,body)=>writes.push({path,body})};
 const data={canManage:true,canAddTruck:true,canManageDrivers:true,publication,vehicles:[{id:'truck',make:'Make',model:'Model',plate:'PLATE',configuration:'Pickup truck',image:'/pickup.jpg',publicationState:'DRAFT'}],drivers:[{id:'owner',isOwner:true,name:'Owner',phone:'phone',email:'owner@example.test',vehicleId:'truck',canManageCapacity:true,canManageTracking:true}],retired:[],invitations:[],configurations:[],driverPage:1,driverPageCount:1,retiredPage:1,retiredPageCount:1};
 const screen=view.compile('apps/mobile/src/screens/fleet.tsx',{useAccount:()=>account,useAccountQuery:()=>({data,error,reload:async()=>{},reloadConfirmed:async()=>{reads++;return confirmed;}}),ProviderPublicationNotice:'ProviderPublicationNotice',TruckAuthorityBadges:'TruckAuthorityBadges',TruckPublicationControl:'TruckPublicationControl'}).default;
 let tree=view.render(screen);find(tree,'WorkspaceTabs').props.onChange('DRIVERS');tree=view.render(screen);find(tree,'Pressable').props.onPress();tree=view.render(screen);find(tree,'Button',node=>node.props.message==='Edit assignment and access').props.onPress();tree=view.render(screen);find(tree,'Button',node=>node.props.message==='Save assignment and access').props.onPress();await settle();error='Temporary service outage';tree=view.render(screen);assert.equal(writes.length,1);assert.equal(reads,1);assert.ok(find(tree,'ErrorText',node=>node.props.message===error),'focused views keep the actual read failure visible');assert.ok(find(tree,'ErrorText',node=>node.props.message==='Your change is saved. Refresh to load the updated details.'));assert.equal(find(tree,'Button',node=>node.props.message==='Cancel').props.disabled,true);find(tree,'WorkspaceTaskHeader').props.onBack();tree=view.render(screen);assert.ok(find(tree,'Button',node=>node.props.message==='Refresh'),'Back cannot discard an unresolved saved checkpoint');confirmed=true;error='';find(tree,'Button',node=>node.props.message==='Refresh').props.onPress();await settle();tree=view.render(screen);assert.equal(writes.length,1);assert.equal(reads,2);assert.ok(find(tree,'Button',node=>node.props.message==='Edit assignment and access'));assert.equal(find(tree,'Button',node=>node.props.message==='Refresh'),undefined);
});

test('native vehicle editing retries only its authoritative read after a saved command',async()=>{
 const view=runtime(),writes=[],blocks=[];let confirmed=false,reads=0;const ui=view.compile('apps/mobile/src/components/fleet-management.tsx',{useAccount:()=>({request:async(path,body)=>writes.push({path,body})}),ConfigurationPicker:'ConfigurationPicker',ConfirmationButton:'ConfirmationButton'}),props={truck:{id:'truck',make:'Make',model:'Model',plate:'PLATE',configuration:'Pickup truck',image:'/pickup.jpg',driver:null,interchangeable:false,supported:[],publicationState:'DRAFT',useBasis:'OWNED'},configurations:[],reload:async()=>{reads++;if(!confirmed)throw Error('Temporary read failure');},onReadbackPending:value=>blocks.push(value)};
 let tree=view.render(ui.TruckControls,props);find(tree,'Button',node=>node.props.message==='Edit vehicle').props.onPress();tree=view.render(ui.TruckControls,props);find(tree,'Field',node=>node.props.message==='Make').props.onChangeText('Updated');tree=view.render(ui.TruckControls,props);find(tree,'Button',node=>node.props.message==='Save vehicle details').props.onPress();await settle();tree=view.render(ui.TruckControls,props);assert.equal(writes.length,1);assert.equal(writes[0].body.make,'Updated');assert.equal(find(tree,'Field',node=>node.props.message==='Make').props.editable,false);assert.equal(find(tree,'Button',node=>node.props.message==='Cancel').props.disabled,true);find(tree,'Button',node=>node.props.message==='Cancel').props.onPress();tree=view.render(ui.TruckControls,props);assert.ok(find(tree,'Button',node=>node.props.message==='Refresh'));confirmed=true;find(tree,'Button',node=>node.props.message==='Refresh').props.onPress();await settle();tree=view.render(ui.TruckControls,props);assert.equal(writes.length,1);assert.equal(reads,2);assert.ok(find(tree,'Button',node=>node.props.message==='Edit vehicle'));assert.equal(blocks.at(-1),false);
});
