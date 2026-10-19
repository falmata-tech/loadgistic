import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {supportRevisionTag} from '../src/lib/support-polling.js';
import * as teamNavigation from '../src/lib/team-navigation.js';

const element=(type,props)=>({type,props:props||{}});
const nodes=value=>!value||typeof value!=='object'?[]:Array.isArray(value)?value.flatMap(nodes):[value,...nodes(value.props?.children)];
async function render(items,{available=true,openCount=0,limit=3,page=1,total=items.length}={}){
 const calls=[];
 const ports={
  'react/jsx-runtime':{jsx:element,jsxs:element},
  'next/link':{__esModule:true,default:'Link'},
  'next/navigation':{redirect(){throw Error('UNEXPECTED_REDIRECT');},notFound(){throw Error('UNEXPECTED_NOT_FOUND');}},
  'lucide-react':new Proxy({},{get:(_,name)=>String(name)}),
  '@/lib/auth':{requireUser:async()=>({id:'agent',role:'SUPPORT',can_manage_support:true})},
  '@/lib/support.js':{listSupportInbox:async(...args)=>{calls.push(args);return{items,page,total,pageCount:Math.ceil(total/15),agent:{available,open_count:openCount,max_open_conversations:limit},counts:{assigned:openCount,waiting:total,closed:0}};}},
  '@/lib/support-polling.js':{supportRevisionTag},'@/lib/team-navigation.js':teamNavigation,
  '@/components/localization':{Text:'Text',Localized:'Localized'},
  '@/components/page-header':{PageHeader:'PageHeader'},
  '@/components/flash':{Flash:'Flash'},
  '@/components/pagination':{Pagination:'Pagination'},
  '@/components/status-pill':{StatusPill:'StatusPill'},
  '@/components/support-refresh':{SupportRefresh:'SupportRefresh'}
 };
 const code=ts.transpileModule(readFileSync(new URL('../src/app/support/page.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 const exports={};new Function('require','exports',code)(name=>{assert.ok(name in ports,'Unexpected Support page dependency');return ports[name];},exports);
 return{tree:await exports.default({searchParams:Promise.resolve({view:'WAITING',page:String(page)})}),calls};
}
const row=(id,can_claim,status='WAITING')=>({id,status,can_claim,customer_name:'Synthetic member',customer_workspace_name:'Synthetic workspace',customer_role:'DRIVER',category:'ACCOUNT',last_message_at:'2026-10-14T12:00:00Z'});
const claims=tree=>nodes(tree).filter(node=>node.type==='form'&&node.props.action?.endsWith('/claim'));

test('Waiting renders only explicitly authorized claims, including away from the first row',async()=>{
 const {tree}=await render([row('first',false),row('eligible',true),row('missing',undefined),row('string','true')]);
 assert.deepEqual(claims(tree).map(form=>({action:form.props.action,method:form.props.method})),[{action:'/api/support/conversations/eligible/claim',method:'post'}]);
 assert.equal(nodes(tree).filter(node=>node.type==='Link'&&['support-conversation-main','button secondary small'].includes(node.props.className)).length,0);
});

test('paused and shared-capacity-full inboxes offer no Claim or dead Open action',async()=>{
 for(const options of [{available:false},{openCount:3,limit:3}]){
  const {tree}=await render([row('oldest',false),row('later',false)],options);
  assert.equal(claims(tree).length,0);
  assert.equal(nodes(tree).filter(node=>node.type==='Link'&&['support-conversation-main','button secondary small'].includes(node.props.className)).length,0);
 }
});

test('later pages preserve bounded query, pagination and refresh without guessing claim eligibility',async()=>{
 const {tree,calls}=await render([row('later-page-first',false)],{page:2,total:16});
 assert.equal(claims(tree).length,0);
 assert.deepEqual(calls,[[{id:'agent',role:'SUPPORT',can_manage_support:true},'WAITING',{page:'2',pageSize:15}]]);
 const pagination=nodes(tree).find(node=>node.type==='Pagination');
 assert.equal(pagination.props.page,2);assert.equal(pagination.props.total,16);
 assert.equal(nodes(tree).find(node=>node.type==='SupportRefresh').props.endpoint,'/api/support/updates?view=WAITING&page=2');
 assert.match(nodes(tree).find(node=>node.type==='SupportRefresh').props.initialRevision,/^"[a-f0-9]{64}"$/);
});

test('assigned and closed rows retain their Open actions without Claim',async()=>{
 const assigned='11111111-1111-4111-8111-111111111111',closed='22222222-2222-4222-8222-222222222222';
 const {tree}=await render([row(assigned,true,'OPEN'),row(closed,false,'CLOSED')]);
 assert.equal(claims(tree).length,0);
 const links=nodes(tree).filter(node=>node.type==='Link'&&node.props.className==='button secondary small').map(node=>new URL(node.props.href,'https://team.invalid'));
 assert.deepEqual(links.map(link=>link.pathname),['/support/'+assigned,'/support/'+closed]);
 assert.ok(links.every(link=>link.searchParams.get('returnTo')==='/support?view=WAITING&page=1'));
});
