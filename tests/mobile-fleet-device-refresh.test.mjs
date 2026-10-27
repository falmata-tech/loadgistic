import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {nextCapacityPrivacyRadius} from '../src/lib/location-privacy.js';
import {isDemoAdminSpare,gpsDeviceDisplayLabel} from '../src/lib/demo-admin-spare.js';
import {commandStateLabel,telematicsAlarmLabel} from '../src/lib/telematics-copy.js';
class ApiError extends Error{constructor(status){super('Synthetic read response');this.status=status;}}
const sharedExports={};new Function('exports',ts.transpileModule(readFileSync('src/lib/telematics-workspace.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(sharedExports);

// Exercise the real component hooks/handlers with a deterministic navigation,
// native measurement, clock and authorized HTTP port. No database or timer waits.
function harness(request){
 let slots=[],cursor=0,clock=100000,focused=false,focusEffect=null,pendingFocus=null,cleanupFocus=null;
 const pending=[],timers=new Map(),appListeners=new Set(),box={x:0,y:0,width:390,height:300},document={visibilityState:'visible'};
 const host={current:{measureInWindow:callback=>callback(box.x,box.y,box.width,box.height)}};
 const React={createElement:(type,props,...children)=>({type,props:{...props,children:children.flat(Infinity)}}),Fragment:'Fragment'};
 const changed=(a,b)=>!a||a.length!==b.length||a.some((value,index)=>value!==b[index]);
 const hooks={useRef:initial=>{const index=cursor++;return slots[index]||(slots[index]={current:initial});},useState:initial=>{const index=cursor++;if(!(index in slots))slots[index]=typeof initial==='function'?initial():initial;return[slots[index],value=>{slots[index]=typeof value==='function'?value(slots[index]):value;}];},useCallback:(fn,deps)=>{const index=cursor++;if(!slots[index]||changed(slots[index].deps,deps))slots[index]={deps,value:fn};return slots[index].value;},useEffect:(fn,deps)=>{const index=cursor++;if(!slots[index]||changed(slots[index].deps,deps)){const previous=slots[index];slots[index]={deps,cleanup:null};pending.push(()=>{previous?.cleanup?.();slots[index].cleanup=fn();});}}};
 const AppState={currentState:'active',addEventListener:(_kind,fn)=>{appListeners.add(fn);return{remove:()=>appListeners.delete(fn)};}},Platform={OS:'android'};
 const ports={React,...hooks,ApiError,document,AppState,Platform,View:'View',Text:'Text',Button:'Button',Copy:'Copy',ErrorText:'ErrorText',Field:'Field',Pressable:'Pressable',ActivityIndicator:'ActivityIndicator',LoadingSpinner:'LoadingSpinner',WorkspaceSection:'WorkspaceSection',WorkspaceTabs:'WorkspaceTabs',WorkspaceTaskHeader:'WorkspaceTaskHeader',WorkspaceFact:'WorkspaceFact',WorkspaceTaskPane:'WorkspaceTaskPane',AppIcon:'AppIcon',ConfirmationButton:'ConfirmationButton',Map:'Map',Camera:'Camera',Marker:'Marker',mapStyle:{},palette:{blue:'#155eef',ink:'#0b1d3a',border:'#cbd5e1',muted:'#526375'},randomUUID:()=> 'synthetic-command-key',commandStateLabel,telematicsAlarmLabel,isDemoAdminSpare,gpsDeviceDisplayLabel,useWindowDimensions:()=>({width:390,height:844}),useLanguage:()=>({t:value=>value,locale:'en'}),useAccount:()=>({session:{user:{id:'owner'}},request}),readFleetDeviceWorkspace:value=>value,fleetManualPoint:sharedExports.fleetManualPoint,sameFleetManualPoint:sharedExports.sameFleetManualPoint,nextCapacityPrivacyRadius,useFocusEffect:fn=>{if(fn!==focusEffect){focusEffect=fn;pendingFocus=fn;}},Date:class extends Date{static now(){return clock;}},setInterval:(fn,ms)=>{const key={};timers.set(key,{fn,ms});return key;},clearInterval:key=>timers.delete(key),setTimeout:()=>({}),clearTimeout:()=>{}};
 const path='apps/mobile/src/components/fleet-devices.tsx',file=readFileSync(path,'utf8'),parsed=ts.createSourceFile(path,file,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),source=ts.createPrinter().printFile(ts.factory.updateSourceFile(parsed,parsed.statements.filter(node=>!ts.isImportDeclaration(node))))+'\nexport {useDevices,SourceForm,SourceSummary,DeviceDetails,Choice};',code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText,exports={};
 new Function(...Object.keys(ports),'exports',code)(...Object.values(ports),exports);
 function render(name,props){cursor=0;const value=exports[name](name==='useDevices'?host:props);if(value?.props?.ref)value.props.ref.current=host.current;while(pending.length)pending.shift()();if(pendingFocus){if(focused){cleanupFocus?.();cleanupFocus=pendingFocus();}pendingFocus=null;}return value;}
 return{render,box,document,Platform,AppState,focus(){focused=true;cleanupFocus=focusEffect();},blur(){focused=false;cleanupFocus?.();cleanupFocus=null;},tick(ms){clock+=ms;for(const timer of [...timers.values()])timer.fn();},app(state){AppState.currentState=state;for(const fn of appListeners)fn(state);},unmount(){focused=false;cleanupFocus?.();for(const slot of slots)slot?.cleanup?.();},timers};
}
const settle=async()=>{for(let index=0;index<15;index++)await Promise.resolve();};
const workspace=page=>({page,pageSize:20,pageCount:3,total:41,canManage:true,devices:[],vehicles:[],commands:[]});
const nodes=tree=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];
const find=(tree,type,predicate=()=>true)=>nodes(tree).find(node=>(node.type===type||node.type?.name===type)&&predicate(node));

test('device refresh reads only visible active workspace/app and stays bounded to 30 seconds',async()=>{
 const paths=[],h=harness(async path=>{paths.push(path);return workspace(Number(new URL(path,'http://local').searchParams.get('page')));});
 let state=h.render('useDevices');h.box.height=0;h.focus();await settle();assert.equal(paths.length,0,'a retained collapsed section cannot read');h.box.height=300;state.onLayout();await settle();assert.deepEqual(paths,['/api/mobile/fleet/devices?page=1']);
 h.tick(29999);await settle();assert.equal(paths.length,1);h.tick(1);await settle();assert.equal(paths.length,2);
 h.app('background');h.tick(30000);await settle();assert.equal(paths.length,2);h.app('active');await settle();assert.equal(paths.length,3);
 h.box.y=1000;h.tick(30000);await settle();assert.equal(paths.length,3,'offscreen sections do not poll');h.box.y=0;h.blur();h.tick(30000);await settle();assert.equal(paths.length,3);h.unmount();assert.equal(h.timers.size,0);
});

test('paging uses requested bounded pages and refuses navigation while a form is dirty or focused',async()=>{
 const paths=[],h=harness(async path=>{paths.push(path);return workspace(Number(new URL(path,'http://local').searchParams.get('page')));});let state=h.render('useDevices');h.focus();await settle();state=h.render('useDevices');
 state.onEditing('source:focus',true);state.setPage(2);state=h.render('useDevices');h.tick(30000);await settle();assert.equal(paths.length,1);assert.equal(state.editing,true);
 state.onEditing('source:focus',false);state.onEditing('source:draft',true);state.setPage(2);state=h.render('useDevices');await settle();assert.equal(paths.length,1);
 state.onEditing('source:draft',false);state.setPage(2);state=h.render('useDevices');assert.equal(state.data,null,'previous-page devices cannot be presented as the next page');await settle();state=h.render('useDevices');assert.equal(state.data.page,2);assert.equal(paths.at(-1),'/api/mobile/fleet/devices?page=2');
 for(const page of [0,4,1.5,Infinity])state.setPage(page);h.render('useDevices');await settle();assert.equal(paths.length,2);h.unmount();
});

test('polls cannot overlap and blurred or old-page responses cannot replace current data',async()=>{
 const pending=[],h=harness(path=>new Promise(resolve=>pending.push({path,resolve})));h.render('useDevices');h.focus();await settle();h.tick(30000);await settle();assert.equal(pending.length,1);
 h.blur();h.focus();await settle();assert.equal(pending.length,2);pending[1].resolve(workspace(1));await settle();pending[0].resolve({...workspace(1),total:999});await settle();assert.equal(h.render('useDevices').data.total,41);h.unmount();
});

test('a shrinking device list adopts the server’s recovered page instead of later jumping to an obsolete page',async()=>{
 const paths=[],h=harness(async path=>{paths.push(path);const page=Number(new URL(path,'http://local').searchParams.get('page'));return page===3?{...workspace(1),pageCount:1,total:1}:workspace(page);});let state=h.render('useDevices');h.focus();await settle();state=h.render('useDevices');state.setPage(3);h.render('useDevices');await settle();state=h.render('useDevices');assert.equal(state.data.page,1);await settle();assert.equal(paths.at(-1),'/api/mobile/fleet/devices?page=1');h.tick(30000);await settle();assert.equal(paths.at(-1),'/api/mobile/fleet/devices?page=1');assert.equal(paths.filter(path=>path.endsWith('page=3')).length,1);h.unmount();
});

test('web hidden tabs do not refresh and completed POST plus failed reread does not discard a draft',async()=>{
 const writes=[],h=harness(async(path,body)=>{writes.push({path,body});if(body)return{};if(writes.some(item=>item.body))throw Error('Read unavailable');return workspace(1);});let state=h.render('useDevices');h.Platform.OS='web';h.document.visibilityState='hidden';h.focus();await settle();assert.equal(writes.length,0);h.document.visibilityState='visible';state.onLayout();await settle();state=h.render('useDevices');state.onEditing('draft',true);assert.equal(await state.save('SOURCE',{vehicleId:'truck'}),false);assert.equal(h.render('useDevices').editing,true);assert.equal(writes.filter(item=>item.body).length,1);h.unmount();
});

test('source draft and its original revision survive refreshed server data until Save or Cancel',async()=>{
 const saves=[],edits=[],h=harness(async()=>workspace(1)),onEditing=(key,value)=>edits.push({key,value});let vehicle={id:'truck',selection:{source:'MOBILE',precisionKm:20,revision:'revision-1',deviceId:'device'},published:null};const props=()=>({vehicle,busy:false,onEditing,save:async(action,input)=>{saves.push({action,input});return false;}});
 let tree=h.render('SourceForm',props());find(tree,'Choice',node=>node.props.label==='Manually entered').props.onPress();tree=h.render('SourceForm',props());find(tree,'Button',node=>node.props.message==='Enter coordinates').props.onPress();tree=h.render('SourceForm',props());find(tree,'Field',node=>node.props.message==='Latitude').props.onChangeText('10.5');tree=h.render('SourceForm',props());find(tree,'Field',node=>node.props.message==='Longitude').props.onChangeText('39.5');
 vehicle={...vehicle,selection:{...vehicle.selection,source:'GPS',precisionKm:40,revision:'revision-2'}};tree=h.render('SourceForm',props());assert.equal(find(tree,'Choice',node=>node.props.label==='Manually entered').props.selected,true);assert.equal(find(tree,'Field',node=>node.props.message==='Latitude').props.value,'10.5');find(tree,'Button',node=>node.props.message==='Save location source').props.onPress();await settle();assert.equal(saves[0].input.expectedRevision,'revision-1');assert.equal(saves[0].input.manualLongitude,39.5);
 find(tree,'Button',node=>node.props.message==='Cancel').props.onPress();tree=h.render('SourceForm',props());assert.equal(find(tree,'Choice',node=>node.props.label==='GPS device').props.selected,true);assert.ok(edits.some(item=>item.value===false));h.unmount();
});

test('assignment edits keep the old revision instead of adopting a concurrent reassignment',async()=>{
 const saves=[],h=harness(async()=>workspace(1)),onEditing=()=>{},data={...workspace(1),vehicles:[{id:'A',label:'Truck A'},{id:'B',label:'Truck B'},{id:'C',label:'Truck C'}]};let device={id:'device',label:'Device',vehicleId:'A',revision:'revision-1',connection:'UNKNOWN',position:null,capabilities:[]};const props=()=>({device,data,busy:false,onEditing,save:async(action,input)=>{saves.push({action,input});return false;}});
 let tree=h.render('DeviceDetails',props());find(tree,'Button',node=>node.props.label==='Truck A').props.onPress();tree=h.render('DeviceDetails',props());find(tree,'Choice',node=>node.props.label==='Truck B').props.onPress();device={...device,vehicleId:'C',revision:'revision-2'};tree=h.render('DeviceDetails',props());assert.ok(find(tree,'Button',node=>node.props.label==='Truck B'));find(tree,'Button',node=>node.props.message==='Save assignment').props.onPress();await settle();assert.deepEqual(saves[0],{action:'ASSIGN',input:{deviceId:'device',vehicleId:'B',expectedRevision:'revision-1'}});h.unmount();
});

test('typed worldwide coordinates reveal their point while map taps keep the chosen zoom',()=>{
 const h=harness(async()=>workspace(1)),moves=[],vehicle={id:'truck',selection:{source:'GPS',precisionKm:20,revision:'revision-1',deviceId:'device'}},props={vehicle,busy:false,onEditing:()=>{},save:async()=>false};
 let tree=h.render('SourceForm',props);find(tree,'Choice',node=>node.props.label==='Manually entered').props.onPress();tree=h.render('SourceForm',props);find(tree,'Button',node=>node.props.message==='Enter coordinates').props.onPress();tree=h.render('SourceForm',props);
 find(tree,'Camera').props.ref({jumpTo:value=>moves.push(value)});
 find(tree,'Field',node=>node.props.message==='Latitude').props.onChangeText('40.015');tree=h.render('SourceForm',props);assert.equal(moves.length,0,'one incomplete coordinate cannot move the camera');
 find(tree,'Field',node=>node.props.message==='Longitude').props.onChangeText('-105.27');tree=h.render('SourceForm',props);assert.deepEqual(moves,[{center:[-105.27,40.015],zoom:10}]);assert.deepEqual(find(tree,'Marker').props.lngLat,[-105.27,40.015]);
 find(tree,'Map').props.onPress({nativeEvent:{lngLat:[39.3,8.5]}});tree=h.render('SourceForm',props);assert.equal(moves.length,1,'a map tap must not reset the user’s zoom');assert.ok(Math.abs(find(tree,'Marker').props.lngLat[0]-39.3)<1e-9);assert.equal(find(tree,'Marker').props.lngLat[1],8.5);
 find(tree,'Map').props.onDidFinishLoadingMap();assert.equal(moves.length,1,'a prior typed point cannot override a later map tap');h.unmount();
});


test('source and assignment choices expose their selected state to native and browser assistive controls',()=>{
 const h=harness(async()=>workspace(1));for(const selected of[false,true]){const tree=h.render('Choice',{label:'GPS device',selected,disabled:false,onPress:()=>{}});assert.equal(tree.props.accessibilityRole,'radio');assert.equal(tree.props['aria-checked'],selected);assert.equal(tree.props.accessibilityState.checked,selected);}h.unmount();
});


test('a tracker with no alarm does not render an empty raw text child inside a native View',()=>{
 const h=harness(async()=>workspace(1)),tree=h.render('DeviceDetails',{device:{id:'device',label:'Device',vehicleId:null,revision:'r1',connection:'ONLINE',position:null,capabilities:[],synthetic:true},data:workspace(1),busy:false,onEditing:()=>{},save:async()=>false});
 for(const node of nodes(tree).filter(node=>node.type==='View'))assert.equal(node.props.children.some(child=>typeof child==='string'),false,'native View children must not contain a string, including the no-alarm empty string');h.unmount();
});


test('the device assignment chooser starts compact and opens only for an explicit change',()=>{
 const h=harness(async()=>workspace(1)),data={...workspace(1),vehicles:[{id:'A',label:'Truck A'},{id:'B',label:'Truck B'}]},device={id:'device',label:'Device',vehicleId:'A',revision:'revision-1',connection:'UNKNOWN',position:null,capabilities:[]},props={device,data,busy:false,onEditing:()=>{},save:async()=>false};
 let tree=h.render('DeviceDetails',props);assert.ok(find(tree,'Button',node=>node.props.label==='Truck A'));assert.equal(nodes(tree).filter(node=>node.type?.name==='Choice').length,0);assert.equal(find(tree,'Button',node=>node.props.message==='Save assignment'),undefined);
 find(tree,'Button',node=>node.props.label==='Truck A').props.onPress();tree=h.render('DeviceDetails',props);assert.equal(nodes(tree).filter(node=>node.type?.name==='Choice').length,3);find(tree,'Choice',node=>node.props.label==='Truck B').props.onPress();tree=h.render('DeviceDetails',props);assert.ok(find(tree,'Button',node=>node.props.label==='Truck B'));assert.equal(nodes(tree).filter(node=>node.type?.name==='Choice').length,0);assert.ok(find(tree,'Button',node=>node.props.message==='Save assignment'));find(tree,'Button',node=>node.props.message==='Cancel').props.onPress();tree=h.render('DeviceDetails',props);assert.ok(find(tree,'Button',node=>node.props.label==='Truck A'));assert.equal(find(tree,'Button',node=>node.props.message==='Save assignment'),undefined);h.unmount();
});

test('a persisted Manual point supports an accuracy-only edit and Cancel restores the saved point',async()=>{
 const h=harness(async()=>workspace(1)),saves=[],edits=[],vehicle={id:'truck',selection:{source:'MANUAL',precisionKm:20,revision:'revision-1',deviceId:'device',manualPoint:{latitude:40.015,longitude:-105.27}}},props={vehicle,busy:false,onEditing:(key,value)=>edits.push({key,value}),save:async(action,input)=>{saves.push({action,input});return false;}};
 let tree=h.render('SourceForm',props);assert.deepEqual(find(tree,'Marker').props.lngLat,[-105.27,40.015]);assert.deepEqual(find(tree,'Camera').props.initialViewState.center,[-105.27,40.015]);assert.equal(find(tree,'Button',node=>node.props.message==='Save location source').props.disabled,true);
 find(tree,'Choice',node=>node.props.label==='5 km').props.onPress();tree=h.render('SourceForm',props);assert.equal(find(tree,'Button',node=>node.props.message==='Save location source').props.disabled,false);find(tree,'Button',node=>node.props.message==='Save location source').props.onPress();await settle();assert.deepEqual(saves[0],{action:'SOURCE',input:{vehicleId:'truck',source:'MANUAL',expectedRevision:'revision-1',precisionKm:5,manualLatitude:40.015,manualLongitude:-105.27}});
 find(tree,'Button',node=>node.props.message==='Enter coordinates').props.onPress();tree=h.render('SourceForm',props);find(tree,'Field',node=>node.props.message==='Longitude').props.onChangeText('-106');tree=h.render('SourceForm',props);find(tree,'Button',node=>node.props.message==='Cancel').props.onPress();tree=h.render('SourceForm',props);assert.equal(find(tree,'Field',node=>node.props.message==='Longitude').props.value,'-105.27');assert.deepEqual(find(tree,'Marker').props.lngLat,[-105.27,40.015]);assert.equal(find(tree,'Choice',node=>node.props.label==='20 km').props.selected,true);assert.equal(find(tree,'Button',node=>node.props.message==='Save location source').props.disabled,true);assert.ok(edits.some(value=>value.value===false));h.unmount();
});

test('equivalent Manual coordinate text does not create an unsaved source change',()=>{
 const h=harness(async()=>workspace(1)),edits=[],vehicle={id:'truck',selection:{source:'MANUAL',precisionKm:20,revision:'r1',manualPoint:{latitude:0,longitude:-105.27}}},props={vehicle,busy:false,onEditing:(key,value)=>edits.push({key,value}),save:async()=>false};let tree=h.render('SourceForm',props);find(tree,'Button',node=>node.props.message==='Enter coordinates').props.onPress();tree=h.render('SourceForm',props);find(tree,'Field',node=>node.props.message==='Latitude').props.onChangeText('0.000');tree=h.render('SourceForm',props);find(tree,'Field',node=>node.props.message==='Longitude').props.onChangeText('-105.270');tree=h.render('SourceForm',props);assert.equal(find(tree,'Button',node=>node.props.message==='Save location source').props.disabled,true);assert.equal(find(tree,'Button',node=>node.props.message==='Cancel'),undefined);assert.ok(edits.every(value=>value.value===false));h.unmount();
});


test('location source opens as saved facts and requires an explicit Edit action',()=>{
 const h=harness(async()=>workspace(1)),props={vehicle:{id:'truck',selection:{source:'MANUAL',precisionKm:5,revision:'r1',manualPoint:{latitude:40,longitude:-105}}},busy:false,onEditing:()=>{},save:async()=>false};let tree=h.render('SourceSummary',props);assert.equal(find(tree,'Field'),undefined);assert.equal(find(tree,'SourceForm'),undefined);assert.equal(find(tree,'WorkspaceFact',node=>node.props.message==='Location source').props.value,'Manually entered');find(tree,'Button',node=>node.props.message==='Edit location source').props.onPress();tree=h.render('SourceSummary',props);assert.ok(find(tree,'SourceForm'));find(tree,'SourceForm').props.onClose();tree=h.render('SourceSummary',props);assert.equal(find(tree,'SourceForm'),undefined);h.unmount();
});

test('provider cannot edit a manual Capacity location chosen by the assigned driver',()=>{
 const h=harness(async()=>workspace(1)),base={id:'truck',selection:{source:'MOBILE',precisionKm:5,revision:'r1',manualPoint:null,driverSelectedManual:false}},props={vehicle:base,busy:false,onEditing:()=>{},save:async()=>false};
 let tree=h.render('SourceSummary',props);find(tree,'Button',node=>node.props.message==='Edit location source').props.onPress();
 props.vehicle={...base,selection:{...base.selection,source:'MANUAL',revision:'r2',manualPoint:{latitude:40,longitude:-105},driverSelectedManual:true}};
 tree=h.render('SourceSummary',props);
 assert.equal(find(tree,'SourceForm'),undefined,'a previously open editor closes when the driver takes manual control');
 assert.equal(find(tree,'Button',node=>node.props.message==='Edit location source'),undefined);
 assert.ok(find(tree,'Copy',node=>node.props.message==='The assigned driver chose a manual Capacity location. They can switch back to phone; GPS reports remain available in Fleet.'));
 assert.equal(find(tree,'WorkspaceFact',node=>node.props.message==='Location source').props.value,'Manually entered');
 props.vehicle={...base,selection:{...base.selection,revision:'r3'}};
 tree=h.render('SourceSummary',props);
 assert.equal(find(tree,'SourceForm'),undefined,'the owner must reopen Edit after the driver releases manual control');
 assert.ok(find(tree,'Button',node=>node.props.message==='Edit location source'));
 h.unmount();
});


test('authoritative read denials remove private devices and drafts while transient/conflict responses preserve them',async()=>{
 for(const status of [401,403,404,409,500,0]){
  let reads=0,rejectRead;const h=harness(async()=>{if(++reads===1)return{...workspace(1),devices:[{id:'private-device'}]};return await new Promise((_resolve,reject)=>{rejectRead=reject;});});let state=h.render('useDevices');h.focus();await settle();state=h.render('useDevices');assert.equal(state.data.devices.length,1);const refresh=state.reload();await settle();state.onEditing('source:draft',true);rejectRead(new ApiError(status));await refresh;await settle();state=h.render('useDevices');if([401,403,404].includes(status)){assert.equal(state.data,null,'revoked authority cannot retain private telemetry');assert.equal(state.editing,false,'an unauthorized editor must unmount');}else{assert.equal(state.data.devices.length,1);assert.equal(state.editing,true,'a temporary failure cannot discard the user draft');}h.unmount();
 }
});

const reportDevice=overrides=>({id:'test-gps',label:'Test GPS',imei:'990000000000001',protocol:'gt06',modelProfile:'UNVERIFIED',synthetic:false,vehicleId:null,revision:'2026-10-25T10:00:00Z',lastSeenAt:'2026-10-25T10:06:00Z',connection:'ONLINE',capabilities:[],position:{latitude:9,longitude:38,speedKph:0,course:0,ignition:null,battery:0,observedAt:'2026-10-25T10:00:00Z',receivedAt:'2026-10-25T10:05:00Z'},...overrides});
const reportProps=(device,commands=[],save=async()=>false)=>({device,data:{...workspace(1),devices:[device],commands},busy:false,onEditing:()=>{},save});
const textContent=tree=>Array.isArray(tree)?tree.map(textContent).join(''):tree&&typeof tree==='object'?String(tree.props?.message||'')+textContent(tree.props?.children):typeof tree==='string'||typeof tree==='number'?String(tree):'';
const reportFact=(tree,label)=>{const row=nodes(tree).find(node=>node.type==='View'&&node.props.children?.some(child=>child?.type==='Text'&&textContent(child)===label));return row?.props.children.filter(child=>child?.type==='Text').map(textContent)[1];};

test('native GPS report shows zero heading/speed/battery and separate location/receipt times without inventing ignition',()=>{
 const h=harness(async()=>workspace(1)),device=reportDevice(),tree=h.render('DeviceDetails',reportProps(device));
 assert.equal(reportFact(tree,'Heading'),'0°');assert.equal(reportFact(tree,'Speed'),'0 km/h');assert.equal(reportFact(tree,'Battery'),'0%');
 assert.equal(reportFact(tree,'Location time'),new Date(device.position.observedAt).toLocaleString('en'));
 assert.equal(reportFact(tree,'Received at'),new Date(device.position.receivedAt).toLocaleString('en'));
 assert.equal(reportFact(tree,'Last report'),new Date(device.lastSeenAt).toLocaleString('en'));
 assert.equal(reportFact(tree,'Ignition'),undefined);h.unmount();
});

test('native GPS report keeps missing telemetry unavailable and a reported false ignition remains Off',()=>{
 const h=harness(async()=>workspace(1)),device=reportDevice({position:null}),props=reportProps(device);let tree=h.render('DeviceDetails',props);
 for(const label of ['Heading','Speed','Battery','Location time','Received at'])assert.equal(reportFact(tree,label),'—',label);
 props.device={...device,position:{...reportDevice().position,course:null,battery:null,ignition:false}};tree=h.render('DeviceDetails',props);
 assert.equal(reportFact(tree,'Heading'),'—');assert.equal(reportFact(tree,'Battery'),'—');assert.equal(reportFact(tree,'Ignition'),'Off');h.unmount();
});

test('native device list and selected header describe report age without claiming a socket is connected',async()=>{
 for(const [connection,label] of [['ONLINE','Recent report'],['STALE','Older report'],['UNKNOWN','Not reported yet']]){
  const device=reportDevice({connection}),data={...workspace(1),devices:[device]},h=harness(async()=>data);let tree=h.render('FleetDevices');h.focus();await settle();tree=h.render('FleetDevices');
  assert.ok(textContent(tree).includes(label),`list ${connection}`);find(tree,'Pressable').props.onPress();tree=h.render('FleetDevices');assert.equal(find(tree,'WorkspaceTaskHeader').props.subtitle,label);
  for(const old of ['Connected','Not reporting','Not connected yet'])assert.equal(textContent(tree).includes(old),false);
  h.unmount();
 }
});

test('native latest vibration alarm retains its observed timestamp',()=>{
 const h=harness(async()=>workspace(1)),device=reportDevice({lastAlarm:'vibration',alarmAt:'2026-10-25T09:59:00Z'}),tree=h.render('DeviceDetails',reportProps(device));
 const alarm=find(tree,'Copy',node=>textContent(node).includes('Vibration alert'));assert.ok(alarm);assert.ok(textContent(alarm).includes(new Date(device.alarmAt).toLocaleString('en')));h.unmount();
});

test('native receive-only commands omit engine help and actions; synthetic locate retains exact device scope',async()=>{
 const writes=[],h=harness(async()=>workspace(1));let device=reportDevice(),props=reportProps(device,[],async(...args)=>{writes.push(args);return true;}),tree=h.render('DeviceDetails',props);
 find(tree,'WorkspaceTabs').props.onChange('COMMANDS');tree=h.render('DeviceDetails',props);let pane=find(tree,'WorkspaceTaskPane',node=>node.props.active);
 assert.equal(textContent(pane).includes('Engine control requires a separately checked safety installation.'),false);
 for(const label of ['Request location','Restart GPS device','Save interval'])assert.equal(find(pane,'Button',node=>node.props.message===label),undefined);
 assert.equal(find(pane,'ConfirmationButton'),undefined);assert.deepEqual(writes,[]);
 props={...props,device:{...device,synthetic:true,modelProfile:'SYNTHETIC_GT06',capabilities:['LOCATE','ENGINE_CUT']}};tree=h.render('DeviceDetails',props);pane=find(tree,'WorkspaceTaskPane',node=>node.props.active);
 assert.ok(textContent(pane).includes('Engine control requires a separately checked safety installation.'));
 find(pane,'Button',node=>node.props.message==='Request location').props.onPress();await settle();assert.deepEqual(writes,[['COMMAND',{deviceId:device.id,command:'LOCATE',idempotencyKey:'synthetic-command-key'}]]);h.unmount();
});

test('native simulated command activity keeps dispatch, sent, acknowledgement and expiry distinct',()=>{
 const device=reportDevice({synthetic:true}),states=['REQUESTED','DISPATCHING','DISPATCHED','ACKNOWLEDGED','FAILED','EXPIRED','UNKNOWN'];
 for(const [index,state] of states.entries()){
  const h=harness(async()=>workspace(1)),props=reportProps(device,[{id:`command-${index}`,deviceId:device.id,command:'LOCATE',state}]);let tree=h.render('DeviceDetails',props);find(tree,'WorkspaceTabs').props.onChange('COMMANDS');tree=h.render('DeviceDetails',props);
  const expected={REQUESTED:'Waiting to send',DISPATCHING:'Sending…',DISPATCHED:'Sent · waiting for device',ACKNOWLEDGED:'Device confirmed',FAILED:'Failed',EXPIRED:'Expired',UNKNOWN:'Delivery not confirmed'}[state];
  assert.ok(textContent(find(tree,'WorkspaceTaskPane',node=>node.props.active)).includes(expected),state);h.unmount();
 }
});
