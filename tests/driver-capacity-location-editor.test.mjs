import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const savedPhone={lat:9.03,lng:38.76,radius:5,area:'Around Addis Ababa',updatedAt:'2026-10-18T12:01:00Z'};
const snapshot=(source='MOBILE')=>({vehicleId:'truck',source,precisionKm:5,revision:'2026-10-18T12:00:00Z',manualPoint:source==='MANUAL'?{latitude:40.015,longitude:-105.27}:null});
const nodes=tree=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];
const button=(tree,message)=>nodes(tree).find(node=>node.type==='button'&&nodes(node.props.children).some(child=>child.props?.message===message));

function editorHarness(source,onDuty){
 let slots=[],cursor=0;const effects=[],calls=[],saved=[];
 const changed=(a,b)=>!a||a.length!==b.length||a.some((value,index)=>value!==b[index]);
 const React={createElement:(type,props,...children)=>({type,props:{...props,children:children.flat(Infinity)}}),
  useRef:initial=>{const i=cursor++;return slots[i]||(slots[i]={current:initial});},
  useState:initial=>{const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},
  useEffect:(fn,deps)=>{const i=cursor++;if(!slots[i]||changed(slots[i].deps,deps)){const previous=slots[i];slots[i]={deps};effects.push(()=>{previous?.cleanup?.();slots[i].cleanup=fn();});}}};
 const file=readFileSync('src/components/driver-capacity-location-editor.tsx','utf8');
 const parsed=ts.createSourceFile('driver-capacity-location-editor.tsx',file,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const sourceCode=ts.createPrinter().printFile(ts.factory.updateSourceFile(parsed,parsed.statements.filter(node=>!ts.isImportDeclaration(node))));
 const code=ts.transpileModule(sourceCode,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.React}}).outputText;
 const exports={},ports={React,fetch:async(_url,options)=>{calls.push(options?.method||'GET');return {ok:true,json:async()=>options?.method==='POST'?{ok:true,result:{revision:'2026-10-18T12:02:00Z'}}:snapshot(source)};},
  readDriverLocation:async()=>{calls.push('CAPTURE');return savedPhone;},saveDriverLocation:async()=>{calls.push('PHONE_REPORT');return savedPhone;},
  capacityPrivacyRadii:()=>[1,3,5,10,20],nextCapacityPrivacyRadius:value=>value||10,locationSourceLabel:()=>'',
  useTranslation:()=>({t:value=>value}),Text:'Text',ManualTruckLocation:'ManualTruckLocation',
  MapPinned:'MapPinned',Save:'Save',Smartphone:'Smartphone',exports};
 new Function(...Object.keys(ports),code)(...Object.values(ports));
 const props={vehicleId:'truck',location:null,publishedSource:null,onDuty,onBusyChange:()=>{},onSaved:(...values)=>saved.push(values),onCancel:()=>{}};
 return {calls,saved,render(){cursor=0;const tree=exports.DriverCapacityLocationEditor(props);while(effects.length)effects.shift()();return tree;}};
}
async function settle(){for(let i=0;i<20;i++)await Promise.resolve();}

test('explicit Off Duty phone capture is held for Available without a premature server report',async()=>{
 const h=editorHarness('MOBILE',false);h.render();await settle();const form=h.render();
 assert.equal(button(form,'Save location').props.disabled,false);
 await form.props.onSubmit({preventDefault(){}});
 assert.deepEqual(h.calls,['GET','CAPTURE']);
 assert.deepEqual(h.saved,[['MOBILE',savedPhone]]);
});

test('switching from manual to phone while Off Duty saves the choice and captures locally',async()=>{
 const h=editorHarness('MANUAL',false);h.render();await settle();let form=h.render();
 button(form,'Use my phone').props.onClick();form=h.render();await form.props.onSubmit({preventDefault(){}});
 assert.deepEqual(h.calls,['GET','CAPTURE','POST']);
 assert.deepEqual(h.saved,[['MOBILE',savedPhone]]);
});

test('an Available driver sends the chosen phone point to Capacity',async()=>{
 const h=editorHarness('MOBILE',true);h.render();await settle();const form=h.render();
 await form.props.onSubmit({preventDefault(){}});
 assert.deepEqual(h.calls,['GET','CAPTURE','PHONE_REPORT']);
 assert.deepEqual(h.saved,[['MOBILE',savedPhone]]);
});

test('GPS source awaits an explicit driver choice instead of preselecting Manual',async()=>{
 const h=editorHarness('GPS',true);h.render();await settle();const form=h.render();
 assert.equal(button(form,'Use my phone').props['aria-pressed'],false);
 assert.equal(button(form,'Choose on map').props['aria-pressed'],false);
 assert.equal(button(form,'Save location').props.disabled,true);
 assert.deepEqual(h.calls,['GET']);
});
