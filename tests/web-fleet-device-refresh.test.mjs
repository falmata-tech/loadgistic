import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {parseFleetDeviceWorkspace,fleetManualPoint,sameFleetManualPoint} from '../src/lib/telematics-workspace.ts';
import {nextCapacityPrivacyRadius} from '../src/lib/location-privacy.js';
const workspace=page=>({canManage:true,page,pageSize:20,total:1,pageCount:1,devices:[],vehicles:[],commands:[]});
function harness(fetcher){
 let slots=[],cursor=0;const effects=[],timers=new Set();
 const changed=(a,b)=>!a||a.length!==b.length||a.some((value,index)=>value!==b[index]);
 const React={createElement:(type,props,...children)=>({type,props:{...props,children:children.flat(Infinity)}}),useRef:initial=>{const i=cursor++;return slots[i]||(slots[i]={current:initial});},useState:initial=>{const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},useCallback:(fn,deps)=>{const i=cursor++;if(!slots[i]||changed(slots[i].deps,deps))slots[i]={deps,value:fn};return slots[i].value;},useEffect:(fn,deps)=>{const i=cursor++;if(!slots[i]||changed(slots[i].deps,deps)){const old=slots[i];slots[i]={deps};effects.push(()=>{old?.cleanup?.();slots[i].cleanup=fn();});}}};
 const document={visibilityState:'visible',activeElement:null},host={getClientRects:()=>[{}],contains:()=>false};
 const file=readFileSync('src/components/fleet-devices.tsx','utf8'),parsed=ts.createSourceFile('fleet-devices.tsx',file,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const source=ts.createPrinter().printFile(ts.factory.updateSourceFile(parsed,parsed.statements.filter(node=>!ts.isImportDeclaration(node))))+'\nexport {useFleetDevices,SourceForm,SourceSummary,DeviceRow};';
 const exports={},code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText;
 const ports={React,window:{setInterval:fn=>{timers.add(fn);return fn;},clearInterval:fn=>timers.delete(fn)},document,fetch:fetcher,parseFleetDeviceWorkspace,fleetManualPoint,sameFleetManualPoint,nextCapacityPrivacyRadius,useTranslation:()=>({t:value=>value,locale:'en'}),Text:'Text',ManualTruckLocation:'ManualTruckLocation',Satellite:'Satellite',Smartphone:'Smartphone',Pencil:'Pencil',RefreshCw:'RefreshCw',ArrowLeft:'ArrowLeft',ArrowRight:'ArrowRight',Truck:'Truck',CapacityEditDialog:'CapacityEditDialog',styles:new Proxy({},{get:(_target,key)=>String(key)}),telematicsAlarmLabel:()=>null,commandStateLabel:value=>value,exports};
 new Function(...Object.keys(ports),code)(...Object.values(ports));
 return {document,host,render(name='useFleetDevices',props){cursor=0;const value=exports[name](props);if(value?.host)value.host.current=host;while(effects.length)effects.shift()();return value;},tick(){for(const fn of timers)fn();},close(){for(const slot of slots)slot?.cleanup?.();}};
}
const settle=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
const response=value=>({ok:true,json:async()=>value});
test('web completed device POST plus failed reread retains an unconfirmed save outcome',async()=>{
 let written=false;const h=harness(async(_url,options)=>{if(options.method==='POST'){written=true;return response({ok:true});}if(written)throw new TypeError('private network detail');return response(workspace(1));});
 let state=h.render();await settle();state=h.render();assert.equal(await state.save('SOURCE',{}),false);state=h.render();assert.equal(state.data.page,1);assert.equal(state.error,'Could not load GPS devices.');h.close();
});
test('web refresh pauses for dirty drafts, focused forms, hidden sections and background tabs',async()=>{
 let reads=0;const h=harness(async()=>{reads++;return response(workspace(1));});let state=h.render();await settle();state=h.render();
 state.markDirty('source',true);state=h.render();h.tick();await settle();assert.equal(reads,1);
 state.markDirty('source',false);state=h.render();h.host.contains=()=>true;h.tick();await settle();assert.equal(reads,1);
 h.host.contains=()=>false;h.host.getClientRects=()=>[];h.tick();await settle();assert.equal(reads,1);
 h.host.getClientRects=()=>[{}];h.document.visibilityState='hidden';h.tick();await settle();assert.equal(reads,1);
 h.document.visibilityState='visible';h.tick();await settle();assert.equal(reads,2);h.close();
});
test('web replaced or unmounted reads are aborted and cannot overwrite current device data',async()=>{
 const calls=[];const h=harness((_url,options)=>new Promise(resolve=>calls.push({options,resolve})));let state=h.render();assert.equal(calls.length,1);
 void state.reload();assert.equal(calls.length,2);assert.equal(calls[0].options.signal.aborted,true);
 calls[1].resolve(response(workspace(1)));await settle();calls[0].resolve(response({...workspace(1),total:99}));await settle();state=h.render();assert.equal(state.data.total,1);void state.reload();assert.equal(calls.length,3);h.close();assert.equal(calls[2].options.signal.aborted,true);
});

test('web GPS cache clears after authoritative read denial while transient failure retains saved data',async()=>{
 for(const status of [401,403,404,503]){
  let failed=false;const h=harness(async()=>failed?{ok:false,status,json:async()=>({error:{message:'Could not load GPS devices.'}})}:response(workspace(1)));
  let state=h.render();await settle();state=h.render();assert.ok(state.data);failed=true;await state.reload();state=h.render();assert.equal(state.data===null,status!==503);h.close();
 }
});

const treeNodes=tree=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(treeNodes):[tree,...treeNodes(tree.props?.children)];
const control=(tree,type,predicate)=>treeNodes(tree).find(node=>node.type===type&&predicate(node.props));
const button=(tree,message)=>control(tree,'button',props=>treeNodes(props.children).some(node=>node.props?.message===message));
test('web dirty source keeps its original revision through an explicit reread; Cancel adopts current server state',async()=>{
 const saves=[],h=harness(async()=>response(workspace(1))),markDirty=()=>{};
 let vehicle={id:'truck',selection:{source:'GPS',precisionKm:20,revision:'r1',deviceId:'device',manualPoint:null}},props=()=>({vehicle,busy:false,markDirty,save:async(action,input)=>{saves.push({action,input});return false;}});
 let tree=h.render('SourceForm',props());control(tree,'label',p=>treeNodes(p.children).some(n=>n.props?.message==='Manually entered')).props.children.find(n=>n.type==='input').props.onChange();
 tree=h.render('SourceForm',props());control(tree,'ManualTruckLocation',()=>true).props.onChange({lat:40.015,lng:-105.27});
 tree=h.render('SourceForm',props());control(tree,'select',()=>true).props.onChange({target:{value:'5'}});
 vehicle={...vehicle,selection:{...vehicle.selection,revision:'r2',precisionKm:10}};tree=h.render('SourceForm',props());
 assert.equal(control(tree,'select',()=>true).props.value,5);assert.deepEqual(control(tree,'ManualTruckLocation',()=>true).props.point,{lat:40.015,lng:-105.27});
 await tree.props.onSubmit({preventDefault(){}});assert.equal(saves[0].input.expectedRevision,'r1');assert.equal(saves[0].input.manualLongitude,-105.27);
 button(tree,'Cancel').props.onClick();h.render('SourceForm',props());tree=h.render('SourceForm',props());assert.equal(control(tree,'select',()=>true).props.value,10);assert.equal(control(tree,'ManualTruckLocation',()=>true),undefined);
 control(tree,'select',()=>true).props.onChange({target:{value:'5'}});tree=h.render('SourceForm',props());await tree.props.onSubmit({preventDefault(){}});assert.equal(saves[1].input.expectedRevision,'r2');h.close();
});
test('web dirty device assignment cannot silently adopt a concurrent binding revision',async()=>{
 const saves=[],h=harness(async()=>response(workspace(1))),markDirty=()=>{},data={...workspace(1),vehicles:[{id:'A',label:'Truck A'},{id:'B',label:'Truck B'},{id:'C',label:'Truck C'}]};
 let device={id:'device',label:'Device',vehicleId:'A',revision:'r1',connection:'UNKNOWN',capabilities:[],position:null},props=()=>({device,workspace:data,busy:false,markDirty,save:async(action,input)=>{saves.push({action,input});return false;}});
 let tree=h.render('DeviceRow',props());assert.equal(control(tree,'select',()=>true),undefined,'viewing the device must not open assignment editing');button(tree,'Change assignment').props.onClick();tree=h.render('DeviceRow',props());control(tree,'select',()=>true).props.onChange({target:{value:'B'}});device={...device,vehicleId:'C',revision:'r2'};tree=h.render('DeviceRow',props());assert.equal(control(tree,'select',()=>true).props.value,'B');
 await control(tree,'form',()=>true).props.onSubmit({preventDefault(){}});assert.deepEqual(saves[0],{action:'ASSIGN',input:{deviceId:'device',vehicleId:'B',expectedRevision:'r1'}});
 button(tree,'Cancel').props.onClick();h.render('DeviceRow',props());tree=h.render('DeviceRow',props());assert.equal(control(tree,'select',()=>true),undefined,'cancel returns to the saved view');button(tree,'Change assignment').props.onClick();tree=h.render('DeviceRow',props());assert.equal(control(tree,'select',()=>true).props.value,'C');h.close();
});

test('web location source starts as saved facts, editing opens deliberately and dismissal writes nothing',()=>{
 const writes=[],marks=[],h=harness(async()=>response(workspace(1)));
 const props={vehicle:{id:'truck',label:'Truck A',selection:{source:'GPS',precisionKm:20,revision:'r1',deviceId:'device',manualPoint:null},published:null},busy:false,markDirty:(...args)=>marks.push(args),save:async(...args)=>{writes.push(args);return true;}};
 let tree=h.render('SourceSummary',props);assert.equal(control(tree,'CapacityEditDialog',()=>true),undefined);assert.equal(control(tree,'input',()=>true),undefined);
 button(tree,'Edit location source').props.onClick();tree=h.render('SourceSummary',props);const dialog=control(tree,'CapacityEditDialog',()=>true);assert.ok(dialog);assert.ok(marks.some(([key,value])=>key==='source-editor-truck'&&value===true));
 dialog.props.onClose();tree=h.render('SourceSummary',props);assert.equal(control(tree,'CapacityEditDialog',()=>true),undefined);assert.deepEqual(writes,[]);h.close();
});

test('provider cannot edit a manual Capacity source selected by the assigned driver',()=>{
 const h=harness(async()=>response(workspace(1)));
 const vehicle={id:'truck',label:'Truck A',selection:{source:'MANUAL',precisionKm:5,revision:'r1',deviceId:'device',manualPoint:{latitude:40,longitude:-105},driverSelectedManual:true},published:{source:'MANUAL',updatedAt:'2026-10-18T12:00:00Z'}};
 const props={vehicle,busy:false,markDirty:()=>{},save:async()=>{throw Error('Owner must not save driver choice');}};
 const tree=h.render('SourceSummary',props);
 assert.equal(button(tree,'Edit location source'),undefined);
 assert.equal(control(tree,'CapacityEditDialog',()=>true),undefined);
 assert.ok(treeNodes(tree).some(node=>node.props?.message==='The assigned driver chose a manual Capacity location. They can switch back to phone; GPS reports remain available in Fleet.'));
 h.close();
});

test('web source editor closes only after the saved change is confirmed by reread',async()=>{
 const h=harness(async()=>response(workspace(1)));let confirmed=false,closed=0;
 const props={vehicle:{id:'truck',selection:{source:'GPS',precisionKm:20,revision:'r1',deviceId:'device',manualPoint:null}},busy:false,markDirty:()=>{},save:async()=>confirmed,onSaved:()=>closed++};
 let tree=h.render('SourceForm',props);control(tree,'select',()=>true).props.onChange({target:{value:'5'}});tree=h.render('SourceForm',props);
 await tree.props.onSubmit({preventDefault(){}});tree=h.render('SourceForm',props);assert.equal(closed,0);assert.equal(control(tree,'select',()=>true).props.value,5,'an unconfirmed change keeps its draft');
 confirmed=true;await tree.props.onSubmit({preventDefault(){}});assert.equal(closed,1);h.close();
});
