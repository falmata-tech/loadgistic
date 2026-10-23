import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as contract from '../src/lib/business-directory/client-contract.js';

const workspaceId='10000000-0000-4000-8000-000000000001',requestId='20000000-0000-4000-8000-000000000001';
const badges=()=>contract.businessDocumentTypes.map(type=>({type,verified:false,expired:false,reviewedAt:null,expiresOn:null}));
const identity=()=>({id:workspaceId,name:'Highland Freight Desk',handle:'highland-desk',managerName:'Meron',documents:badges()});
const page=()=>({items:[{...identity(),kind:'BROKER',city:'Adama'}],total:1,page:1,pageSize:12,pageCount:1});
const documents=(canManage=true)=>({...identity(),workspaceId,canManage,subjects:canManage?[{id:workspaceId,kind:'BUSINESS_WORKSPACE',name:'Highland Freight Desk',allowedTypes:[...contract.businessDocumentTypes],pending:0,badges:badges(),vehicles:[]}]:[],requests:[]});
const request=()=>({id:requestId,subjectId:workspaceId,subjectKind:'BUSINESS_WORKSPACE',name:'Business license',type:'BUSINESS_LICENSE',status:'PENDING',submittedAt:'2026-10-18T12:00:00+00:00',reviewedAt:null,expiresOn:null,note:'',stale:false,hasFile:true});
const clone=value=>structuredClone(value);

test('directory client accepts only the bounded safe business projection and all three review states',()=>{
 const value=page();value.items[0].documents[0]={...value.items[0].documents[0],verified:true,reviewedAt:'2026-10-18T12:00:00Z'};
 assert.deepEqual(contract.parseBusinessDirectoryPage(value),value);
 for(const [key,privateValue] of [['email','private@example.test'],['subjectId',workspaceId],['filePath','private/document.pdf'],['latitude',9.1]]){const bad=page();bad.items[0][key]=privateValue;assert.throws(()=>contract.parseBusinessDirectoryPage(bad));}
 for(const mutate of [v=>{v.pageSize=100;},v=>{v.items.push(clone(v.items[0]));},v=>{v.items[0].documents.pop();},v=>{v.items[0].documents[0].verified=true;v.items[0].documents[0].expired=true;},v=>{v.items[0].managerName=42;},v=>{v.page=0;}]){const bad=page();mutate(bad);assert.throws(()=>contract.parseBusinessDirectoryPage(bad));}
});
test('document client binds private request history to the selected owner workspace and excludes it from team views',()=>{
 const owner=documents();owner.requests.push(request());assert.deepEqual(contract.parseBusinessDocuments(owner,workspaceId,true),owner);
 assert.deepEqual(contract.parseBusinessDocuments(documents(false),workspaceId,false),documents(false));
 assert.throws(()=>contract.parseBusinessDocuments(owner,workspaceId,false));
 for(const mutate of [v=>{v.requests[0].subjectId='10000000-0000-4000-8000-000000000002';},v=>{v.requests[0].filePath='secret';},v=>{v.subjects[0].id='10000000-0000-4000-8000-000000000002';},v=>{v.managerEmail='secret@example.test';},v=>{v.requests.push(clone(v.requests[0]));}]){const bad=clone(owner);mutate(bad);assert.throws(()=>contract.parseBusinessDocuments(bad,workspaceId,true));}
 for(const key of ['subjects','requests']){const bad=documents(false);bad[key]=owner[key];assert.throws(()=>contract.parseBusinessDocuments(bad,workspaceId,false));}
});

