import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as navigation from '../src/lib/team-navigation.js';
import {supportRevisionTag} from '../src/lib/support-polling.js';
const nodes=value=>!value||typeof value!=='object'?[]:Array.isArray(value)?value.flatMap(nodes):[value,...nodes(typeof value.type==='function'?value.type(value.props):value.props?.children)];
const all=(tree,type)=>nodes(tree).filter(node=>node.type===type);
const id='11111111-1111-4111-8111-111111111111';
function load(file,ports={}){
 const element=(type,props)=>({type,props:props||{}}),simple=new Proxy({},{get:(_target,key)=>key});
 const imports={'react/jsx-runtime':{jsx:element,jsxs:element},'next/link':{__esModule:true,default:'Link'},'lucide-react':simple,
  'next/navigation':{usePathname:()=>'/support/'+id,useSearchParams:()=>new URLSearchParams(),redirect:path=>{throw Error('REDIRECT:'+path);},notFound:()=>{throw Error('NOT_FOUND');}},
  '@/components/localization':{Text:'Text',Localized:'Localized'},'./localization':{Text:'Text',Localized:'Localized',LanguagePicker:'LanguagePicker',useTranslation:()=>({t:value=>value})},
  '@/components/workspace-task-dialog':{WorkspaceTaskDialog:'TaskDialog'},'@/components/page-header':{PageHeader:'Header'},'@/components/flash':{Flash:'Flash'},'@/components/pagination':{Pagination:'Pagination'},'@/components/status-pill':{StatusPill:'Status'},'@/components/support-refresh':{SupportRefresh:'Refresh'},'./workspace-shell.module.css':{__esModule:true,default:simple},
  '@/lib/team-navigation.js':navigation,'@/lib/support-polling.js':{supportRevisionTag},'@/app/admin/admin-presentation.module.css':{__esModule:true,default:simple},'./staff-account.module.css':{__esModule:true,default:simple},
  './content-policy-consent':{ContentPolicyConsent:'Consent'},'./logo':{Logo:'Logo'},'./staff-account':{StaffAccount:'StaffAccount'},'./workspace-area-switch':{WorkspaceAreaSwitch:'AreaSwitch'},'./workspace-back-button':{WorkspaceBackButton:'Back'},'./chat-alerts':{ChatAlerts:'Alerts'},
  '@/lib/provider-workspace.js':{providerWorkspaceCapabilities:()=>({canManageFleet:false,drivesTruck:false})},...ports};
 const source=readFileSync(new URL('../'+file,import.meta.url),'utf8'),code=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const exports={};new Function('require','exports',code)(key=>{assert.ok(key in imports,'Unexpected dashboard boundary '+key);return imports[key];},exports);return exports.default||exports;
}
test('admin Chats and Team render only their own authorized query and keep Team free of polling',async()=>{
 let chats=0,agents=0;
 const admin={id,role:'ADMIN'},member={user_id:id,name:'Synthetic agent',email:'agent@example.test',active:true,available:true,max_open_conversations:3,open_count:1,closed_count:2,can_manage_support:true,can_manage_brokerage:true,can_manage_billing:true};
 const page=load('src/app/admin/support/page.tsx',{'@/lib/auth':{requireUser:async roles=>{assert.deepEqual(roles,['ADMIN']);return admin;}},'@/lib/support.js':{
  listSupportInbox:async()=>{chats++;return {items:[],counts:{assigned:1,waiting:2,closed:3},page:2,pageCount:3,total:30};},
  listSupportAgents:async()=>{agents++;return {items:[member],page:1,pageCount:1,total:1};}}});
 const chatTree=await page({searchParams:Promise.resolve({view:'WAITING',queuePage:'2'})});
 assert.equal(chats,1);assert.equal(agents,0);assert.equal(all(chatTree,'Refresh').length,1);assert.match(all(chatTree,'Refresh')[0].props.endpoint,/view=WAITING&page=2&pageSize=10$/);
 assert.equal(all(chatTree,'form').length,0);assert.equal(nodes(chatTree).some(node=>node.props.message==='Guest support'),false);
 const teamTree=await page({searchParams:Promise.resolve({tab:'team'})});
 assert.equal(chats,1);assert.equal(agents,1);assert.equal(all(teamTree,'Refresh').length,0);
 const forms=all(teamTree,'form'),create=forms.find(node=>node.props.action==='/api/admin/support-agents'),edit=forms.find(node=>node.props.action===`/api/admin/support-agents/${id}`);assert.ok(create);assert.ok(edit);
 for(const form of [create,edit]){
  for(const permission of ['Customers','Operations','Trust','Support','Featured'])assert.ok(all(form,'input').some(node=>node.props.name==='canManage'+permission));
  assert.equal(all(form,'input').some(node=>node.props.name==='canManageBrokerage'),false);
 }
 assert.equal(all(edit,'input').find(node=>node.props.name==='canManageBilling').props.value,'on');
 assert.equal(nodes(teamTree).some(node=>node.props.message==='Guest support'),false);
});
test('admin phone navigation exposes software Support and keeps it active in its conversation',()=>{
 const shell=load('src/components/app-shell.tsx').AppShell;
 const tree=shell({user:{id,role:'ADMIN',name:'Administrator'},children:'content'});
 const mobile=all(tree,'Localized').find(node=>node.props['aria-label']==='Mobile navigation');
 assert.deepEqual(all(mobile,'Link').map(node=>node.props.href),['/admin','/admin/support','/admin/operations','/admin/featured','/app/menu']);
 assert.equal(all(mobile,'Link').find(node=>node.props.href==='/admin/support').props['aria-current'],'page');
});
test('staff retain only their granted queues and a visible account/sign-out entry independent of sidebar',()=>{
 const shell=load('src/components/app-shell.tsx').AppShell;
 for(const [support,brokerage,expected] of [[true,false,['/support']],[false,true,[]],[true,true,['/support']]]){
  const tree=shell({user:{id,role:'SUPPORT',name:'Synthetic staff',can_manage_support:support,can_manage_brokerage:brokerage},children:'content'});
  const mobile=all(tree,'Localized').find(node=>node.props['aria-label']==='Mobile navigation');assert.deepEqual(all(mobile,'Link').map(node=>node.props.href),expected);
  assert.equal(all(tree,'StaffAccount').length,1);assert.equal(nodes(all(tree,'aside')[0]).some(node=>node.type==='StaffAccount'),false);
  assert.ok(all(tree,'div').some(node=>String(node.props.className).includes('staffTopbar')));
 }
});
test('account directory and fleet navigation follow the staff member’s actual responsibility',()=>{
 const shell=load('src/components/app-shell.tsx').AppShell;
 for(const [customers,operations,href,label,icon] of [
  [true,false,'/admin/operations','Accounts','Users'],
  [true,true,'/admin/operations','Accounts','Users'],
  [false,true,'/admin/operations?view=TRUCKS','Fleet','Truck'],
 ]){
  const tree=shell({user:{id,role:'SUPPORT',name:'Synthetic staff',can_manage_customers:customers,can_manage_operations:operations},children:'content'});
  const mobile=all(tree,'Localized').find(node=>node.props['aria-label']==='Mobile navigation');
  const entry=all(mobile,'Link').find(node=>node.props.href===href);assert.ok(entry);
  assert.ok(nodes(entry).some(node=>node.props.message===label));assert.equal(all(entry,icon).length,1);
 }
 const denied=shell({user:{id,role:'SUPPORT',name:'Synthetic staff'},children:'content'});
 assert.equal(all(denied,'Link').some(node=>node.props.href.startsWith('/admin/operations')),false);
 const admin=shell({user:{id,role:'ADMIN',name:'Administrator'},children:'content'});
 const entry=all(admin,'Link').find(node=>node.props.href==='/admin/operations');assert.ok(nodes(entry).some(node=>node.props.message==='Accounts'));assert.equal(all(entry,'Users').length,1);
});
test('retired guest staff pages have no queue or transcript rendering and make no backend reads',()=>{
 for(const file of ['src/app/support/assisted/page.tsx','src/app/support/assisted/[id]/page.tsx'])assert.throws(()=>load(file)(),/NOT_FOUND/);
});
