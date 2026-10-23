import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const actor='11111111-1111-4111-8111-111111111111';
const workspace={id:'33333333-3333-4333-8333-333333333333',name:'Review freight',handle:'review-freight',city:'Adama',kind:'BROKER',version:3,actorId:actor,actorRole:'CUSTOMER',membershipRole:'OWNER',membershipRevision:1,permissions:{capacity:true,tracking:true,team:true,owner:true}};
const directory={workspace,members:[{userId:actor,firstName:'Owner',role:'OWNER',active:true,revision:1,capacity:true,tracking:true,email:'owner@example.test'},{userId:'22222222-2222-4222-8222-222222222222',firstName:'Teammate',role:'STAFF',active:true,revision:1,capacity:true,tracking:false,email:'team@example.test'}],invitations:[]};
const nodes=value=>!value||typeof value!=='object'?[]:Array.isArray(value)?value.flatMap(nodes):[value,...nodes(value.props?.children)];
const message=(node,label)=>nodes(node).some(value=>value.type==='Text'&&value.props.message===label);
function harness(file,name,props){
 let cursor=0;const state=[],effects=[],requests=[],destinations=[];
 const element=(type,props)=>({type,props:props||{}});
 const react={useState(initial){const index=cursor++;if(!(index in state))state[index]=initial;return[state[index],value=>state[index]=typeof value==='function'?value(state[index]):value]},useRef(value){const index=cursor++;if(!(index in state))state[index]={current:value};return state[index]},useEffect(effect){effects.push(effect)}};
 const imports={'react/jsx-runtime':{jsx:element,jsxs:element},react:{__esModule:true,default:react},'next/link':{__esModule:true,default:'a'},'next/navigation':{useRouter:()=>({push:path=>destinations.push(path),refresh:()=>destinations.push('REFRESH')})},'./localization':{Text:'Text'},'./account-details-form':{AccountDetailsForm:'AccountDetailsForm'},'./business-documents':{BusinessDocuments:'BusinessDocuments'},'./business-workspace.module.css':{__esModule:true,default:{}},'./business-workspace-choice':{businessRequest:async(path,body)=>{requests.push({path,body});return {delivery:'SENT'};}}};
 imports['lucide-react']=new Proxy({},{get:(_,key)=>key});
 const compiled=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,exports={};new Function('require','exports',compiled)(name=>{assert.ok(name in imports,name);return imports[name]},exports);
 const priorFetch=globalThis.fetch,priorForm=globalThis.FormData;
 globalThis.fetch=async(path,options)=>{requests.push({path,options});return {ok:true,json:async()=>options?.method==='POST'?{id:workspace.id}:directory};};
 globalThis.FormData=class{constructor(values){this.values=values}get(key){return this.values[key]??null}};
 return{requests,destinations,render(){cursor=0;effects.length=0;return nodes(exports[name](props));},restore(){globalThis.fetch=priorFetch;globalThis.FormData=priorForm;}};
}
test('business Account opens saved records before any edit form and cancel never writes',()=>{
 const h=harness('src/components/business-account.tsx','BusinessAccount',{initial:directory,name:'Owner',email:'owner@example.test'});
 try{let tree=h.render();assert.equal(tree.filter(node=>node.type==='input').length,0);assert.equal(tree.filter(node=>node.type==='select').length,0);
  tree.find(node=>node.type==='button'&&message(node,'Edit')).props.onClick();tree=h.render();assert.ok(tree.some(node=>node.type==='input'&&node.props.name==='name'));
  tree.find(node=>node.type==='button'&&message(node,'Cancel')).props.onClick();tree=h.render();assert.equal(tree.filter(node=>node.type==='input').length,0);assert.equal(h.requests.length,0);
 }finally{h.restore();}
});
test('business invitation submits exact current business version and permitted fields then returns to saved list',async()=>{
 const h=harness('src/components/business-account.tsx','BusinessAccount',{initial:directory,name:'Owner',email:'owner@example.test'});
 try{let tree=h.render();tree.find(node=>node.type==='button'&&message(node,'Invite teammate')).props.onClick();tree=h.render();
  await tree.find(node=>node.type==='form'&&node.props.onSubmit).props.onSubmit({preventDefault(){},currentTarget:{email:'next@example.test',role:'STAFF',capacity:'on'}});
  // onSubmit starts an async action deliberately; let its bounded promise settle.
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.deepEqual(h.requests[0],{path:`/api/business-workspaces/${workspace.id}`,body:{action:'INVITE',expectedVersion:3,email:'next@example.test',role:'STAFF',capacity:true,tracking:false}});
  assert.equal(h.requests[1].path,`/api/business-workspaces/${workspace.id}`);
  tree=h.render();assert.equal(tree.filter(node=>node.type==='input').length,0);assert.ok(tree.some(node=>node.props.role==='status'&&message(node,'Invitation sent.')));
 }finally{h.restore();}
});
test('staff business Account hides team mutations and private teammate emails',()=>{
 const readonly={...directory,workspace:{...workspace,membershipRole:'STAFF',permissions:{capacity:true,tracking:false,team:false,owner:false}},members:directory.members.map(({email,...member})=>member)};
 const h=harness('src/components/business-account.tsx','BusinessAccount',{initial:readonly,name:'Team',email:'team@example.test'});
 try{const tree=h.render();for(const label of ['Edit','Invite teammate','Manage','Archive workspace'])assert.equal(tree.some(node=>node.type==='button'&&message(node,label)),false);
  assert.equal(tree.some(node=>node.type==='input'),false);
 }finally{h.restore();}
});
test('workspace chooser offers deliberate creation and uses server selection instead of forging an identity',async()=>{
 const h=harness('src/components/business-workspace-choice.tsx','BusinessWorkspaceChoice',{workspaces:[workspace],invitations:[],providerAvailable:true,canCreateProvider:false});
 try{let tree=h.render();assert.equal(tree.filter(node=>node.type==='input').length,0);
  tree.find(node=>node.type==='button'&&message(node,'Open')).props.onClick();await new Promise(resolve=>setTimeout(resolve,0));
  assert.deepEqual(JSON.parse(h.requests[0].options.body),{action:'SELECT',workspaceId:null});assert.equal(h.destinations[0],'/app/home');
 }finally{h.restore();}
});

