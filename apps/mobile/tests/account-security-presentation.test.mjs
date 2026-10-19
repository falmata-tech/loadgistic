import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

function runtime(data,request=async()=>{}){
 const stores=new Map();let slots=[],cursor=0;
 const React={createElement:(type,props,...children)=>({type,key:props?.key,props:{...props,children:children.flat(Infinity)}}),Fragment:'Fragment'};
 const hooks={useState:initial=>{const state=slots,index=cursor++;if(!(index in state))state[index]=typeof initial==='function'?initial():initial;return[state[index],value=>{state[index]=typeof value==='function'?value(state[index]):value;}];},useRef:initial=>{const index=cursor++;return slots[index]||(slots[index]={current:initial});}};
 const hosts=Object.fromEntries(['Page','Title','Copy','Card','Field','Button','ErrorText','ActivityIndicator','Redirect','Link','AccountDeletion','WorkspaceAction','WorkspaceFact'].map(name=>[name,name]));
 const ports={React,...hooks,...hosts,useLanguage:()=>({t:message=>message}),useAccount:()=>({session:{user:{id:'provider'}},request,reload:async()=>{},signOut:async()=>{}}),useAccountQuery:()=>({data,error:'',loading:false,reload:async()=>{}})};
 const parsed=ts.createSourceFile('account-security.tsx',readFileSync(new URL('../src/screens/account-security.tsx',import.meta.url),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),source=ts.createPrinter().printFile(ts.factory.updateSourceFile(parsed,parsed.statements.filter(node=>!ts.isImportDeclaration(node)))),code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.React}}).outputText,exports={};new Function(...Object.keys(ports),'exports',code)(...Object.values(ports),exports);
 function resolve(tree,path='root'){if(Array.isArray(tree))return tree.map((item,index)=>resolve(item,`${path}/${index}`));if(!tree||typeof tree!=='object')return tree;if(typeof tree.type==='function'){const key=`${path}:${tree.type.name}:${tree.key||''}`;slots=stores.get(key)||[];stores.set(key,slots);cursor=0;return resolve(tree.type(tree.props),`${key}/content`);}return{...tree,props:{...tree.props,children:resolve(tree.props.children,`${path}/children`)}};}
 return{render:()=>resolve(React.createElement(exports.default,{}))};
}
const nodes=tree=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];
const find=(tree,type,predicate=()=>true)=>nodes(tree).find(node=>node.type===type&&predicate(node));
const settle=async()=>{for(let index=0;index<10;index++)await Promise.resolve();};
const saved={email:'owner@example.test',pendingEmail:'',pendingHandoff:'',blockers:[]};

test('Account security starts with saved email and explicit actions rather than three forms',()=>{
 const view=runtime(saved),tree=view.render();assert.equal(find(tree,'Field'),undefined);assert.equal(find(tree,'AccountDeletion'),undefined);assert.equal(find(tree,'WorkspaceFact').props.value,saved.email);assert.deepEqual(nodes(tree).filter(node=>node.type==='WorkspaceAction').map(node=>node.props.message),['Change login email','Deactivate account','Delete account and data']);
});
test('email change still requires the current-email code before pending confirmation',async()=>{
 const writes=[],view=runtime(saved,async(path,body)=>{writes.push({path,body});return body.step==='REQUEST'?{stage:'CURRENT_EMAIL',handoff:'synthetic-handoff'}:{stage:'EMAIL_PENDING',handoff:'synthetic-pending'};});let tree=view.render();find(tree,'WorkspaceAction',node=>node.props.message==='Change login email').props.onPress();tree=view.render();find(tree,'Field',node=>node.props.message==='New login email').props.onChangeText('new@example.test');tree=view.render();find(tree,'Button',node=>node.props.message==='Verify current email').props.onPress();await settle();tree=view.render();assert.equal(find(tree,'Field',node=>node.props.message==='New login email'),undefined);assert.ok(find(tree,'Field',node=>node.props.message==='Account verification code'));find(tree,'Field',node=>node.props.message==='Account verification code').props.onChangeText('123456');tree=view.render();find(tree,'Button',node=>node.props.label==='Confirm email-change request').props.onPress();await settle();tree=view.render();assert.deepEqual(writes.map(row=>row.body),[{step:'REQUEST',operation:{action:'EMAIL',email:'new@example.test'}},{step:'CONFIRM',operation:{action:'EMAIL',email:'new@example.test'},handoff:'synthetic-handoff',code:'123456'}]);assert.ok(find(tree,'Button',node=>node.props.message==='Check email change'));assert.equal(find(tree,'AccountDeletion'),undefined);
});
test('deactivation preserves closure blockers and never offers a code request while they remain',()=>{
 const view=runtime({...saved,blockers:['ACTIVE_TRACKING']}),tree=view.render();find(tree,'WorkspaceAction',node=>node.props.message==='Deactivate account').props.onPress();const current=view.render();assert.equal(find(current,'Field',node=>node.props.message==='Type DEACTIVATE to confirm'),undefined);assert.equal(find(current,'Button',node=>node.props.message==='Send deactivation code'),undefined);assert.equal(find(current,'Link').props.href,'/shipments');
});
test('deletion opens only through its named action and Back does not issue any command',()=>{
 const writes=[],view=runtime(saved,async(path,body)=>writes.push(body));let tree=view.render();find(tree,'WorkspaceAction',node=>node.props.message==='Delete account and data').props.onPress();tree=view.render();assert.equal(find(tree,'AccountDeletion').props.email,saved.email);find(tree,'Button',node=>node.props.message==='Back to security').props.onPress();tree=view.render();assert.equal(find(tree,'AccountDeletion'),undefined);assert.deepEqual(writes,[]);
});
test('an outstanding email change cannot hide account deletion or erase the pending workflow',()=>{
 const view=runtime({...saved,pendingEmail:'pending@example.test',pendingHandoff:'synthetic-pending'});let tree=view.render();assert.ok(find(tree,'Button',node=>node.props.message==='Check email change'));find(tree,'WorkspaceAction',node=>node.props.message==='Delete account and data').props.onPress();tree=view.render();assert.equal(find(tree,'AccountDeletion').props.email,saved.email);assert.equal(find(tree,'Button',node=>node.props.message==='Check email change'),undefined);find(tree,'Button',node=>node.props.message==='Back to security').props.onPress();tree=view.render();assert.ok(find(tree,'Button',node=>node.props.message==='Check email change'));
});
