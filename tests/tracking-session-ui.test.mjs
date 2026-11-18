import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {trackingSessionAccessSchema,trackingSessionViewSchema} from '../src/lib/tracking-sessions/contracts.ts';
import {trackingLinkToken,trackingAccessCode,guestTrackingSession} from '../src/lib/tracking-sessions/client.ts';
const token='a'.repeat(43),id='16000000-0000-4000-8000-000000000001';
const session=()=>({id,reference:'Local load',state:'PENDING_PROVIDER',revision:1,workspaceId:null,shipmentId:null,route:[{placeRef:'A',label:'A',coordinate:[38,9]},{placeRef:'B',label:'B',coordinate:[39,10]}],cargoSummary:'Local cargo',pickupDate:'',deliveryDate:'',capabilities:{canIssueLink:false,canRevokeLink:false,canAcceptProvider:false},links:[],tracking:null});
function harness(request,props={linkToken:token},component='TrackingUnlockForm'){
 let slots=[],cursor=0;const calls=[];
 const React={useId:()=>{const index=cursor++;return slots[index]||(slots[index]='tracking-control-'+index);},createElement:(type,props,...children)=>({type,props:{...props,children:children.flat(Infinity)}}),useState:initial=>{const index=cursor++;if(!(index in slots))slots[index]=typeof initial==='function'?initial():initial;return[slots[index],value=>slots[index]=typeof value==='function'?value(slots[index]):value];},useRef:initial=>{const index=cursor++;return slots[index]||(slots[index]={current:initial});}};
 const path=component==='ConnectTracking'?'src/components/connect-tracking.tsx':'src/components/tracking-unlock-form.tsx',parsed=ts.createSourceFile(path,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),source=ts.createPrinter().printFile(ts.factory.updateSourceFile(parsed,parsed.statements.filter(node=>!ts.isImportDeclaration(node)))),code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText,exports={};
 const ports={React,KeyRound:'KeyRound',LoaderCircle:'LoaderCircle',TrackingEntryMap:'TrackingEntryMap',TrackingSessionGuest:'TrackingSessionGuest',Text:'Text',useTranslation:()=>({t:value=>value}),trackingSessionAccessSchema,trackingSessionViewSchema,trackingLinkToken,trackingAccessCode,guestTrackingSession,browserRequest:async(path,options)=>{calls.push({path,options});return request(path,options);}};
 new Function(...Object.keys(ports),'exports',code)(...Object.values(ports),exports);return {calls,render(){cursor=0;return exports[component](props);}};
}
const nodes=tree=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];
const find=(tree,type,check=()=>true)=>nodes(tree).find(node=>node.type===type&&check(node));
const entered=h=>{let tree=h.render();find(tree,'input',node=>node.props.name==='trackingCode').props.onChange({target:{value:'ABCD-EF23'}});return h.render();};
const accepted=()=>({response:{ok:true},data:{ok:true,data:{session:session(),grant:'private.grant',expiresAt:new Date(Date.now()+300000).toISOString()}}});
test('web entry keeps a neutral map and POST-only form without email or preauthorized load data',()=>{
 const h=harness(async()=>assert.fail('No request before explicit submit')),tree=h.render(),form=find(tree,'form');assert.ok(find(tree,'TrackingEntryMap'));assert.equal(find(tree,'TrackingSessionGuest'),undefined);assert.equal(form.props.method,'post');assert.equal(form.props.action,'/api/tracking/access');assert.equal(find(tree,'input',node=>node.props.type==='email'),undefined);assert.equal(h.calls.length,0);
});
test('both credentials open exactly one read-only load and clearing access removes the typed code',async()=>{
 const h=harness(async()=>accepted());let tree=entered(h);await find(tree,'form').props.onSubmit({preventDefault(){}});tree=h.render();assert.equal(h.calls.length,1);assert.equal(h.calls[0].path,'/api/tracking/access');assert.deepEqual(JSON.parse(h.calls[0].options.body),{linkToken:token,code:'ABCDEF23'});const guest=find(tree,'TrackingSessionGuest');assert.equal(guest.props.initial.session.id,id);assert.equal(find(tree,'form'),undefined);guest.props.onClosed();tree=h.render();assert.equal(find(tree,'input',node=>node.props.name==='trackingCode').props.value,'');
});
test('invalid or mismatched credentials retain retry without rendering private data or requesting email',async()=>{
 const h=harness(async()=>({response:{ok:false},data:{ok:false,error:{message:'PRIVATE_SENTINEL'}}}));let tree=entered(h);await find(tree,'form').props.onSubmit({preventDefault(){}});tree=h.render();assert.equal(find(tree,'TrackingSessionGuest'),undefined);assert.equal(find(tree,'button').props.disabled,false);assert.ok(find(tree,'p',node=>node.props.role==='alert'));assert.equal(JSON.stringify(tree).includes('PRIVATE_SENTINEL'),false);assert.equal(h.calls.filter(call=>call.path.includes('otp')).length,0);
});
test('double submit is single-flight and malformed manager data cannot become guest access',async()=>{
 let resolve;const h=harness(()=>new Promise(done=>resolve=done)),tree=entered(h),form=find(tree,'form');const first=form.props.onSubmit({preventDefault(){}}),second=form.props.onSubmit({preventDefault(){}});assert.equal(h.calls.length,1);const result=accepted();result.data.data.session.capabilities.canIssueLink=true;resolve(result);await Promise.all([first,second]);assert.equal(find(h.render(),'TrackingSessionGuest'),undefined);
});
test('signed-cookie resume uses only the bound session ID/expiry and does not enter an email or credential flow',()=>{
 const expiresAt=new Date(Date.now()+300000).toISOString(),h=harness(()=>assert.fail('No implicit unlock'),{linkToken:token,resumeSessionId:id,resumeExpiresAt:expiresAt}),tree=h.render(),guest=find(tree,'TrackingSessionGuest');assert.equal(guest.props.sessionId,id);assert.equal(guest.props.expiresAt,expiresAt);assert.equal(h.calls.length,0);assert.equal(find(tree,'input'),undefined);
});

test('provider connect uses a distinct explicit vehicle label after opening the agreed load',async()=>{
 const vehicleId='16000000-0000-4000-8000-000000000002';
 const h=harness(async()=>accepted(),{vehicles:[{id:vehicleId,label:'Synthetic assigned vehicle'}]},'ConnectTracking');
 let tree=h.render();find(tree,'button').props.onClick();tree=h.render();
 const inputs=nodes(tree).filter(node=>node.type==='input');inputs[0].props.onChange({target:{value:token}});inputs[1].props.onChange({target:{value:'ABCD-EF23'}});
 tree=h.render();await find(tree,'form').props.onSubmit({preventDefault(){}});tree=h.render();
 const label=find(tree,'label',node=>nodes(node).some(child=>child.type==='Text'&&child.props.message==='Vehicle and assigned driver'));
 const select=find(tree,'select');assert.ok(label);assert.ok(select);assert.equal(label.props.htmlFor,select.props.id);assert.ok(select.props.id);assert.equal(find(label,'select'),undefined);assert.equal(select.props.value,vehicleId);
 assert.equal(h.calls.length,1);assert.equal(h.calls[0].path,'/api/tracking/access');
});
