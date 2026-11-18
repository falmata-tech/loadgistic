import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as contracts from '../src/lib/tracking-sessions/contracts.ts';
import {trackingLinkToken} from '../src/lib/tracking-sessions/client.ts';
import * as refreshPolicy from '../src/lib/tracking-refresh-policy.js';
const id='16000000-0000-4000-8000-000000000001',shipmentId='16000000-0000-4000-8000-000000000002',linkId='16000000-0000-4000-8000-000000000003',url=`https://loadgistic.com/track/${'a'.repeat(43)}`;
const view=()=>({id,reference:'Saved load',state:'CONNECTED',revision:1,workspaceId:null,shipmentId,route:[{placeRef:'A',label:'A',coordinate:[38,9]},{placeRef:'B',label:'B',coordinate:[39,10]}],cargoSummary:'Saved cargo',pickupDate:'',deliveryDate:'',capabilities:{canIssueLink:true,canRevokeLink:true,canAcceptProvider:false,canReview:true,canManageTeam:false},links:[],tracking:{shipmentId,code:'Saved reference',status:'COMPLETED',updatedAt:'2027-01-15T08:00:00Z',trackingMode:'STATUS_ONLY',location:null,events:[]}});
const issue={link:{id:linkId,url,code:'ABCD-EF23',expiresAt:'2027-01-22T08:00:00Z',allowLocation:false}};
const reply=(data,status=200)=>({response:{ok:status===200,status},data:{ok:status===200,data}});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const settle=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
function harness(component='TrackingSessionManager'){
 let cursor=0,slots=[],queued=[],props={sessionId:id};const calls=[],timers=[],listeners=new Map(),port={request:async(path,options)=>reply(options?.method?issue:view())};
 const hooks={useId:()=>{const index=cursor++;return slots[index]||(slots[index]='tracking-field-'+index);},useState:initial=>{const index=cursor++;if(!(index in slots))slots[index]=typeof initial==='function'?initial():initial;return[slots[index],value=>slots[index]=typeof value==='function'?value(slots[index]):value];},useRef:initial=>{const index=cursor++;return slots[index]||(slots[index]={current:initial});},useCallback:(callback,deps)=>{const index=cursor++,old=slots[index];if(!old||deps.some((value,i)=>!Object.is(value,old.deps[i])))slots[index]={deps,callback};return slots[index].callback;},useEffect:(fn,deps)=>{const index=cursor++,old=slots[index];if(!old||deps.some((value,i)=>!Object.is(value,old.deps[i]))){slots[index]={deps};queued.push(()=>{old?.cleanup?.();slots[index].cleanup=fn();});}}};
 const React={...hooks,createElement:(type,props,...children)=>({type,props:{...props,children:children.flat(Infinity)}})};
 const path='src/components/tracking-session-manager.tsx',parsed=ts.createSourceFile(path,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),source=ts.createPrinter().printFile(ts.factory.updateSourceFile(parsed,parsed.statements.filter(node=>!ts.isImportDeclaration(node)))),code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText,exports={};
 const ports={React,...contracts,...refreshPolicy,trackingLinkToken,trackingStatusLabels:{},Text:'Text',SurfaceSkeleton:'SurfaceSkeleton',TrackingProofLink:'TrackingProofLink',TrackingRequests:'TrackingRequests',TrackingLocationMap:'TrackingLocationMap',TrackingSharing:'TrackingSharing',DatePicker:'DatePicker',EthiopiaPlaceInput:'EthiopiaPlaceInput',useTranslation:()=>({t:value=>value}),browserRequest:async(path,options)=>{calls.push({path,options});return port.request(path,options);},document:{visibilityState:'visible',addEventListener:(event,fn)=>listeners.set(event,fn),removeEventListener:(event,fn)=>{if(listeners.get(event)===fn)listeners.delete(event);}},window:{addEventListener:(event,fn)=>listeners.set(event,fn),removeEventListener:(event,fn)=>{if(listeners.get(event)===fn)listeners.delete(event);}},setTimeout:(fn,delay)=>{const timer={fn:()=>{timer.fired=true;return fn();},delay,cleared:false,fired:false};timers.push(timer);return timer;},clearTimeout:timer=>{timer.cleared=true;}};
 new Function(...Object.keys(ports),'exports',code)(...Object.values(ports),exports);
 return {calls,port,timers,render(next=props){props=next;cursor=0;const tree=exports[component](props);queued.splice(0).forEach(fn=>fn());return tree;},unmount(){for(const slot of slots)slot?.cleanup?.();}};
}
const nodes=tree=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];
const find=(tree,type,check=()=>true)=>nodes(tree).find(node=>node.type===type&&check(node));
const labelled=(tree,type,message)=>find(tree,type,node=>nodes(node).some(child=>child.type==='Text'&&child.props.message===message));
const map=tree=>find(tree,'TrackingLocationMap');
const secret=tree=>find(tree,'input',node=>node.props.value===issue.link.code);
async function ready(h){h.render();await settle();return h.render();}
test('held refresh and a failed issue readback retain saved map, drafts and once-shown credentials until recovery',async()=>{
 const h=harness();let tree=await ready(h);const form=labelled(tree,'form','Create Tracking link');find(form,'select').props.onChange({target:{value:'14'}});find(form,'input').props.onChange({target:{checked:true}});tree=h.render();
 const held=deferred();h.port.request=async(path,options)=>options?.method?reply(issue):held.promise;labelled(tree,'form','Create Tracking link').props.onSubmit({preventDefault(){}});await settle();tree=h.render();assert.ok(map(tree));assert.ok(secret(tree));assert.equal(find(labelled(tree,'form','Create Tracking link'),'select').props.value,14);assert.equal(h.calls.filter(call=>call.options?.method==='POST').length,1);
 held.resolve(reply(null,503));await settle();tree=h.render();assert.ok(map(tree));assert.ok(secret(tree));assert.ok(find(tree,'p',node=>node.props.role==='alert'));assert.equal(find(labelled(tree,'form','Create Tracking link'),'button').props.disabled,true);
 h.port.request=async()=>reply(view());labelled(tree,'button','Refresh Tracking').props.onClick();await settle();tree=h.render();assert.ok(map(tree));assert.ok(secret(tree));assert.equal(find(labelled(tree,'form','Create Tracking link'),'select').props.value,14);assert.equal(find(labelled(tree,'form','Create Tracking link'),'input').props.checked,true);assert.equal(find(labelled(tree,'form','Create Tracking link'),'button').props.disabled,false);assert.equal(h.calls.filter(call=>call.options?.method==='POST').length,1);h.unmount();
});
test('automatic refresh uses the existing minute policy without resetting drafts, credentials or adding writes',async()=>{
 const h=harness();h.port.request=async(path,options)=>reply(options?.method?issue:{...view(),tracking:{...view().tracking,status:'IN_TRANSIT'}});let tree=await ready(h);find(labelled(tree,'form','Publish review'),'textarea').props.onChange({target:{value:'Unsaved review'}});labelled(tree,'form','Create Tracking link').props.onSubmit({preventDefault(){}});await settle();tree=h.render();assert.ok(secret(tree));const timer=h.timers.find(timer=>!timer.cleared);assert.ok(timer);assert.equal(timer.delay,60000);const reads=h.calls.length;timer.fn();await settle();tree=h.render();assert.equal(h.calls.length,reads+1);assert.equal(h.calls.at(-1).options.method,undefined);assert.ok(secret(tree));assert.equal(find(labelled(tree,'form','Publish review'),'textarea').props.value,'Unsaved review');assert.equal(h.calls.filter(call=>call.options.method==='POST').length,1);h.unmount();assert.ok(h.timers.every(timer=>timer.cleared||timer.fired));
});
test('authoritative denial clears saved map and once-shown credentials, while identity changes cannot accept late reads',async()=>{
 for(const status of[401,403,404,410]){const h=harness();let tree=await ready(h);labelled(tree,'form','Create Tracking link').props.onSubmit({preventDefault(){}});await settle();tree=h.render();assert.ok(secret(tree));h.port.request=async()=>reply(null,status);labelled(tree,'button','Refresh Tracking').props.onClick();await settle();tree=h.render();assert.equal(map(tree),undefined);assert.equal(secret(tree),undefined);h.unmount();}
 const h=harness();let tree=await ready(h);const old=deferred();h.port.request=()=>old.promise;labelled(tree,'button','Refresh Tracking').props.onClick();h.render({sessionId:shipmentId});old.resolve(reply(view()));await settle();tree=h.render();assert.equal(map(tree),undefined);assert.equal(secret(tree),undefined);h.unmount();
});
test('review uses explicit current capability and exact normal command, then renders saved review without guest/team powers',async()=>{
 const h=harness();let tree=await ready(h);assert.equal(find(tree,'TrackingSharing'),undefined);find(labelled(tree,'form','Publish review'),'textarea').props.onChange({target:{value:'  Useful update  '}});find(labelled(tree,'form','Publish review'),'input').props.onChange({target:{checked:true}});tree=h.render();let saved=view();h.port.request=async(path,options)=>{if(options?.method){assert.equal(path,`/api/tracking/sessions/${id}/review`);assert.deepEqual(JSON.parse(options.body),{rating:5,note:'Useful update',termsAccepted:true});saved={...saved,capabilities:{...saved.capabilities,canReview:false},tracking:{...saved.tracking,review:{rating:5,note:'Useful update'}}};return reply({});}return reply(saved);};labelled(tree,'form','Publish review').props.onSubmit({preventDefault(){}});await settle();tree=h.render();assert.ok(labelled(tree,'section','Your review'));assert.equal(labelled(tree,'form','Publish review'),undefined);h.unmount();
 const denied=harness();denied.port.request=async()=>reply({...view(),capabilities:{canIssueLink:false,canRevokeLink:false,canAcceptProvider:false,canReview:false,canManageTeam:false}});tree=await ready(denied);assert.equal(labelled(tree,'form','Publish review'),undefined);assert.equal(find(tree,'TrackingSharing'),undefined);denied.unmount();
});

