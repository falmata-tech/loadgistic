import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const configurations=[{name:'Cargo van',image:'/vehicle-configurations/cargo-van.jpg'},{name:'Mini Box Truck',image:'/vehicle-configurations/mini-box-truck.jpg'}];
const node=(type,props,key)=>({type,props:props||{},key});
function component(name){
 const source=readFileSync(new URL(`../src/components/${name}.tsx`,import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const choices={vehicleCategory:configurations.map(item=>item.name),status:['EMPTY','PARTIAL'],locationSource:['GPS','MOBILE','MANUAL']};
 // These tests exercise the actual controls. The shared parser has its own
 // backend suite; this narrow stub supplies its canonical CSV port contract.
 const values=(key,value)=>{const result=value?String(value).split(','):[];if(result.some(item=>!choices[key].includes(item)))throw Error('INVALID_CAPACITY_FILTER');return [...new Set(result)].sort();};
 let state=false;
 const dependencies={react:{useRef:()=>({current:null}),useState:()=>[state,value=>{state=value;}],useId:()=>':control:'},'react/jsx-runtime':{jsx:node,jsxs:node},'next/image':{__esModule:true,default:'Image'},'lucide-react':{Check:'Check',ChevronDown:'ChevronDown',Truck:'Truck'},'@/lib/vehicle-configurations':{VEHICLE_CONFIGURATIONS:configurations},'@/lib/capacity-filter-values.js':{capacityFilterValues:values,capacityFilterValue:(key,value)=>values(key,value.join(',')).join(',')},'./localization':{Text:'Text',useTranslation:()=>({t:message=>message})}};
 const exports={};new Function('require','exports',compiled)(key=>{assert.ok(key in dependencies,`unexpected component dependency ${key}`);return dependencies[key];},exports);
 return exports;
}
function all(tree,predicate){if(Array.isArray(tree))return tree.flatMap(child=>all(child,predicate));if(!tree||typeof tree!=='object')return[];return [...(predicate(tree)?[tree]:[]),...all(tree.props?.children,predicate)];}
const inputs=tree=>all(tree,item=>item.type==='input');

test('configuration picker keeps its default single configuration mode',()=>{
 const {CapacityConfigurationPicker}=component('capacity-configuration-picker'),changes=[];
 const tree=CapacityConfigurationPicker({value:'Cargo van',onChange:value=>changes.push(value)}),radios=inputs(tree).filter(item=>item.props.type==='radio');
 assert.equal(radios.length,configurations.length+1);assert.equal(radios.find(item=>item.props.value==='Cargo van').props.checked,true);
 radios.find(item=>item.props.value==='Mini Box Truck').props.onChange();assert.deepEqual(changes,['Mini Box Truck']);
});

test('filter configuration mode retains multiple pictures and one canonical submitted value',()=>{
 const {CapacityConfigurationPicker}=component('capacity-configuration-picker');let value='Cargo van';
 const render=()=>CapacityConfigurationPicker({multiple:true,value,onChange:next=>{value=next;}});
 let tree=render();assert.equal(inputs(tree).filter(item=>item.props.type==='radio').length,0);
 const options=inputs(tree).filter(item=>item.props.type==='checkbox');assert.equal(options.length,configurations.length);
 options.find(item=>item.props.value==='Mini Box Truck').props.onChange({target:{checked:true}});
 assert.equal(value,'Cargo van,Mini Box Truck');tree=render();
 assert.equal(inputs(tree).filter(item=>item.props.name==='vehicleCategory').length,1);
 assert.equal(inputs(tree).find(item=>item.props.name==='vehicleCategory').props.value,value);
 assert.ok(inputs(tree).filter(item=>item.props.type==='checkbox').every(item=>item.props.checked));
 assert.equal(all(tree,item=>item.type==='Image').length,configurations.length+1);
 all(tree,item=>item.type==='button').find(item=>item.props['data-clear-options']).props.onClick();assert.equal(value,'');
});

test('opening configuration choices loads their pictures without changing the submitted selection',()=>{
 const {CapacityConfigurationPicker}=component('capacity-configuration-picker');const render=()=>CapacityConfigurationPicker({multiple:true,value:'Cargo van',onChange:()=>assert.fail('Opening pictures must not change the selection')});
 let tree=render();const optionImages=()=>all(tree,item=>item.type==='Image').slice(1);
 assert.ok(optionImages().every(image=>image.props.loading==='lazy'));
 all(tree,item=>item.type==='details')[0].props.onToggle({currentTarget:{open:true}});tree=render();
 assert.ok(optionImages().every(image=>image.props.loading==='eager'));
 assert.equal(inputs(tree).find(item=>item.props.name==='vehicleCategory').props.value,'Cargo van');
 all(tree,item=>item.type==='details')[0].props.onToggle({currentTarget:{open:false}});tree=render();
 assert.ok(optionImages().every(image=>image.props.loading==='lazy'));
});

test('multi option groups toggle independently, preserve malformed input for denial and clear explicitly',()=>{
 const {CapacityMultiOptions}=component('capacity-multi-options');let value='EMPTY';
 const props={name:'status',label:"Truck's current load",anyLabel:'Any available truck',options:[['EMPTY','Empty truck'],['PARTIAL','Partly loaded']],onChange:next=>{value=next;}};
 const render=()=>CapacityMultiOptions({...props,value});
 let tree=render();inputs(tree).find(item=>item.props.value==='PARTIAL').props.onChange({target:{checked:true}});assert.equal(value,'EMPTY,PARTIAL');
 tree=render();inputs(tree).find(item=>item.props.value==='EMPTY').props.onChange({target:{checked:false}});assert.equal(value,'PARTIAL');
 value='UNSUPPORTED';tree=render();assert.equal(inputs(tree).find(item=>item.props.type==='hidden').props.value,'UNSUPPORTED');
 assert.ok(inputs(tree).filter(item=>item.props.type==='checkbox').every(item=>!item.props.checked));
 all(tree,item=>item.type==='button').find(item=>item.props['data-clear-options']).props.onClick();assert.equal(value,'');
});

test('location source is a canonical multi-select that can be cleared',()=>{
 const {CapacityMultiOptions}=component('capacity-multi-options');let value='';
 const props={name:'locationSource',label:'Location source',anyLabel:'Any location source',options:[['GPS','GPS device'],['MOBILE','Driver’s phone'],['MANUAL','Manually entered']],onChange:next=>{value=next;}};
 const render=()=>CapacityMultiOptions({...props,value});
 let tree=render();inputs(tree).find(item=>item.props.value==='MOBILE').props.onChange({target:{checked:true}});
 tree=render();inputs(tree).find(item=>item.props.value==='GPS').props.onChange({target:{checked:true}});
 assert.equal(value,'GPS,MOBILE');assert.equal(inputs(render()).find(item=>item.props.name==='locationSource').props.value,'GPS,MOBILE');
 all(render(),item=>item.type==='button').find(item=>item.props['data-clear-options']).props.onClick();
 assert.equal(value,'');assert.ok(inputs(render()).filter(item=>item.props.type==='checkbox').every(item=>!item.props.checked));
});

test('location source options have localized labels in every supported web language',()=>{
 for(const locale of ['am','om']){
  const messages=JSON.parse(readFileSync(new URL(`../src/lib/i18n/messages/${locale}.json`,import.meta.url),'utf8'));
  for(const label of ['Location source','Any location source','GPS device','Driver’s phone','Manually entered']){
   assert.ok(messages[label],`${locale}: ${label}`);
   assert.notEqual(messages[label],label,`${locale}: ${label} should not fall back to English`);
  }
 }
});
