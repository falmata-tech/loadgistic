import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

// Execute actual screen state and submit handlers; native hosts and authorized
// HTTP are substituted. This does not stand in for SQL or physical-device proof.
function runtime(data,request=async()=>{}){
 const stores=new Map();let slots=[],cursor=0,backs=0;
 const React={createElement:(type,props,...children)=>({type,key:props?.key,props:{...props,children:children.flat(Infinity)}}),Fragment:'Fragment'};
 const hooks={useState:initial=>{const state=slots,index=cursor++;if(!(index in state))state[index]=typeof initial==='function'?initial():initial;return[state[index],value=>{state[index]=typeof value==='function'?value(state[index]):value;}];},useRef:initial=>{const index=cursor++;return slots[index]||(slots[index]={current:initial});}};
 class ApiError extends Error{constructor(status){super('Request needs reloading.');this.status=status;}}
 const hosts=Object.fromEntries(['Page','Title','Copy','Card','Field','Button','ErrorText','ActivityIndicator','Redirect','DatePicker','PlacePicker','Choices','ConfirmationButton','WorkspaceAction','WorkspaceTaskHeader','WorkspaceFact'].map(name=>[name,name]));
 const ports={React,...hooks,...hosts,ApiError,router:{back(){backs++;}},useLocalSearchParams:()=>({id:'shipment'}),useLanguage:()=>({t:text=>text}),useAccount:()=>({session:{user:{id:'provider'}},request}),useAccountQuery:()=>({data,error:'',loading:false,reload:async()=>{}})};
 const parsed=ts.createSourceFile('shipment-manage.tsx',readFileSync(new URL('../src/screens/shipment-manage.tsx',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),source=ts.createPrinter().printFile(ts.factory.updateSourceFile(parsed,parsed.statements.filter(node=>!ts.isImportDeclaration(node)))),code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText,exports={};
 new Function(...Object.keys(ports),'exports',code)(...Object.values(ports),exports);
 function resolve(tree,path='root'){if(Array.isArray(tree))return tree.map((item,index)=>resolve(item,`${path}/${index}`));if(!tree||typeof tree!=='object')return tree;if(typeof tree.type==='function'){const key=`${path}:${tree.type.name}:${tree.key||''}`;slots=stores.get(key)||[];stores.set(key,slots);cursor=0;return resolve(tree.type(tree.props),`${key}/content`);}return{...tree,props:{...tree.props,children:resolve(tree.props.children,`${path}/children`)}};}
 return{render:()=>resolve(React.createElement(exports.default,{})),backs:()=>backs,ApiError};
}
const nodes=tree=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];
const find=(tree,type,predicate=()=>true)=>nodes(tree).find(node=>node.type===type&&predicate(node));
const settle=async()=>{for(let index=0;index<10;index++)await Promise.resolve();};
const fixture={id:'shipment',revision:'saved-r1',status:'CREATED',cargo:'Grain',origin:{placeRef:'origin',label:'Adama'},passing:{placeRef:'passing',label:'Awash'},destination:{placeRef:'destination',label:'Dire Dawa'},pickupDate:'2026-11-01',deliveryDate:'2026-11-02',vehicleId:'old-truck',vehicles:[{id:'old-truck',label:'Current truck'},{id:'replacement',label:'Other assigned truck'}]};

test('shipment management is read-first and offers only actions actually authorized',()=>{
 const view=runtime({...fixture,actions:['REASSIGN']}),tree=view.render();assert.equal(find(tree,'Field'),undefined);assert.equal(find(tree,'Choices'),undefined);assert.equal(find(tree,'Button',node=>node.props.message==='Save change'),undefined);assert.deepEqual(nodes(tree).filter(node=>node.type==='WorkspaceAction').map(node=>node.props.message),['Change vehicle and driver']);assert.equal(find(tree,'WorkspaceFact',node=>node.props.message==='Route').props.value,'Adama → Awash → Dire Dawa');
});
test('explicit correction keeps the original revision and route and ignores a repeated in-flight save',async()=>{
 const writes=[],view=runtime({...fixture,actions:['CORRECT']},async(path,body)=>writes.push({path,body}));let tree=view.render();find(tree,'WorkspaceAction').props.onPress();tree=view.render();find(tree,'Field',node=>node.props.message==='Cargo').props.onChangeText('Workshop parts');find(tree,'Field',node=>node.props.message==='Reason for this change').props.onChangeText('Correct description');tree=view.render();const save=find(tree,'Button',node=>node.props.message==='Save change');save.props.onPress();save.props.onPress();await settle();assert.deepEqual(writes,[{path:'/api/mobile/shipments/shipment/recovery',body:{action:'CORRECT',revision:'saved-r1',reason:'Correct description',cargo_summary:'Workshop parts',origin_place_ref:'origin',passing_place_ref:'passing',destination_place_ref:'destination',expected_pickup_date:'2026-11-01',expected_delivery_date:'2026-11-02'}}]);assert.equal(view.backs(),1);
});
test('reassignment starts from no chosen replacement and cannot silently choose the current truck',async()=>{
 const writes=[],view=runtime({...fixture,actions:['REASSIGN']},async(path,body)=>writes.push(body));let tree=view.render();find(tree,'WorkspaceAction').props.onPress();tree=view.render();assert.deepEqual(find(tree,'Choices').props.options,[{id:'replacement',label:'Other assigned truck'}]);find(tree,'Field',node=>node.props.message==='Reason for this change').props.onChangeText('Truck changed');tree=view.render();find(tree,'Button',node=>node.props.message==='Save change').props.onPress();await settle();assert.equal(writes.length,0);find(tree,'Choices').props.onChange('replacement');tree=view.render();find(tree,'Button',node=>node.props.message==='Save change').props.onPress();await settle();assert.deepEqual(writes,[{action:'REASSIGN',revision:'saved-r1',reason:'Truck changed',vehicle_id:'replacement'}]);
});
test('Back to shipment actions abandons the editor without a product mutation',()=>{
 const writes=[],view=runtime({...fixture,actions:['CORRECT','REASSIGN']},async(path,body)=>writes.push(body));let tree=view.render();find(tree,'WorkspaceAction',node=>node.props.message==='Correct details').props.onPress();tree=view.render();find(tree,'Field',node=>node.props.message==='Cargo').props.onChangeText('Unsaved edit');find(tree,'WorkspaceTaskHeader').props.onBack();tree=view.render();assert.equal(find(tree,'Field'),undefined);assert.equal(nodes(tree).filter(node=>node.type==='WorkspaceAction').length,2);assert.deepEqual(writes,[]);
});
test('ambiguous recovery responses require a read before another save',async()=>{
 let writes=0,view;view=runtime({...fixture,actions:['CORRECT']},async()=>{writes++;throw new view.ApiError(409);});let tree=view.render();find(tree,'WorkspaceAction').props.onPress();tree=view.render();find(tree,'Field',node=>node.props.message==='Reason for this change').props.onChangeText('Correct details');tree=view.render();find(tree,'Button',node=>node.props.message==='Save change').props.onPress();await settle();tree=view.render();assert.equal(find(tree,'Button',node=>node.props.message==='Save change').props.disabled,true);find(tree,'Button',node=>node.props.message==='Save change').props.onPress();await settle();assert.equal(writes,1);assert.equal(view.backs(),0);
});
