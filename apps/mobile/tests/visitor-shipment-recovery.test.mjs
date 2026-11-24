import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {createTrackingSessionController} from '../src/session/tracking-session-controller.ts';
import * as refreshPolicy from '../../../src/lib/tracking-refresh-policy.js';
const id='16000000-0000-4000-8000-000000000001',shipmentId='16000000-0000-4000-8000-000000000002',eventId='16000000-0000-4000-8000-000000000003',linkToken='a'.repeat(43),now=1800000000000;
const view=(state='CONNECTED')=>({id,reference:'Local load',state,revision:1,workspaceId:null,shipmentId:state==='CONNECTED'?shipmentId:null,route:[{placeRef:'A',label:'A',coordinate:[38,9]},{placeRef:'B',label:'B',coordinate:[39,10]}],cargoSummary:'Local cargo',pickupDate:'',deliveryDate:'',capabilities:{canIssueLink:false,canRevokeLink:false,canAcceptProvider:false},links:[],tracking:state==='CONNECTED'?{shipmentId,code:'Reference',status:'CREATED',updatedAt:'2027-01-15T08:00:00Z',trackingMode:'STATUS_ONLY',location:null,events:[{id:eventId,status:'CREATED',note:'',createdAt:'2027-01-15T08:00:00Z'}]}:null});
function screen(){
 const calls=[],timers=[],stores=new Map();let cursor=0,slots=[],queued=[],state=view();
 const port={now:()=>now,changed(){},request:async(path,options)=>{calls.push({path,options});return path==='/api/tracking/access'&&options?.body?{ok:true,data:{session:state,grant:'private.grant',expiresAt:new Date(now+300000).toISOString()}}:{ok:true,data:state};}};
 const controller=createTrackingSessionController(port),React={createElement:(type,props,...children)=>({type,props:{...props,children:children.flat(Infinity)}})};
 const hooks={useCallback:callback=>callback,useState:initial=>{const index=cursor++;if(!(index in slots))slots[index]=typeof initial==='function'?initial():initial;const saved=slots;return[saved[index],value=>saved[index]=typeof value==='function'?value(saved[index]):value];},useRef:initial=>{const index=cursor++;return slots[index]||(slots[index]={current:initial});},useEffect:(fn,deps)=>{const index=cursor++,old=slots[index];if(!old||deps.some((v,i)=>!Object.is(v,old.deps[i]))){slots[index]={deps};queued.push(()=>{old?.cleanup?.();slots[index].cleanup=fn();});}}};
 const file=readFileSync(new URL('../src/screens/visitor-tracking.tsx',import.meta.url),'utf8'),parsed=ts.createSourceFile('visitor-tracking.tsx',file,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),source=ts.createPrinter().printFile(ts.factory.updateSourceFile(parsed,parsed.statements.filter(node=>!ts.isImportDeclaration(node))))+'\nexport {TrackingGuestView};',code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText;
 const hosts=Object.fromEntries(['ScrollView','Text','View','Button','Copy','ErrorText','Field','LoadingSpinner','TrackingWorkspace','TrackingMap','Map','Camera'].map(name=>[name,name]));
 const ports={React,...hooks,...hosts,...refreshPolicy,useTrackingSession:()=>({controller,snapshot:controller.snapshot()}),useLanguage:()=>({t:value=>value}),useLocalSearchParams:()=>({}),palette:{ink:'#0b1d3a'},mapStyle:{},statusLabel:value=>value,Date:class extends Date{static now(){return now;}},setTimeout:(fn,delay)=>{const timer={fn,delay,cleared:false};timers.push(timer);return timer;},clearTimeout:timer=>timer.cleared=true},exports={};new Function(...Object.keys(ports),'exports',code)(...Object.values(ports),exports);
 return{calls,port,controller,timers,render(name='TrackingLinkAccess',props={}){slots=stores.get(name)||[];stores.set(name,slots);cursor=0;let tree=exports[name](props);if(tree?.type?.name==='TrackingLinkAccessView')tree=tree.type(tree.props);queued.splice(0).forEach(fn=>fn());return tree;},state:value=>state=value};
}
const nodes=tree=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];
const find=(tree,type,message)=>nodes(tree).find(node=>node.type===type&&(!message||node.props.message===message));
const settle=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};
test('link entry exposes failure/retry and never an email form or private map before both credentials succeed',async()=>{
 const h=screen();let tree=h.render();assert.equal(find(tree,'Field','Tracking link'),undefined);assert.ok(find(tree,'Field','Tracking ID'));assert.ok(find(tree,'Field','Tracking code'));
 tree=h.render('TrackingLinkAccess',{linkToken});assert.equal(find(tree,'Field','Tracking ID'),undefined);assert.equal(find(tree,'TrackingWorkspace'),undefined);assert.equal(find(tree,'Field','Your email'),undefined);
 find(tree,'Field','Tracking code').props.onChangeText('ABCD-EF23');tree=h.render('TrackingLinkAccess',{linkToken});
 const original=h.port.request;h.port.request=async()=>{throw Error('Unavailable');};find(tree,'Button','Open tracking').props.onPress();await settle();tree=h.render('TrackingLinkAccess',{linkToken});assert.ok(find(tree,'ErrorText').props.message);assert.equal(h.controller.snapshot().session,null);assert.equal(find(tree,'Button','Open tracking').props.busy,false);
 h.port.request=original;find(tree,'Button','Open tracking').props.onPress();await settle();assert.equal(h.controller.snapshot().session.id,id);
});
test('malformed refresh hides private content and a valid retry restores the exact session',async()=>{
 const h=screen();await h.controller.open(linkToken,'ABCD-EF23');let tree=h.render('TrackingGuestView');assert.ok(find(tree,'TrackingWorkspace'));assert.equal(find(tree,'PrivateFile'),undefined);assert.equal(find(tree,'TrackingSharing'),undefined);
 const original=h.port.request;h.port.request=async()=>({ok:true,data:{bad:'response'}});find(tree,'Button','Refresh updates').props.onPress();await settle();assert.equal(h.controller.snapshot().session,null);tree=h.render();assert.ok(find(tree,'Button','Refresh updates'));assert.ok(find(tree,'ErrorText').props.message);
 h.port.request=original;find(tree,'Button','Refresh updates').props.onPress();await settle();assert.equal(h.controller.snapshot().session.id,id);
});
test('transient refresh retains the existing map and authorization denial removes it',async()=>{
 const h=screen();await h.controller.open(linkToken,'ABCD-EF23');let tree=h.render('TrackingGuestView');h.port.request=async()=>{throw Object.assign(Error('Unavailable'),{status:503});};find(tree,'Button','Refresh updates').props.onPress();await settle();tree=h.render('TrackingGuestView');assert.ok(find(tree,'TrackingWorkspace'));assert.ok(find(tree,'ErrorText').props.message);
 h.port.request=async(path,options)=>{if(options?.method==='DELETE')return {ok:true};throw Object.assign(Error('Denied'),{status:403});};find(tree,'Button','Refresh updates').props.onPress();await settle();assert.equal(h.controller.snapshot().session,null);assert.equal(find(h.render(),'TrackingWorkspace'),undefined);
});
test('pending sessions have a route but no current location or started shipment progress; polling remains bounded',async()=>{
 const h=screen();h.state(view('PENDING_PROVIDER'));await h.controller.open(linkToken,'ABCD-EF23');let tree=h.render('TrackingGuestView');assert.ok(find(tree,'TrackingMap'));assert.equal(find(tree,'TrackingMap').props.location,undefined);assert.equal(find(tree,'TrackingWorkspace'),undefined);assert.equal(h.timers.filter(t=>!t.cleared).length,1);assert.equal(h.timers.at(-1).delay,60000);
 h.state({...view(),tracking:{...view().tracking,status:'COMPLETED'}});await h.controller.read(id);h.render('TrackingGuestView');assert.equal(h.timers.filter(t=>!t.cleared).length,0);h.controller.setForeground(false);assert.equal(h.controller.snapshot().session,null);
});
test('a different link entry never renders the previous load while its access is being cleared',async()=>{
 const h=screen();await h.controller.open(linkToken,'ABCD-EF23');const tree=h.render('TrackingLinkAccess',{linkToken:'b'.repeat(43)});
 assert.equal(find(tree,'TrackingWorkspace'),undefined);assert.equal(find(tree,'TrackingMap'),undefined);assert.ok(find(tree,'Field','Tracking code'));assert.equal(h.controller.snapshot().session,null);assert.equal(h.controller.matchesLink(linkToken),false);
});

test('the public Track tab sends the copied ID and code through the same access endpoint',async()=>{
 const h=screen();let tree=h.render();
 find(tree,'Field','Tracking ID').props.onChangeText(linkToken);
 find(tree,'Field','Tracking code').props.onChangeText('ABCD-EF23');
 tree=h.render();find(tree,'Button','Open tracking').props.onPress();await settle();
 assert.deepEqual(h.calls[0],{path:'/api/tracking/access',options:{body:{linkToken,code:'ABCDEF23'}}});
 assert.equal(h.controller.snapshot().session.id,id);
});
