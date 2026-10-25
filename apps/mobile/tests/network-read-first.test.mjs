import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const nodes=value=>!value||typeof value!=='object'?[]:Array.isArray(value)?value.flatMap(nodes):[value,...nodes(value.props?.children)];
function renderSharing(truck){
 const parsed=ts.createSourceFile('network.tsx',readFileSync(new URL('../src/screens/network.tsx',import.meta.url),'utf8')+'\nexport {Sharing};',ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const source=ts.createPrinter().printFile(ts.factory.updateSourceFile(parsed,parsed.statements.filter(node=>!ts.isImportDeclaration(node))));
 const compiled=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS}}).outputText;
 const React={createElement:(type,props,...children)=>({type,props:{...props,children}})};
 const ports={React,useLanguage:()=>({t:message=>message}),capacitySharingLabel:()=> 'Private network',...Object.fromEntries(['AccountVehicleSharing','BusinessCapacitySharing','Card','Title','Copy'].map(name=>[name,name]))};
 const exports={};new Function(...Object.keys(ports),'exports',compiled)(...Object.values(ports),exports);
 return nodes(exports.Sharing({truck,reload:async()=>true,connections:[]}));
}

test('provider Network offers only account-bound vehicle sharing on Expo',()=>{
 const items=renderSharing({id:'vehicle',label:'Truck',driver:'Driver',sharingMode:'PRIVATE',accountGrants:[],businessGrants:[]});
 assert.equal(items.find(item=>item.type==='AccountVehicleSharing')?.props.vehicleId,'vehicle');
 assert.equal(items.find(item=>item.type==='BusinessCapacitySharing')?.props.vehicleId,'vehicle');
 assert.equal(items.some(item=>['Field','ConfirmationButton'].includes(item.type)),false,'no email contact or grant editor');
});

test('legacy exclusive policy stays read-only until changed to account sharing',()=>{
 const items=renderSharing({id:'vehicle',label:'Truck',driver:'Driver',sharingMode:'EXCLUSIVE',accountGrants:[],businessGrants:[]});
 assert.equal(items.find(item=>item.type==='AccountVehicleSharing')?.props.exclusive,true);
 assert.equal(items.find(item=>item.type==='BusinessCapacitySharing')?.props.exclusive,true);
 assert.equal(items.some(item=>item.type==='Field'),false);
});