const nodes=value=>!value||typeof value!=='object'?[]:Array.isArray(value)?value.flatMap(nodes):[value,...nodes(value.props?.children)];
const find=(tree,type,condition=()=>true)=>nodes(tree).find(node=>node.type===type&&condition(node));
const settle=async()=>{for(let n=0;n<12;n++)await Promise.resolve();};
function runtime(path,ports={}){
 const states=[],refs=[],effects=[],effectSlots=[];let si=0,ri=0,ei=0;
 const react={useState(initial){const index=si++;if(!(index in states))states[index]=typeof initial==='function'?initial():initial;return[states[index],value=>{states[index]=typeof value==='function'?value(states[index]):value;}];},useRef(initial){const index=ri++;return refs[index]||(refs[index]={current:initial});},useEffect(callback,deps){const index=ei++,old=effectSlots[index];if(!old||!deps||deps.some((item,n)=>item!==old.deps?.[n])){effects.push(()=>{old?.cleanup?.();effectSlots[index]={deps,cleanup:callback()};});}}};
 const element=(type,props)=>({type,props:props||{}}),known={react:{__esModule:true,default:react,...react},'react/jsx-runtime':{jsx:element,jsxs:element},'lucide-react':new Proxy({},{get:(_target,key)=>key}),'@/lib/business-directory/client-contract.js':contract,'../../../../src/lib/business-directory/client-contract.js':contract,'./business-directory':{BusinessDocumentBadges:'BusinessDocumentBadges'},'./date-picker':{DatePicker:'DatePicker'},'./localization':{Text:'Text',Localized:'Localized'},'./business-directory.module.css':{default:{}},...ports};
 const source=readFileSync(path,'utf8'),code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,exports={};
 new Function('require','exports',code)(name=>{assert.ok(name in known,'Unexpected import '+name);return known[name];},exports);
 return{render(name,props={}){si=ri=ei=0;return exports[name](props);},renderComponent(component,props={}){si=ri=ei=0;return component(props);},flush(){while(effects.length)effects.shift()();}};
}
test('web documents are read-first; Cancel writes nothing and a committed upload retries only its read',async()=>{
 const previousFetch=globalThis.fetch,previousData=globalThis.FormData,calls=[];let failRead=false;
 class TestFormData{constructor(values){this.values=new Map(values instanceof Map?values:[]);}get(key){return this.values.get(key)||null;}set(key,value){this.values.set(key,value);}}
 globalThis.FormData=TestFormData;globalThis.fetch=async(path,options={})=>{calls.push({path,...options});if(options.method==='POST'){failRead=true;return{ok:true,json:async()=>({ok:true,id:requestId})};}if(failRead)throw Error('temporary read failure');return{ok:true,json:async()=>documents()};};
 try{
  const view=runtime('src/components/business-documents.tsx');let tree=view.render('BusinessDocuments',{workspaceId,canManage:true});view.flush();await settle();tree=view.render('BusinessDocuments',{workspaceId,canManage:true});
  assert.equal(find(tree,'form'),undefined);find(tree,'button',node=>find(node,'Text',n=>n.props.message==='Manage documents')).props.onClick();tree=view.render('BusinessDocuments',{workspaceId,canManage:true});
  find(tree,'button',node=>find(node,'Text',n=>n.props.message==='Submit a document')).props.onClick();tree=view.render('BusinessDocuments',{workspaceId,canManage:true});
  find(tree,'button',node=>find(node,'Text',n=>n.props.message==='Cancel')).props.onClick();assert.equal(calls.filter(call=>call.method==='POST').length,0);
  tree=view.render('BusinessDocuments',{workspaceId,canManage:true});find(tree,'button',node=>find(node,'Text',n=>n.props.message==='Submit a document')).props.onClick();tree=view.render('BusinessDocuments',{workspaceId,canManage:true});
  find(tree,'form').props.onSubmit({preventDefault(){},currentTarget:new Map([['verificationType','BUSINESS_LICENSE'],['documentName','Current license'],['file',new File(['proof'],'license.pdf',{type:'application/pdf'})]])});await settle();
  const post=calls.find(call=>call.method==='POST');assert.ok(post);assert.deepEqual(JSON.parse(post.body.get('command')),{verificationType:'BUSINESS_LICENSE',documentName:'Current license',expiresOn:''});assert.equal(post.body.get('command').includes('subject'),false);
  tree=view.render('BusinessDocuments',{workspaceId,canManage:true});assert.equal(find(tree,'form'),undefined);assert.ok(find(tree,'button',node=>find(node,'Text',n=>n.props.message==='Reload saved change')));
  failRead=false;find(tree,'button',node=>find(node,'Text',n=>n.props.message==='Reload saved change')).props.onClick();await settle();assert.equal(calls.filter(call=>call.method==='POST').length,1);
 }finally{globalThis.fetch=previousFetch;globalThis.FormData=previousData;}
});
test('web team document summary has no management, file or request history controls',async()=>{
 const old=globalThis.fetch;globalThis.fetch=async()=>({ok:true,json:async()=>documents(false)});
 try{const view=runtime('src/components/business-documents.tsx');view.render('BusinessDocuments',{workspaceId,canManage:false});view.flush();await settle();const tree=view.render('BusinessDocuments',{workspaceId,canManage:false});assert.ok(find(tree,'BusinessDocumentBadges'));assert.equal(find(tree,'dialog'),undefined);assert.equal(find(tree,'a'),undefined);assert.equal(find(tree,'form'),undefined);assert.equal(nodes(tree).filter(n=>n.type==='button').length,1);assert.ok(find(tree,'button',n=>find(n,'Text',t=>t.props.message==='Refresh documents')));}finally{globalThis.fetch=old;}
});
function nativePorts(value,account,selection,reload){return{
 'react-native':{ActivityIndicator:'ActivityIndicator',Text:'Text',View:'View'},
 '../session/provider':{useAccount:()=>account},'../hooks/account-query':{useAccountQuery:()=>({data:value,error:'',loading:false,reloadConfirmed:reload,reload:async()=>{}})},
 '../localization/provider':{useLanguage:()=>({t:key=>key})},'./ui':{Button:'Button',Copy:'Copy',ErrorText:'ErrorText',Field:'Field',palette:{}},'./choices':{Choices:'Choices'},
 './private-file':{FilePicker:'FilePicker',PrivateFile:'PrivateFile',uploadBody:(command,file)=>({command,file}),useFileSelection:()=>selection}
 };}
