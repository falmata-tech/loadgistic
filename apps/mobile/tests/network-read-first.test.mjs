import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const nodes=x=>!x||typeof x!=='object'?[]:Array.isArray(x)?x.flatMap(nodes):[x,...nodes(x.props?.children)];
function setup(request=async()=>{}){
 let slots=[],index=0;const React={createElement:(type,props,...children)=>({type,props:{...props,children}})};
 const hooks={useState:initial=>{const i=index++;if(!(i in slots))slots[i]=initial;return[slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},useRef:initial=>{const i=index++;return slots[i]||(slots[i]={current:initial});}};
 const parsed=ts.createSourceFile('network.tsx',readFileSync(new URL('../src/screens/network.tsx',import.meta.url),'utf8')+'\nexport {Sharing};',ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),source=ts.createPrinter().printFile(ts.factory.updateSourceFile(parsed,parsed.statements.filter(n=>!ts.isImportDeclaration(n))));
 const code=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS}}).outputText,exports={},ports={React,...hooks,useLanguage:()=>({t:m=>m}),useAccount:()=>({request}),capacitySharingLabel:()=> 'Public and private',...Object.fromEntries(['BusinessCapacitySharing','Card','Title','Copy','Field','Button','View','ErrorText','ConfirmationButton'].map(k=>[k,k]))};
 new Function(...Object.keys(ports),'exports',code)(...Object.values(ports),exports);
 return {render(truck={id:'truck',label:'Truck',driver:'Driver',sharingMode:'PUBLIC_PRIVATE',exclusiveEmail:'',loadgistic:false,grants:[]},reload=async()=>true){index=0;return exports.Sharing({truck,reload});}};
}
const find=(tree,type,message)=>nodes(tree).find(n=>n.type===type&&(!message||n.props.message===message));
test('network contact fields open only after Add contact and Cancel discards without saving',()=>{
 const writes=[],view=setup(async(...args)=>writes.push(args));let tree=view.render();assert.equal(find(tree,'Field'),undefined);find(tree,'Button','Add contact').props.onPress();tree=view.render();find(tree,'Field','Person or company name').props.onChangeText('Unsaved broker');find(tree,'Field','Share capacity with this email').props.onChangeText('test@example.test');find(tree,'Button','Cancel').props.onPress();tree=view.render();assert.equal(find(tree,'Field'),undefined);assert.deepEqual(writes,[]);find(tree,'Button','Add contact').props.onPress();tree=view.render();assert.equal(find(tree,'Field','Person or company name').props.value,'');
});
test('deliberate sharing keeps the exact truck, name and email contract and returns to saved view',async()=>{
 const writes=[],view=setup(async(path,body)=>writes.push({path,body}));let tree=view.render();find(tree,'Button','Add contact').props.onPress();tree=view.render();find(tree,'Field','Person or company name').props.onChangeText('Demo broker');find(tree,'Field','Share capacity with this email').props.onChangeText('broker@example.test');tree=view.render();find(tree,'Button','Add access').props.onPress();await new Promise(resolve=>setImmediate(resolve));tree=view.render();assert.deepEqual(writes,[{path:'/api/mobile/network',body:{action:'GRANT',vehicleId:'truck',name:'Demo broker',email:'broker@example.test'}}]);assert.equal(find(tree,'Field'),undefined);
});

test('an exclusive contact uses the saved email and prevents editing it',()=>{
 const view=setup(),truck={id:'truck',label:'Truck',driver:'Driver',sharingMode:'EXCLUSIVE',exclusiveEmail:'only@example.test',loadgistic:false,grants:[]};let tree=view.render(truck);find(tree,'Button','Add contact').props.onPress();tree=view.render(truck);const email=find(tree,'Field','Share capacity with this email');assert.equal(email.props.value,'only@example.test');assert.equal(email.props.editable,false);
});
test('confirmed save plus failed reread keeps recovery and never resends the write',async()=>{
 const writes=[],view=setup(async(path,body)=>writes.push({path,body}));let read=false,tree=view.render(undefined,async()=>read);find(tree,'Button','Add contact').props.onPress();tree=view.render(undefined,async()=>read);find(tree,'Field','Person or company name').props.onChangeText('Broker');find(tree,'Field','Share capacity with this email').props.onChangeText('broker@example.test');tree=view.render(undefined,async()=>read);find(tree,'Button','Add access').props.onPress();await new Promise(resolve=>setImmediate(resolve));tree=view.render(undefined,async()=>read);assert.equal(writes.length,1);assert.ok(find(tree,'Button','Reload saved change'));assert.equal(find(tree,'Field','Person or company name').props.value,'Broker');assert.equal(find(tree,'Button','Add access').props.disabled,true);assert.equal(nodes(tree).some(n=>n.type==='Copy'&&n.props.children.includes('Sharing updated.')),false);read=true;find(tree,'Button','Reload saved change').props.onPress();await new Promise(resolve=>setImmediate(resolve));tree=view.render(undefined,async()=>read);assert.equal(writes.length,1);assert.equal(find(tree,'Field'),undefined);
});