test('owner link expiry and review rating retain distinct explicit accessible labels',async()=>{
 const h=harness(),tree=await ready(h);
 const selectors=['Link expiry','Rating'].map(message=>{
  const label=labelled(tree,'label',message);assert.ok(label);assert.equal(find(label,'select'),undefined);
  const select=find(tree,'select',node=>node.props.id===label.props.htmlFor);assert.ok(select);assert.ok(label.props.htmlFor);return select;
 });
 assert.notEqual(selectors[0].props.id,selectors[1].props.id);assert.equal(selectors[0].props.value,7);assert.equal(selectors[1].props.value,5);h.unmount();
});

test('shipment list waits for the first result, retains saved cards on retry and clears private details on denial',async()=>{
 const h=harness('SessionList'),pending=deferred();
 h.port.request=()=>pending.promise;
 let tree=h.render({});
 assert.ok(find(tree,'SurfaceSkeleton'));
 assert.equal(labelled(tree,'p','No Tracking sessions yet.'),undefined);
 pending.resolve(reply({workspaceId:null,total:1,page:1,pageCount:1,sessions:[view()]}));
 await settle();tree=h.render();
 const card=()=>find(tree,'button',node=>node.props.className==='card text-left');
 assert.ok(card());card().props.onClick();tree=h.render();
 const detail=()=>nodes(tree).find(node=>node.type?.name==='TrackingSessionManager');
 assert.equal(detail().props.sessionId,id);
 h.port.request=async()=>reply(null,503);
 labelled(tree,'button','Refresh Tracking').props.onClick();await settle();tree=h.render();
 assert.ok(card());assert.ok(detail());assert.ok(find(tree,'p',node=>node.props.role==='alert'));
 h.port.request=async()=>reply(null,403);
 labelled(tree,'button','Refresh Tracking').props.onClick();await settle();tree=h.render();
 assert.equal(card(),undefined);assert.equal(detail(),undefined);
 h.port.request=async()=>reply({workspaceId:null,total:0,page:1,pageCount:1,sessions:[]});
 labelled(tree,'button','Refresh Tracking').props.onClick();await settle();tree=h.render();
 assert.ok(labelled(tree,'p','No Tracking sessions yet.'));assert.equal(find(tree,'SurfaceSkeleton'),undefined);
 h.unmount();
});
