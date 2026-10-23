import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

// Exercise the actual Fleet summary renderers with their private server DTO.
// This does not replace the separate database and browser/native workflow checks.
const phone={installationId:'00000000-0000-4000-8000-000000000001',connected:true,lastObservedAt:'2026-10-18T12:34:00Z',expiresAt:'2026-10-18T13:04:00Z',accuracyMeters:12.5,speedKph:0,headingDegrees:90};
const vehicle={id:'truck',label:'Truck',selection:{source:'MOBILE',precisionKm:5,revision:'2026-10-18T12:00:00Z'},phone,published:{source:'GPS',updatedAt:'2026-10-17T12:00:00Z'}};
function runtime(path){
 let state=[],cursor=0;
 const React={createElement:(type,props,...children)=>({type,props:{...props,children:children.flat(Infinity)}}),useState:initial=>{const index=cursor++;if(!(index in state))state[index]=initial;return[state[index],value=>{state[index]=typeof value==='function'?value(state[index]):value;}];},useEffect(){}};
 const hosts=Object.fromEntries(['View','Text','Button','Copy','WorkspaceFact','Pencil','Satellite','Smartphone','CapacityEditDialog'].map(name=>[name,name]));
 const args={React,useState:React.useState,useEffect:React.useEffect,...hosts,Platform:{OS:'android'},palette:{ink:'#0b1d3a',blue:'#155eef',border:'#cbd5e1',muted:'#526375'},styles:new Proxy({},{get:(_value,key)=>String(key)}),useTranslation:()=>({t:message=>message,locale:'en-US'}),useLanguage:()=>({t:message=>message,locale:'en-US'})};
 const file=readFileSync(path,'utf8'),parsed=ts.createSourceFile(path,file,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const source=ts.createPrinter().printFile(ts.factory.updateSourceFile(parsed,parsed.statements.filter(node=>!ts.isImportDeclaration(node))));
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText;
 const exports={};new Function(...Object.keys(args),'exports',`${code}\nexports.summary=SourceSummary;exports.phone=PhoneSourceSummary;`)(...Object.values(args),exports);
 const resolve=value=>Array.isArray(value)?value.map(resolve):!value||typeof value!=='object'?value:typeof value.type==='function'?resolve(value.type(value.props)):{...value,props:{...value.props,children:resolve(value.props.children)}};
 return {render:props=>{cursor=0;return resolve(exports.summary(props));},reset:()=>{state=[];}};
}
const nodes=value=>!value||typeof value!=='object'?[]:Array.isArray(value)?value.flatMap(nodes):[value,...nodes(value.props?.children)];
const copy=value=>!value?'':typeof value==='string'||typeof value==='number'?String(value):Array.isArray(value)?value.map(copy).join(' '):[value.props?.message,value.props?.value,copy(value.props?.children)].filter(Boolean).join(' ');
const props=next=>({vehicle:next,busy:false,save:async()=>{throw Error('Read-first summary must not save');},markDirty(){},onEditing(){}});
for(const [name,path] of [['web','src/components/fleet-devices.tsx'],['mobile','apps/mobile/src/components/fleet-devices.tsx']]){
 test(`${name} Fleet shows the private Phone ID and real nullable observations without calling a link a live GPS signal`,()=>{
  const view=runtime(path),tree=view.render(props(vehicle)),text=copy(tree);
  assert.ok(text.includes(phone.installationId));assert.ok(text.includes('Phone link active'));
  assert.ok(text.includes('12.5 m'));assert.ok(text.includes('0 km/h'),'zero speed is an actual observation');assert.ok(text.includes('90 °'));
  assert.ok(text.includes(new Date(phone.lastObservedAt).toLocaleString('en-US')),'show actual phone observation time');
  assert.equal(text.includes(new Date(vehicle.published.updatedAt).toLocaleString('en-US')),false,'an older GPS publication is not the phone report time');
  for(const unwanted of ['IMEI','Ignition','Battery','Engine control','Connected','Exact location'])assert.equal(text.includes(unwanted),false,unwanted);
  assert.equal(nodes(tree).some(node=>node.type==='form'||node.type==='input'),false,'no editor opens on entry');
  const identifier=nodes(tree).find(node=>(name==='mobile'?node.type==='Text':node.type==='code')&&copy(node)===phone.installationId);assert.ok(identifier);
  if(name==='mobile')assert.equal(identifier.props.selectable,true);else assert.equal(identifier.type,'code');
 });
 test(`${name} Fleet separates an active binding from receiving a fix, and retains honest inactive history`,()=>{
  const view=runtime(path),blank={...phone,lastObservedAt:null,accuracyMeters:null,speedKph:null,headingDegrees:null};
  let text=copy(view.render(props({...vehicle,phone:blank,published:null})));
  assert.ok(text.includes('Phone link active'));assert.equal((text.match(/Not reported yet/g)||[]).length,4);assert.equal(text.includes('0 km/h'),false);
  text=copy(view.render(props({...vehicle,phone:{...phone,connected:false}})));
  assert.ok(text.includes('Phone link inactive'));assert.ok(text.includes(phone.installationId));assert.ok(text.includes(new Date(phone.lastObservedAt).toLocaleString('en-US')));
 });
 test(`${name} Fleet explains an unlinked phone and does not show Phone ID for a GPS/manual source`,()=>{
  const view=runtime(path);let text=copy(view.render(props({...vehicle,phone:null})));
  assert.ok(text.includes('No phone linked'));assert.ok(text.includes('Open the Loadgistic app on the assigned driver’s phone to link it.'));
  for(const source of ['GPS','MANUAL']){text=copy(view.render(props({...vehicle,selection:{...vehicle.selection,source}})));assert.equal(text.includes(phone.installationId),false);assert.equal(text.includes('Phone link active'),false);}
 });
}