test('native owner document submission sends only the workspace-scoped command and retries the saved read once',async()=>{
 const value=documents(),calls=[],selection={file:null,setFile(file){this.file=file;}};let reads=0,fail=true;
 const view=runtime('apps/mobile/src/components/business-documents.tsx',nativePorts(value,{request:async(path,body)=>{calls.push({path,body});return{ok:true};}},selection,async()=>{reads++;return!fail;}));
 let tree=view.render('BusinessDocuments',{workspaceId,canManage:true});
 const task=nodes(tree).find(node=>typeof node.type==='function'&&node.type.name==='Submit');assert.ok(task);
 tree=view.renderComponent(task.type,task.props);assert.equal(find(tree,'Field'),undefined);find(tree,'Button',n=>n.props.message==='Submit a document').props.onPress();tree=view.renderComponent(task.type,task.props);
 find(tree,'Choices').props.onChange('BUSINESS_LICENSE');find(tree,'Field').props.onChangeText('Reviewed license');selection.file={name:'license.pdf',type:'application/pdf',size:100};tree=view.renderComponent(task.type,task.props);await find(tree,'Button',n=>n.props.message==='Send for review').props.onPress();await settle();
 assert.equal(calls.length,1);assert.deepEqual(calls[0],{path:`/api/business-workspaces/${workspaceId}/documents`,body:{command:{verificationType:'BUSINESS_LICENSE',documentName:'Reviewed license',expiresOn:''},file:{name:'license.pdf',type:'application/pdf',size:100}}});
 tree=view.renderComponent(task.type,task.props);assert.equal(find(tree,'Field'),undefined);fail=false;await find(tree,'Button',n=>n.props.message==='Reload saved change').props.onPress();await settle();assert.equal(calls.length,1);assert.equal(reads,2);
});
test('native team receives only safe badges, and foreign or owner-only metadata cannot render',()=>{
 const account={request:async()=>{throw Error('no request expected');}},selection={file:null,setFile(){}};
 let view=runtime('apps/mobile/src/components/business-documents.tsx',nativePorts(documents(false),account,selection,async()=>true)),tree=view.render('BusinessDocuments',{workspaceId,canManage:false,summary:true});assert.ok(find(tree,'BusinessDocumentBadges'));assert.equal(find(tree,'PrivateFile'),undefined);assert.equal(nodes(tree).some(n=>typeof n.type==='function'&&n.type.name==='Submit'),false);
 const malformed=documents(false);malformed.requests.push(request());view=runtime('apps/mobile/src/components/business-documents.tsx',nativePorts(malformed,account,selection,async()=>true));tree=view.render('BusinessDocuments',{workspaceId,canManage:false,summary:true});assert.equal(find(tree,'BusinessDocumentBadges'),undefined);assert.ok(find(tree,'ErrorText',n=>n.props.message==='Could not load workspace details. Please try again.'));assert.equal(JSON.stringify(tree).includes('license.pdf'),false);
});
test('shipper/broker directory and optional document task labels have native-language copy',()=>{
 const keys=['Shared with','Shippers & brokers','Find shippers or brokers','Account name, manager or @handle','Account manager National ID','Shipper / broker documents','Shipper / broker account','Search shippers or brokers','No shippers or brokers match this search.','Review is optional. Transport Providers can find and share Capacity with your account without documents. Approved documents add trust badges. Fees are paid offline.','Could not load workspace details. Please try again.','Account details changed','More information requested','Expires on (optional)','That handle is already in use. Choose another.','Use 2–64 lowercase letters, numbers, underscores or hyphens for your handle.','Enter a public account name of up to 140 characters.','Enter a public account name and handle.'];
 for(const locale of ['am','om']){const messages=JSON.parse(readFileSync(`src/lib/i18n/messages/${locale}.json`,'utf8'));for(const key of keys)assert.ok(typeof messages[key]==='string'&&messages[key].trim()&&messages[key]!==key,locale+':'+key);}
});
test('business document subject and review type labels use role language without exposing storage enums',()=>{
 const source=readFileSync('src/app/admin/reviews/page.tsx','utf8');assert.ok(source.includes("BUSINESS_WORKSPACE:'Shipper / broker account'"));assert.ok(source.includes("?'Account manager National ID'"));assert.equal(source.includes("request.subject_type.replaceAll"),false);assert.equal(source.includes("request.verification_type.replaceAll"),false);
 assert.equal(contract.businessDocumentLabel('IDENTITY'),'Account manager National ID');assert.equal(contract.businessDocumentLabel('UNRECOGNIZED'),'Document');
});