test('business selection resolves its home on the server for teammates without Capacity access',async()=>{
 const trackingOnly={...workspace,permissions:{capacity:false,tracking:true,team:false,owner:false},membershipRole:'STAFF'};
 const h=harness('src/components/business-workspace-choice.tsx','BusinessWorkspaceChoice',{workspaces:[trackingOnly],invitations:[],providerAvailable:false,canCreateProvider:false});
 try{const tree=h.render();tree.find(node=>node.type==='button'&&message(node,'Open')).props.onClick();await new Promise(resolve=>setTimeout(resolve,0));
  assert.deepEqual(JSON.parse(h.requests[0].options.body),{action:'SELECT',workspaceId:workspace.id});assert.equal(h.destinations[0],'/app/home');
 }finally{h.restore();}
});

test('workspace admin can manage staff but cannot promote or manage another admin',()=>{
 const adminDirectory={...directory,workspace:{...workspace,membershipRole:'ADMIN',permissions:{...workspace.permissions,owner:false}},members:[...directory.members,{userId:'44444444-4444-4444-8444-444444444444',firstName:'Other admin',role:'ADMIN',active:true,revision:1,capacity:true,tracking:true}]};
 const h=harness('src/components/business-account.tsx','BusinessAccount',{initial:adminDirectory,name:'Admin',email:'admin@example.test'});
 try{let tree=h.render();assert.equal(tree.filter(node=>node.type==='button'&&message(node,'Manage')).length,1);
  tree.find(node=>node.type==='button'&&message(node,'Invite teammate')).props.onClick();tree=h.render();
  assert.deepEqual(tree.filter(node=>node.type==='option').map(node=>node.props.value),['STAFF']);
 }finally{h.restore();}
});


test('erased teammates remain visible as former members without management actions',()=>{
 const erased={...directory,members:[directory.members[0],{...directory.members[1],firstName:'Former team member',email:undefined,active:false,capacity:false,tracking:false,erased:true}]};
 const h=harness('src/components/business-account.tsx','BusinessAccount',{initial:erased,name:'Owner',email:'owner@example.test'});
 try{const tree=h.render();assert.ok(tree.some(node=>message(node,'Former team member')));assert.equal(tree.some(node=>node.type==='button'&&message(node,'Manage')),false);assert.equal(tree.some(node=>message(node,'Suspended')),false);}
 finally{h.restore();}
});

test('shipper/broker document tasks explain optional review and offline fees on web and Expo',()=>{
 const guidance='Review is optional. Transport Providers can find and share Capacity with your account without documents. Approved documents add trust badges. Fees are paid offline.';
 for(const path of ['src/components/business-documents.tsx','apps/mobile/src/components/business-documents.tsx'])
  assert.ok(readFileSync(path,'utf8').includes(guidance),`${path} must explain optional review and offline fees`);
});

test('demand-side labels distinguish Shippers/brokers from receivers across navigation and admin records',()=>{
 const shell=readFileSync('src/components/app-shell.tsx','utf8');
 const account=readFileSync('src/components/business-account.tsx','utf8');
 const admin=readFileSync('src/app/admin/operations/page.tsx','utf8');
 const adminDetail=readFileSync('src/app/admin/operations/[view]/[id]/page.tsx','utf8');
 const documents=readFileSync('src/app/app/more/page.tsx','utf8');
 const vehicleDetails=readFileSync('src/components/map-truck-details.tsx','utf8');
 assert.match(shell,/SHIPPER:\s*'Shipper \/ broker'/);
 assert.match(shell,/RECEIVER:\s*'Receiver'/);
 assert.match(account,/message="Workspace details"/);
 assert.match(admin,/label:'Workspaces'/);
 assert.match(admin,/type==='ENTERPRISE_SHIPPER'\)return 'Shipper \/ broker workspace'/);
 assert.match(admin,/type==='ENTERPRISE_RECEIVER'\)return 'Receiver workspace'/);
 assert.match(adminDetail,/record\.type==='ENTERPRISE_SHIPPER'\?'Shipper \/ broker workspace'/);
 assert.match(adminDetail,/record\.type==='ENTERPRISE_RECEIVER'\?'Receiver workspace'/);
 assert.match(documents,/message=\{user\.organization_id\?'Workspace documents'/);
 assert.match(vehicleDetails,/label=\{truck\.provider_organization_id\?'Transport Provider documents'/);
 assert.doesNotMatch(documents,/Company documents/);
 assert.doesNotMatch(vehicleDetails,/Company documents/);
});

test('renaming the shipment owner link keeps the existing Accept and Express interest actions',()=>{
 const card=readFileSync('src/components/load-board-card.tsx','utf8');
 assert.match(card,/<Text message="Shipper \/ broker"\/>/);
 assert.match(card,/canNegotiate&&pendingDirectRequest\?<form action=\{`\/api\/shipments\/\$\{load\.id\}\/accept`\}/);
 assert.match(card,/:canNegotiate&&!load\.interested\?<form action=\{`\/api\/shipments\/\$\{load\.id\}\/interest`\}/);
 assert.match(card,/<Text message="Accept"\/>/);
 assert.match(card,/<Text message="Express interest"\/>/);
});
