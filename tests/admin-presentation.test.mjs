import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {z} from 'zod';
import {statusLabel} from '../src/lib/domain.js';
import * as featuredStatus from '../src/lib/featured-status.js';
import * as featuredTikTok from '../src/lib/featured-tiktok-presentation.js';
import * as demoTrackingIdentity from '../src/lib/demo-tracking-identity.js';
import {readWindowedPage} from '../src/lib/pagination.js';
import * as accountNavigation from '../src/lib/admin-account-navigation.js';
import * as teamNavigation from '../src/lib/team-navigation.js';
import {supportRevisionTag} from '../src/lib/support-polling.js';

const id='00000000-0000-4000-8000-000000000001',vehicle='00000000-0000-4000-8000-000000000002';
const user={id,role:'ADMIN',can_manage_support:true};
const nodes=tree=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(typeof tree.type==='function'?tree.type(tree.props):tree.props?.children)];
const text=tree=>tree===undefined||tree===null||typeof tree==='boolean'?'':typeof tree==='string'||typeof tree==='number'?String(tree):Array.isArray(tree)?tree.map(text).join(' '):tree?.type==='Text'?tree.props.message:text(tree?.props?.children);
const all=(tree,type)=>nodes(tree).filter(n=>n.type===type);
function load(file,overrides={}){
 const source=readFileSync(new URL('../'+file,import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const node=(type,props)=>({type,props:props||{}}),simple=new Proxy({},{get:(_target,key)=>key});
 const imports={
  'react/jsx-runtime':{jsx:node,jsxs:node},'next/link':{__esModule:true,default:'Link'},'lucide-react':simple,'zod':{z},
  'next/navigation':{redirect:path=>{throw Error('REDIRECT:'+path);},notFound:()=>{throw Error('NOT_FOUND');}},
  '@/components/localization':{Text:'Text',Localized:'Localized'},'./localization':{Text:'Text',Localized:'Localized'},'@/components/page-header':{PageHeader:'PageHeader'},'@/components/flash':{Flash:'Flash'},'@/components/status-pill':{StatusPill:'StatusPill'},'@/components/pagination':{Pagination:'Pagination'},
  '@/components/transport-request-queue-summary':{TransportRequestQueueSummary:'TransportSummary'},'@/components/lifecycle-controls':{TrackingRecoveryControls:'Recovery'},'@/components/tracking-location-map':{TrackingLocationMap:'TrackingMap'},'@/components/tracking-proof-link':{TrackingProofLink:'Proof'},
  '@/components/demo-tracking-label':{DemoTrackingLabel:'DemoTrackingLabel'},'@/lib/demo-tracking-identity.js':demoTrackingIdentity,
  '@/components/provider-authority-review':{ProviderAuthorityReview:'AuthorityReview'},'@/components/workspace-task-dialog':{WorkspaceTaskDialog:'TaskDialog'},'@/components/admin-record-documents':{AdminRecordDocuments:'RecordDocuments'},'@/lib/admin-account-navigation.js':accountNavigation,'@/components/admin-account-overview':{AdminAccountOverviewView:'AccountOverview'},'@/lib/platform-admin/account':{getAdminAccountOverview:async()=>{throw Error('UNEXPECTED_ACCOUNT_OVERVIEW');},getAdminRecordDocuments:async()=>({permitted:false,items:[],total:0,page:1,pageCount:1})},
  '@/components/tracking-map-data':{trackingMapData:()=>{throw Error('Unexpected map projection without authorized test data');}},
  '@/lib/auth':{requireUser:async()=>user},'@/lib/ui':{displayStatus:statusLabel,relativeTime:()=> '1h ago'},
  '@/lib/platform-admin.js':{hasPlatformPermission:()=>true,PLATFORM_PERMISSIONS:{CUSTOMERS:'CUSTOMERS',OPERATIONS:'OPERATIONS',TRUST:'TRUST'},getAdminOperations:async()=>({items:[],counts:{},pagination:{page:1,pageCount:1,total:0}})},
  '@/lib/workspace.js':{hasPlatformPermission:()=>true,PLATFORM_PERMISSIONS:{TRUST:'TRUST',OPERATIONS:'OPERATIONS'}},
  '@/lib/lifecycle.js':{getTrackingRecovery:async()=>({actions:[]}),adminTrackingLocation:async()=>null},'@/lib/provider-tracking.js':{listProviderTrackingAppeals:async()=>[]},
  '@/lib/review-navigation.js':{reviewQueueStatus:()=> 'PENDING',reviewQueuePath:()=> '/admin/reviews?tab=documents'},
  '@/lib/featured-status.js':featuredStatus,
  '@/lib/featured-tiktok-presentation.js':featuredTikTok,
  '@/lib/pagination.js':{readWindowedPage},'@/lib/team-navigation.js':teamNavigation,'@/lib/support-polling.js':{supportRevisionTag},'@/components/support-refresh':{SupportRefresh:'Refresh'},
  '@/app/admin/admin-presentation.module.css':{__esModule:true,default:simple},...overrides
 };
 const exports={};new Function('require','exports',code)(name=>{assert.ok(name in imports,'Unbounded import '+name);return imports[name];},exports);return exports.default||exports;
}
test('record rows open details without entering edit mode or offering destructive list commands',async()=>{
 const record={id,record_kind:'PROVIDER_PROFILE',name:'Long transporter name',workspace_name:'Fleet',role:'DRIVER',active:true,type:'TRANSPORT_COMPANY',make:'Make',model:'Model',platform_number:'LG-002',plate:'AA-002',owner_name:'Fleet',status:'PARTIAL',visibility:'PRIVATE_NETWORK',geometry:'ROUTE',provider_name:'Fleet',provider_handle:'fleet',driver_name:'Driver',code:'TRK-02',cargo_summary:'Freight',origin:'A',destination:'B',can_manage_capacity:true,can_manage_tracking:false};
 const expected={USERS:['user'],WORKSPACES:[],TRUCKS:['vehicle'],DRIVERS:['driver_permissions','driver'],TRACKING:[],CAPACITY:['capacity'],ROUTES:['provider_profile']};
 for(const [view,kinds]of Object.entries(expected)){
  const page=load('src/app/admin/operations/page.tsx',{'@/lib/platform-admin.js':{hasPlatformPermission:()=>true,PLATFORM_PERMISSIONS:{CUSTOMERS:'CUSTOMERS',OPERATIONS:'OPERATIONS'},getAdminOperations:async()=>({items:[record],counts:{},pagination:{page:1,pageCount:1,total:1}})}});
  const tree=await page({searchParams:Promise.resolve({view})});const row=all(tree,'article').find(n=>text(n).includes(view==='TRACKING'?'TRK-02':view==='TRUCKS'||view==='CAPACITY'?'LG-002':view==='ROUTES'?'Fleet':'Long transporter name'));
  assert.ok(row);const group=nodes(row).find(n=>n.props?.className==='rowActions');assert.ok(group,'actions must be grouped for '+view);
  assert.equal(all(group,'form').length,0,'commands belong to the deliberate detail task for '+view);
  assert.equal(all(group,'details').length,0,'records are not editing accordions');
  assert.ok(all(group,'Link').some(n=>n.props.href.startsWith(`/admin/operations/${view.toLowerCase()}/${id}`)));
 }
});
test('Capacity details humanize enum display while preserving status and Off Duty command',async()=>{
 const record={id,view:'CAPACITY',platform_number:'LG-002',status:'PARTIAL',visibility:'PRIVATE_NETWORK',availability_geometry:'ROUTE',make:'Make',model:'Model',owner_name:'Fleet'};
 const page=load('src/app/admin/operations/[view]/[id]/page.tsx',{'@/lib/platform-admin.js':{hasPlatformPermission:()=>true,PLATFORM_PERMISSIONS:{OPERATIONS:'OPERATIONS'},getAdminOperationRecord:async()=>record}});
 const tree=await page({params:Promise.resolve({view:'capacity',id}),searchParams:Promise.resolve({})});
 assert.equal(text(all(tree,'PageHeader')[0].props.title).replace(/\s+/g,' ').trim(),'LG-002 · Partial');assert.ok(text(tree).includes('Private capacity'));assert.equal(all(tree,'StatusPill')[0].props.status,'PARTIAL');
 const form=all(tree,'form').find(n=>n.props.action===`/api/admin/records/capacity/${id}`);assert.ok(form);assert.ok(all(form,'button').some(n=>n.props.name==='command'&&n.props.value==='OFF_DUTY'));
});
test('Driver Open owner names the exact organization kind missing from the bounded Driver projection',async()=>{
 const record={id,view:'DRIVERS',name:'Assigned driver',active:true,owner_name:'Exact fleet',owner_id:vehicle};
 const page=load('src/app/admin/operations/[view]/[id]/page.tsx',{'@/lib/platform-admin.js':{hasPlatformPermission:()=>true,PLATFORM_PERMISSIONS:{OPERATIONS:'OPERATIONS'},getAdminOperationRecord:async()=>record}});
 const tree=await page({params:Promise.resolve({view:'drivers',id}),searchParams:Promise.resolve({})});
 const owner=all(tree,'Link').find(node=>text(node).trim()==='Open owner');
 assert.ok(owner);assert.equal(owner.props.href,`/admin/operations/workspaces/${vehicle}?kind=ORGANIZATION`);
 assert.ok(all(tree,'form').some(node=>node.props.action===`/api/admin/records/driver_permissions/${id}`));
 const truck=load('src/app/admin/operations/[view]/[id]/page.tsx',{'@/lib/platform-admin.js':{hasPlatformPermission:()=>true,PLATFORM_PERMISSIONS:{OPERATIONS:'OPERATIONS'},getAdminOperationRecord:async()=>({...record,view:'TRUCKS',owner_kind:'PROVIDER_PROFILE'})}});
 const truckTree=await truck({params:Promise.resolve({view:'trucks',id}),searchParams:Promise.resolve({})});
 assert.equal(all(truckTree,'Link').find(node=>text(node).trim()==='Open owner').props.href,`/admin/operations/workspaces/${vehicle}?kind=PROVIDER_PROFILE`);
});

const boundedQueues=[
 {file:'src/app/admin/reviews/content/page.tsx',table:'content_reports',path:'/admin/reviews/content',empty:'No content reports yet.',unavailable:'CONTENT_QUEUE_UNAVAILABLE',row:{id,handle:'exact-provider',category:'PROFILE',detail:'Exact report detail',status:'PENDING',created_at:'2026-10-14T00:00:00Z',decision_note:null}},
 {file:'src/app/admin/privacy/page.tsx',table:'account_deletion_requests',path:'/admin/privacy',empty:'No deletion requests yet.',unavailable:'PRIVACY_QUEUE_UNAVAILABLE',row:{id,subject_user_id:vehicle,status:'REQUESTED',requested_at:'2026-10-14T00:00:00Z',review_due_at:'2026-11-13T00:00:00Z',retention_reason:null,review_after:null,completed_at:null}},
];
function boundedQueue(queue,response){
 const ranges=[];
 const client={from:table=>({select:()=>table==='profiles'?{in:async(_column,ids)=>{assert.deepEqual(ids,[vehicle]);return {data:[{id:vehicle,full_name:'Exact account owner',email:'owner@example.invalid'}],error:null};}}:{order:()=>({range:async(start,end)=>{assert.equal(table,queue.table);ranges.push([start,end]);return response(start,end);}})}})};
 return {ranges,page:load(queue.file,{'@/lib/supabase-adapter.js':{createSupabaseAdminClient:()=>client}})};
}
for(const queue of boundedQueues){
 test(`${queue.table} recovers stale pages and normalizes invalid pages without losing exact controls`,async()=>{
  for(const value of ['99999','1.5','-1','Infinity','1000001']){
   const view=boundedQueue(queue,start=>({data:start===0?[queue.row]:[],count:1,error:null}));
   const tree=await view.page({searchParams:Promise.resolve({page:value})});
   assert.equal(all(tree,'section').length,1,'saved record must remain visible for '+value);
   assert.equal(text(tree).includes(queue.empty),false);
   assert.deepEqual(view.ranges,value==='99999'?[[1999960,1999979],[0,19]]:[[0,19]]);
   assert.equal(all(tree,'Link').filter(node=>['Previous','Next'].includes(text(node))).length,0);
   const form=all(tree,'form')[0];assert.equal(form.props.action,queue.table==='content_reports'?`/api/admin/content/${id}`:`/api/admin/privacy/${id}`);
   if(queue.table==='content_reports')assert.deepEqual(all(form,'button').map(node=>node.props.value),['HIDE','DISMISS']);
   else{
    assert.ok(all(tree,'Link').some(node=>node.props.href===`/admin/operations/users/${vehicle}`));
    assert.ok(all(form,'input').some(node=>node.props.name==='reviewed'&&node.props.required));
    assert.ok(all(form,'input').some(node=>node.props.name==='confirmation'&&node.props.pattern==='DELETE'&&node.props.required));
   }
  }
  const view=boundedQueue(queue,()=>({data:[queue.row],count:45,error:null}));
  const tree=await view.page({searchParams:Promise.resolve({page:'2'})});assert.deepEqual(view.ranges,[[20,39]]);
  const links=all(tree,'Link');assert.ok(links.some(node=>node.props.href===`${queue.path}?page=1`));assert.ok(links.some(node=>node.props.href===`${queue.path}?page=3`));
 });
 test(`${queue.table} keeps genuine emptiness and reports both initial and recovery read failures`,async()=>{
  const empty=boundedQueue(queue,()=>({data:[],count:0,error:null}));
  const tree=await empty.page({searchParams:Promise.resolve({page:'4'})});assert.ok(text(tree).includes(queue.empty));assert.deepEqual(empty.ranges,[[60,79],[0,19]]);
  for(const failFirst of [true,false]){
   const view=boundedQueue(queue,start=>start===0||failFirst?{data:null,count:null,error:{message:'Synthetic query failure'}}:{data:[],count:1,error:null});
   await assert.rejects(()=>view.page({searchParams:Promise.resolve({page:'4'})}),new RegExp(queue.unavailable));
   assert.equal(view.ranges.length,failFirst?1:2);
  }
 });
 test(`${queue.table} recovers the actual later-range PostgREST416 without masking other errors`,async()=>{
  const overflow={data:null,count:null,status:416,error:{code:'PGRST103',message:'Requested range not satisfiable'}};
  const view=boundedQueue(queue,start=>start>0?overflow:{data:[queue.row],count:1,status:200,error:null});
  const tree=await view.page({searchParams:Promise.resolve({page:'99999'})});
  assert.equal(all(tree,'section').length,1);assert.equal(text(tree).includes(queue.empty),false);assert.deepEqual(view.ranges,[[1999960,1999979],[0,19]]);
  const cases=[{status:503,code:'PGRST000'},{status:401,code:'PGRST301'},{status:403,code:'42501'},{status:416,code:'UNEXPECTED_RANGE_ERROR'},{status:503,code:'PGRST103'}];
  for(const failure of cases){
   const failed=boundedQueue(queue,()=>({data:null,count:null,status:failure.status,error:{code:failure.code}}));
   await assert.rejects(()=>failed.page({searchParams:Promise.resolve({page:'4'})}),new RegExp(queue.unavailable));
   assert.deepEqual(failed.ranges,[[60,79]],'other failures must not become page recovery');
  }
  const first=boundedQueue(queue,()=>overflow);await assert.rejects(()=>first.page({searchParams:Promise.resolve({page:'1'})}),new RegExp(queue.unavailable));assert.deepEqual(first.ranges,[[0,19]]);
  const retry=boundedQueue(queue,start=>start>0?overflow:{data:null,count:null,status:503,error:{code:'PGRST000'}});
  await assert.rejects(()=>retry.page({searchParams:Promise.resolve({page:'4'})}),new RegExp(queue.unavailable));assert.deepEqual(retry.ranges,[[60,79],[0,19]]);
 });
}
test('document review keeps authorized proof and decisions with exact related reference in a secondary disclosure',async()=>{
 const request={id,document_name:'Driver permit',submitter_name:'Driver',subject_type:'DRIVER',verification_type:'IDENTITY',status:'PENDING',original_name:'permit.png',submitted_at:'2026-10-13T10:00:00Z',related_vehicle_id:vehicle};
 const page=load('src/app/admin/reviews/page.tsx',{'@/lib/verification.js':{listVerificationRequests:async()=>({items:[request],page:1,pageCount:1,total:1})}});
 const tree=await page({searchParams:Promise.resolve({})});assert.ok(all(tree,'a').some(n=>n.props.href===`/api/files/verification/${id}`));
 assert.ok(all(tree,'details').some(n=>all(n,'code').some(code=>text(code)===vehicle)));
 assert.ok(all(tree,'Link').some(n=>n.props.href===`/admin/operations/trucks/${vehicle}`));
 for(const status of ['APPROVED','MORE_INFO','REJECTED'])assert.ok(all(tree,'button').some(n=>n.props.name==='status'&&n.props.value===status));
});
test('team form retains separate permissions, email-code membership, account state and bounded chat limits',async()=>{
 const agent={user_id:vehicle,name:'Agent',email:'agent@example.invalid',active:true,available:true,max_open_conversations:3,open_count:1,closed_count:2,can_manage_support:true,can_manage_brokerage:false,can_manage_billing:true};
 const page=load('src/app/admin/support/page.tsx',{'@/lib/support.js':{listSupportAgents:async()=>({items:[agent],total:1,page:1,pageCount:1}),listSupportInbox:async()=>({items:[],counts:{assigned:1,waiting:2,closed:3},page:1,pageCount:1,total:0})}});
 const tree=await page({searchParams:Promise.resolve({tab:'team'})});const create=all(tree,'form').find(n=>n.props.action==='/api/admin/support-agents'),edit=all(tree,'form').find(n=>n.props.action===`/api/admin/support-agents/${vehicle}`);
 for(const name of ['canManageCustomers','canManageOperations','canManageTrust','canManageSupport','canManageFeatured']){assert.ok(all(create,'input').some(n=>n.props.name===name));assert.ok(all(edit,'input').some(n=>n.props.name===name));}
 for(const form of [create,edit])assert.ok(!all(form,'input').some(n=>n.props.name==='canManageBrokerage'));
 const billing=all(edit,'input').find(n=>n.props.name==='canManageBilling');assert.equal(billing.props.value,'on');
 for(const form of [create,edit]){const max=all(form,'input').find(n=>n.props.name==='maxOpenConversations');assert.equal(max.props.min,'1');assert.equal(max.props.max,'20');assert.equal(form.props.method,'post');}
 assert.ok(all(tree,'TaskDialog').some(n=>n.props.description==='Members sign in with an email code.'));
 assert.equal(all(tree,'details').length,0);assert.equal(all(tree,'TaskDialog').length,2);
});
test('account erasure retains exact account reference and all irreversible confirmation safeguards',async()=>{
 const request={id,subject_user_id:vehicle,status:'PENDING',requested_at:'2026-10-13T00:00:00Z',review_due_at:'2026-10-20T00:00:00Z',retention_reason:null,review_after:null,completed_at:null};
 const client={from:table=>({select:()=>table==='profiles'?{in:async()=>({data:[{id:vehicle,full_name:'Account owner',email:'owner@example.invalid'}],error:null})}:{order:()=>({range:async()=>({data:[request],error:null,count:1})})}})};
 const page=load('src/app/admin/privacy/page.tsx',{'@/lib/supabase-adapter.js':{createSupabaseAdminClient:()=>client}});
 const tree=await page({searchParams:Promise.resolve({})});assert.ok(all(tree,'details').some(n=>all(n,'code').some(code=>text(code)===vehicle)));
 const form=all(tree,'form').find(n=>n.props.action===`/api/admin/privacy/${id}`);assert.ok(form);assert.equal(form.props.method,'post');
 assert.ok(all(form,'input').some(n=>n.props.name==='reviewed'&&n.props.required&&n.props.value==='yes'));assert.ok(all(form,'input').some(n=>n.props.name==='confirmation'&&n.props.pattern==='DELETE'&&n.props.required));
 assert.ok(text(tree).includes('Cleanup is permanent.'));
});
test('delegated staff still cannot open unassigned record or review responsibilities',async()=>{
 const permissions={hasPlatformPermission:()=>false,PLATFORM_PERMISSIONS:{CUSTOMERS:'CUSTOMERS',OPERATIONS:'OPERATIONS',TRUST:'TRUST'}};
 const list=load('src/app/admin/operations/page.tsx',{'@/lib/platform-admin.js':permissions});
 await assert.rejects(()=>list({searchParams:Promise.resolve({view:'TRUCKS'})}),/REDIRECT:\/support/);
 const detail=load('src/app/admin/operations/[view]/[id]/page.tsx',{'@/lib/platform-admin.js':permissions});
 await assert.rejects(()=>detail({params:Promise.resolve({view:'trucks',id}),searchParams:Promise.resolve({})}),/REDIRECT:\/admin\/operations/);
 const reviews=load('src/app/admin/reviews/page.tsx',{'@/lib/workspace.js':permissions,'@/lib/verification.js':{listVerificationRequests:()=>{throw Error('MUST_NOT_READ');}}});
 await assert.rejects(()=>reviews({searchParams:Promise.resolve({})}),/REDIRECT:\/support/);
 const content=load('src/app/admin/reviews/content/page.tsx',{'@/lib/platform-admin.js':permissions,'@/lib/supabase-adapter.js':{createSupabaseAdminClient:()=>{throw Error('MUST_NOT_READ');}}});
 await assert.rejects(()=>content({searchParams:Promise.resolve({})}),/REDIRECT:\/support/);
});
test('content review humanizes display but retains exact moderation command values',async()=>{
 for(const status of ['PENDING','HIDDEN','DISMISSED']){
  const request={id,handle:'provider',category:'PICTURE',detail:'Reported content detail',status,created_at:'2026-10-13T00:00:00Z',decision_note:null};
  const client={from:()=>({select:()=>({order:()=>({range:async()=>({data:[request],error:null,count:1})})})})};
  const page=load('src/app/admin/reviews/content/page.tsx',{'@/lib/supabase-adapter.js':{createSupabaseAdminClient:()=>client}});
  const tree=await page({searchParams:Promise.resolve({})});assert.ok(text(tree).includes('Picture'));assert.equal(all(tree,'StatusPill')[0].props.status,status);
  assert.ok(all(tree,'Link').some(n=>n.props.href==='/providers/provider'));
  const decisions=all(tree,'button').filter(n=>n.props.name==='decision').map(n=>n.props.value);
  assert.deepEqual(decisions,status==='PENDING'?['HIDE','DISMISS']:status==='HIDDEN'?['RESTORE']:[]);
 }
});
test('Featured overview retains seven day links, account rotation and manual disclosure',()=>{
 const component=load('src/components/featured-operation-overview.tsx').FeaturedOperationOverview;
 const days=Array.from({length:7},(_,index)=>({date:`2026-10-${13+index}`,theme:'Cargo vans',status:'PUBLISHED',source:'AUTO',selected:8,invalid:0,eligible:15,remaining:7}));
 const tree=component({mode:'AUTO',overview:{eligible:131,remaining:15,days,run:{outcome:'FAILED',checked_at:'2026-10-13T12:00:00Z',succeeded_at:null,created_count:5,skipped_count:2,empty_count:0}}});
 assert.equal(all(tree,'Link').length,7);for(const day of days)assert.ok(all(tree,'Link').some(link=>link.props.href===`/admin/featured?date=${day.date}#featured-day-editor`));
 assert.ok(text(tree).includes('Every 15 minutes'));assert.ok(text(tree).includes('Saved days stay unchanged.'));assert.ok(text(tree).includes('Manual drafts stay private until published.'));
 assert.ok(text(tree).includes('Transport Providers who have not appeared in this round go first.'));assert.ok(text(tree).includes('A new round starts after every eligible account has had a turn.'));
 assert.ok(text(tree).includes('08:30 to 12:00 Ethiopia time'));assert.ok(text(tree).includes('Prepare upcoming days to retry.'));assert.ok(all(tree,'details').length===1);
});
test('retired platform Brokerage queue denies access without reading requests',async()=>{
 let reads=0;
 const component=load('src/components/brokerage-queue.tsx',{
  '@/lib/transport-requests':{listBrokerageRequests:async()=>{reads++;throw Error('MUST_NOT_READ');}}
 }).BrokerageQueue;
 await assert.rejects(()=>component({query:{queue:'ALL',view:'FOLLOW_UP'},path:'/admin/support/transport-requests'}),/NOT_FOUND/);
 assert.equal(reads,0);
});

test('Featured day starts read-only and the complete editor requires the explicit edit view',async()=>{
 const page=load('src/app/admin/featured/page.tsx',{
  '@/components/date-picker':{DatePicker:'DatePicker'},'@/components/featured-operation-overview':{FeaturedOperationOverview:'FeaturedOverview'},
  '@/lib/featured-automation.js':{getFeaturedOverview:async()=>({})},
  '@/lib/platform-admin.js':{hasPlatformPermission:()=>true,getAdminFeaturedProviderDay:async()=>({candidates:[],slots:[],slotEvaluations:[],sponsorships:[],walkthroughs:[],providerCandidates:[],day:null,schedule:{}})},
  '@/lib/featured-trucks.js':{FEATURED_PROVIDER_DAY:{label:'Transport Providers'}},
  '@/components/featured-roster-editor':{FeaturedRosterEditor:'RosterEditor'},'@/components/sponsor-admin-form':{SponsorAdminForm:'SponsorForm'},
  '@/lib/platform-controls.js':{getFeaturedControls:async()=>({featured_mode:'AUTO',featured_target_count:8})},
  '@/components/platform-controls-form':{FeaturedControlsForm:'ControlsForm',FeaturedPrepareForm:'PrepareForm'}
 });
 const view=await page({searchParams:Promise.resolve({date:'2026-10-15'})});assert.equal(all(view,'RosterEditor').length,0);assert.equal(all(view,'details').length,0);assert.equal(all(view,'FeaturedOverview').length,1);
 assert.ok(all(view,'Link').some(n=>n.props.href==='/admin/featured?date=2026-10-15&edit=day#featured-day-editor'));
 const edit=await page({searchParams:Promise.resolve({date:'2026-10-15',edit:'day'})});assert.equal(all(edit,'RosterEditor').length,1);assert.equal(all(edit,'FeaturedOverview').length,0);
 const form=all(edit,'form').find(n=>n.props.action==='/api/admin/featured');assert.ok(form);assert.equal(form.props.method,'post');assert.ok(all(form,'button').some(n=>n.props.name==='command'&&n.props.value==='DRAFT'));assert.ok(all(form,'button').some(n=>n.props.name==='command'&&n.props.value==='PUBLISH'));
 assert.ok(all(edit,'Link').some(n=>n.props.href==='/admin/featured?date=2026-10-15'&&text(n)==='Cancel editing'));
});

for(const targetRole of ['ADMIN','SUPPORT','TRANSPORTER'])test(`account access controls reflect current authority for ${targetRole} targets`,async()=>{
 for(const active of [true,false])for(const actorIsAdmin of [true,false]){
  const account={account:{id:vehicle,name:'Synthetic account',email:'synthetic@example.invalid',phone:null,role:targetRole,active,created_at:'2026-10-15T00:00:00Z'},actorIsAdmin};
  // Cached ADMIN must not retain protected controls after a persisted downgrade.
  const page=load('src/app/admin/operations/[view]/[id]/page.tsx',{'@/lib/platform-admin.js':{hasPlatformPermission:()=>true,PLATFORM_PERMISSIONS:{CUSTOMERS:'CUSTOMERS'}},'@/lib/platform-admin/account':{getAdminAccountOverview:async()=>account},'@/lib/auth':{requireUser:async()=>({...user,role:actorIsAdmin?'SUPPORT':'ADMIN'})}});
  const tree=await page({params:Promise.resolve({view:'users',id:vehicle}),searchParams:Promise.resolve({})}),actions=all(tree,'AccountOverview')[0].props.actions;
  const permitted=actorIsAdmin||targetRole==='TRANSPORTER';
  assert.equal(all(actions,'form').length,permitted?1:0);assert.equal(all(actions,'TaskDialog').length,permitted?1:0);
  if(permitted){const form=all(actions,'form')[0];assert.equal(form.props.action,`/api/admin/records/user/${vehicle}`);assert.equal(all(actions,'TaskDialog')[0].props.triggerLabel,active?'Suspend account':'Restore account');}
  else assert.ok(text(actions).includes('Read-only'));
  assert.equal(all(actions,'Link').some(link=>link.props.href==='/admin/support?tab=team'),actorIsAdmin&&targetRole==='SUPPORT');
 }
});
test('the current account retains its disabled self-suspension control',async()=>{
 const page=load('src/app/admin/operations/[view]/[id]/page.tsx',{'@/lib/platform-admin.js':{hasPlatformPermission:()=>true,PLATFORM_PERMISSIONS:{CUSTOMERS:'CUSTOMERS'}},'@/lib/platform-admin/account':{getAdminAccountOverview:async()=>({account:{...user,name:'Current admin',active:true},actorIsAdmin:true})}});
 const tree=await page({params:Promise.resolve({view:'users',id}),searchParams:Promise.resolve({})}),actions=all(tree,'AccountOverview')[0].props.actions;assert.equal(all(actions,'TaskDialog')[0].props.disabled,true);assert.equal(all(actions,'TaskDialog')[0].props.triggerLabel,'Current account');assert.equal(all(actions,'form')[0].props.action,`/api/admin/records/user/${id}`);
});
