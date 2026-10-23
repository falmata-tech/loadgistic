import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {z} from 'zod';
import {adminAccountReturnPath,adminOperationReturnPath,adminOperationListReturnPath} from '../src/lib/admin-account-navigation.js';

const actorId='00000000-0000-4000-8000-000000000001',userId='00000000-0000-4000-8000-000000000002',orgId='00000000-0000-4000-8000-000000000003',truckId='00000000-0000-4000-8000-000000000004',otherTruck='00000000-0000-4000-8000-000000000005',otherDriver='00000000-0000-4000-8000-000000000006';
const stamp='2026-10-15T00:00:00Z';
function harness({role='SUPPORT',owner=false,permissions=['CUSTOMERS','OPERATIONS','TRUST','SUPPORT'],onQuery=()=>{},onPermission=()=>{},persistedRole=role,workspaceMismatch=false}={}){
 const reads=[],rpcs=[],records=[];const authority={role:persistedRole,active:true};const grants=new Set(permissions);
 const actor={id:actorId,role,can_manage_customers:grants.has('CUSTOMERS'),can_manage_operations:grants.has('OPERATIONS'),can_manage_trust:grants.has('TRUST'),can_manage_support:grants.has('SUPPORT')};
 const membership={user_id:userId,organization_id:orgId,membership_role:owner?'OWNER':'DRIVER'};
 const tables={organization_members:[membership],provider_profiles:[],drivers:[],
  driver_vehicle_assignments:[{driver_user_id:userId,vehicle_id:truckId,active:true,assigned_at:stamp},{driver_user_id:otherDriver,vehicle_id:otherTruck,active:true,assigned_at:stamp}],
  vehicles:[truckId,otherTruck].map((id,index)=>({id,organization_id:orgId,provider_profile_id:null,platform_number:'LG-'+index,make:'Make',model:'Model',cargo_configuration:'Flatbed',active:true,publication_status:'LIVE'})),
  profiles:[{id:userId,full_name:'Driver'},{id:otherDriver,full_name:'Other driver'}],
  provider_shipments:[userId,otherDriver].map((driver,index)=>({id:index?otherTruck:truckId,provider_organization_id:orgId,provider_profile_id:null,assigned_driver_user_id:driver,code:'TRK-'+index,cargo_summary:'Freight',origin:'Origin',destination:'Destination',operational_status:'IN_TRANSIT',updated_at:stamp})),
  verification_requests:[{id:truckId,submitted_by:userId,document_name:'Synthetic document',subject_type:'DRIVER',subject_id:userId,related_vehicle_id:truckId,verification_type:'IDENTITY',status:'PENDING',submitted_at:stamp,expires_on:null,review_note:null,storage_path:'PRIVATE_FILE_SENTINEL'}],
  support_conversations:[{id:truckId,customer_user_id:userId,assigned_agent_user_id:actorId,category:'ACCOUNT',status:'OPEN',updated_at:stamp},{id:otherTruck,customer_user_id:userId,assigned_agent_user_id:otherDriver,category:'ACCOUNT',status:'OPEN',updated_at:stamp}],
  telematics_devices:[{id:truckId,organization_id:orgId,provider_profile_id:null,label:'Tracker',protocol:'gt06',active:true,last_seen_at:stamp,imei:'PRIVATE_DEVICE_SENTINEL',raw_lat:1.2345}]};
 const client={rpc:async(name,args)=>{rpcs.push({name,args});onPermission(name,args,grants);if(name==='managed_actor_has_permission')return{data:grants.has(args.permission_name),error:null};if(name==='support_actor_can_read')return{data:true,error:null};throw Error('UNEXPECTED_RPC');},
  from(table){let fields='',filters=[],start=0,end=Infinity;return new class{
   select(value){fields=value;assert.notEqual(value,'*');return this;}or(value){filters.push({kind:'or',value});return this;}eq(key,value){filters.push({kind:'eq',key,value});return this;}in(key,value){filters.push({kind:'in',key,value});return this;}order(){return this;}limit(n){end=n-1;return this;}range(a,b){start=a;end=b;return this;}
   then(resolve,reject){return Promise.resolve().then(()=>{reads.push({table,fields,filters});onQuery(table,grants,membership,tables,authority);let data=tables[table].filter(row=>filters.every(filter=>filter.kind==='eq'?row[filter.key]===filter.value:filter.kind==='in'?filter.value.includes(row[filter.key]):row.subject_type==='VEHICLE'&&row.subject_id===truckId||row.related_vehicle_id===truckId));const count=data.length;data=data.slice(start,end+1).map(row=>Object.fromEntries(fields.split(',').map(field=>[field,row[field]])));return{data,error:null,count};}).then(resolve,reject);}
  }();}}
 const getRecord=async(who,view,id,kind)=>{assert.equal(who.id,actorId,'never impersonate the account being inspected');records.push({view,id,kind});if(!grants.has('CUSTOMERS')&&['USERS','WORKSPACES'].includes(view))throw Error('FORBIDDEN');
  if(view==='USERS')return{id,name:id===actorId?'Staff':'Account owner',email:'synthetic@example.invalid',phone:null,role:id===actorId?authority.role:'DRIVER',active:id===actorId?authority.active:true,created_at:stamp};
  if(view==='WORKSPACES')return{id:workspaceMismatch?otherTruck:orgId,record_kind:kind||'ORGANIZATION',type:'TRANSPORT_COMPANY',name:'Provider',city:'Adama',handle:'provider',truck_count:2,tracking_count:2};
  if(view==='TRUCKS'){if(!grants.has('OPERATIONS'))throw Error('FORBIDDEN');return{id};}
  if(view==='DRIVERS')return owner?null:{id:userId,owner_id:orgId,owner_name:'Provider',vehicle_id:truckId,platform_number:'LG-0',can_manage_capacity:true,can_manage_tracking:false};throw Error('UNEXPECTED_RECORD');};
 const source=ts.transpileModule(readFileSync(new URL('../src/lib/platform-admin/account.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const ports={zod:{z},'../supabase-adapter.js':{createSupabaseAdminClient:()=>client},'./supabase.js':{getAdminOperationRecord:getRecord,hasPlatformPermission:(value,p)=>value.role==='ADMIN'||Boolean(value[{CUSTOMERS:'can_manage_customers',OPERATIONS:'can_manage_operations',TRUST:'can_manage_trust',SUPPORT:'can_manage_support'}[p]])}};
 const exports={};new Function('require','exports',source)(name=>{assert.ok(name in ports);return ports[name];},exports);
 return{read:options=>exports.getAdminAccountOverview(actor,userId,options),readDocuments:(view,id,kind,page)=>exports.getAdminRecordDocuments(actor,view,id,kind,page),reads,rpcs,records,grants,membership,tables,authority};
}
test('missing independent responsibilities make no protected section query',async()=>{
 const h=harness({permissions:['CUSTOMERS']}),view=await h.read();assert.equal(view.providers[0].relationship,'DRIVER');
 for(const section of['fleet','tracking','documents','support','devices']){assert.equal(view[section].permitted,false);assert.deepEqual(view[section].items,[]);}
 assert.deepEqual([...new Set(h.reads.map(read=>read.table))].sort(),['drivers','organization_members','provider_profiles']);
});
test('foreign provider selection is denied before any operational or document read',async()=>{
 const h=harness();await assert.rejects(()=>h.read({providerKey:'ORGANIZATION:'+otherTruck}),/ACCOUNT_PROVIDER_NOT_RELATED/);
 assert.ok(h.reads.every(read=>['drivers','organization_members','provider_profiles'].includes(read.table)));
});
test('an employed driver has only their assigned truck and Tracking, not the employer fleet',async()=>{
 const h=harness(),view=await h.read();assert.equal(view.selectedProvider.relationship,'DRIVER');assert.equal(view.fleet.total,1);assert.deepEqual(view.fleet.items.map(row=>row.id),[truckId]);assert.deepEqual(view.tracking.items.map(row=>row.id),[truckId]);assert.deepEqual(view.support.items.map(row=>row.id),[truckId]);
 assert.ok(h.reads.find(read=>read.table==='vehicles').filters.some(filter=>filter.kind==='in'&&filter.key==='id'));
 assert.equal(h.reads.some(read=>read.table==='telematics_devices'),false);assert.equal(JSON.stringify(view).includes('PRIVATE_FILE_SENTINEL'),false);
});
test('an exact owner receives the bounded owned fleet and admin-only safe tracker summary',async()=>{
 const h=harness({role:'ADMIN',owner:true}),view=await h.read();assert.equal(view.selectedProvider.relationship,'OWNER');assert.equal(view.fleet.total,2);assert.equal(view.tracking.total,2);assert.equal(view.devices.items.length,1);
 const serialized=JSON.stringify(view);for(const forbidden of['PRIVATE_FILE_SENTINEL','PRIVATE_DEVICE_SENTINEL','raw_lat','storage_path','imei'])assert.equal(serialized.includes(forbidden),false);
 assert.ok(h.reads.filter(read=>['vehicles','provider_shipments','telematics_devices'].includes(read.table)).every(read=>read.filters.some(filter=>filter.kind==='eq'&&['organization_id','provider_organization_id'].includes(filter.key)&&filter.value===orgId)));
});
test('permission revoked during reads discards buffered operations and trust records',async()=>{
 const h=harness({owner:true,onQuery:(table,grants)=>{if(table==='vehicles')grants.delete('OPERATIONS');if(table==='verification_requests')grants.delete('TRUST');}}),view=await h.read();
 for(const section of['fleet','tracking','documents','devices']){assert.equal(view[section].permitted,false);assert.deepEqual(view[section].items,[]);}
});
test('revoking Customers or changing membership prevents returning any buffered account overview',async()=>{
 for(const revoke of[true,false]){const h=harness({owner:true,onQuery:(table,grants,membership)=>{if(table==='vehicles'){if(revoke)grants.delete('CUSTOMERS');else membership.membership_role='DRIVER';}}});await assert.rejects(()=>h.read(),revoke?/FORBIDDEN/:/ACCOUNT_RELATIONSHIP_CHANGED/);}
});
test('account return paths allow only an exact internal account and validated member-scope key',()=>{
 const path=`/admin/operations/users/${userId}`;assert.equal(adminAccountReturnPath(path),path);assert.equal(adminAccountReturnPath(path+'?provider=ORGANIZATION:'+orgId),path+'?provider=ORGANIZATION%3A'+orgId);
 for(const path of['https://evil.invalid','//evil.invalid','/admin/operations/users/no-id','/admin/operations/users/'+userId+'/extra','/admin/operations/users/'+userId+'?provider=bad','/\\evil.invalid'])assert.equal(adminAccountReturnPath(path),null);
});

test('an unassigned employee keeps only their own historical Tracking',async()=>{
 const h=harness();h.tables.driver_vehicle_assignments=h.tables.driver_vehicle_assignments.filter(row=>row.driver_user_id!==userId);
 const view=await h.read();assert.equal(view.fleet.total,0);assert.deepEqual(view.tracking.items.map(row=>row.id),[truckId]);assert.equal(h.reads.some(row=>row.table==='vehicles'),false);
});
test('ambiguous or changed active assignments cannot return an earlier employee scope',async()=>{
 const ambiguous=harness();ambiguous.tables.driver_vehicle_assignments.push({driver_user_id:userId,vehicle_id:otherTruck,active:true,assigned_at:stamp});await assert.rejects(()=>ambiguous.read(),/ACCOUNT_ASSIGNMENT_AMBIGUOUS/);
 let changed=false;const h=harness({onQuery:(table,grants,membership,tables)=>{if(table==='vehicles'&&!changed){changed=true;tables.driver_vehicle_assignments[0].vehicle_id=otherTruck;}}});await assert.rejects(()=>h.read(),/ACCOUNT_RELATIONSHIP_CHANGED/);
});
test('cached admin status cannot expose admin-only devices or unassigned support after a persisted downgrade',async()=>{
 const h=harness({role:'ADMIN',persistedRole:'SUPPORT',owner:true}),view=await h.read();assert.equal(view.actorIsAdmin,false);assert.equal(view.devices.permitted,false);assert.equal(h.reads.some(row=>row.table==='telematics_devices'),false);assert.deepEqual(view.support.items.map(row=>row.id),[truckId]);
 const changed=harness({role:'ADMIN',owner:true,onQuery:(table,grants,membership,tables,authority)=>{if(table==='telematics_devices')authority.role='SUPPORT';}});await assert.rejects(()=>changed.read(),/FORBIDDEN/);
});
test('a personal provider employee has an exact DRIVER relationship and no inherited ownership',async()=>{
 const h=harness();h.tables.organization_members=[];h.tables.drivers=[{user_id:userId,organization_id:null,provider_profile_id:orgId,active:true}];h.tables.vehicles.forEach(row=>{row.organization_id=null;row.provider_profile_id=orgId;});h.tables.provider_shipments.forEach(row=>{row.provider_organization_id=null;row.provider_profile_id=orgId;});
 const view=await h.read();assert.equal(view.selectedProvider.kind,'PROVIDER_PROFILE');assert.equal(view.selectedProvider.relationship,'DRIVER');assert.equal(view.fleet.total,1);assert.equal(view.tracking.total,1);
});
test('document, support and device pages are bounded and show accurate totals',async()=>{
 const h=harness({role:'ADMIN',owner:true});for(const table of['verification_requests','support_conversations','telematics_devices']){const original={...h.tables[table][0]};h.tables[table]=Array.from({length:8},(_,i)=>({...original,id:`10000000-0000-4000-8000-${String(i).padStart(12,'0')}`}));}
 const view=await h.read({documentPage:2,supportPage:2,devicePage:2});for(const section of['documents','support','devices']){assert.equal(view[section].total,8);assert.equal(view[section].page,2);assert.equal(view[section].pageCount,2);assert.equal(view[section].items.length,3);}
});
test('child record returns retain only one validated account context',()=>{
 const account=`/admin/operations/users/${userId}?provider=ORGANIZATION:${orgId}`,child=`/admin/operations/trucks/${truckId}?${new URLSearchParams({returnTo:account})}`;
 assert.equal(adminOperationReturnPath(child),child.replace('ORGANIZATION%3A','ORGANIZATION%253A'));
 for(const path of[`/admin/operations-evil/${truckId}`,`/admin/operations/trucks/${truckId}?returnTo=https://evil.invalid`,`/admin/operations/trucks/${truckId}?returnTo=/admin/operations/trucks/${otherTruck}`,`/admin/operations/trucks/${truckId}?other=x`])assert.equal(adminOperationReturnPath(path),null);
});

test('record actions retain only their own bounded searched inventory',()=>{
 const list='/admin/operations?view=TRUCKS&q=Audit&page=2';
 const child=`/admin/operations/trucks/${truckId}?${new URLSearchParams({returnTo:list})}`;
 assert.equal(adminOperationListReturnPath(list,'TRUCKS'),list);
 assert.equal(adminOperationReturnPath(child),child);
 for(const bad of[
  '/admin/operations?view=USERS&q=Audit&page=2',
  '/admin/operations?view=TRUCKS&page=0',
  '/admin/operations?view=TRUCKS&page=2&other=1',
  'https://outside.invalid/admin/operations?view=TRUCKS',
  '/admin/operations/trucks/'+otherTruck
 ])assert.equal(adminOperationListReturnPath(bad,'TRUCKS'),null);
 assert.equal(adminOperationReturnPath(`/admin/operations/trucks/${truckId}?returnTo=${encodeURIComponent('/admin/operations?view=USERS')}`),null);
});

test('a mismatched workspace projection cannot authorize a subsequent provider query',async()=>{
 const h=harness({workspaceMismatch:true});await assert.rejects(()=>h.read(),/ACCOUNT_RELATIONSHIP_CHANGED/);assert.ok(h.reads.every(row=>['drivers','organization_members','provider_profiles'].includes(row.table)));
});

test('exact entity evidence requires current Trust and exact authorized record, with no raw file path',async()=>{
 const denied=harness({permissions:['CUSTOMERS','OPERATIONS']});const missing=await denied.readDocuments('TRUCKS',truckId,'');assert.equal(missing.permitted,false);assert.equal(denied.reads.some(row=>row.table==='verification_requests'),false);
 const h=harness();h.tables.verification_requests.push({...h.tables.verification_requests[0],id:otherTruck,related_vehicle_id:otherTruck,subject_id:otherDriver});const result=await h.readDocuments('TRUCKS',truckId,'');assert.deepEqual(result.items.map(row=>row.id),[truckId]);assert.equal(JSON.stringify(result).includes('PRIVATE_FILE_SENTINEL'),false);
 const query=h.reads.find(row=>row.table==='verification_requests');assert.equal(query.filters[0].value,`and(subject_type.eq.VEHICLE,subject_id.eq.${truckId}),related_vehicle_id.eq.${truckId}`);
 const revoked=harness({onQuery:(table,grants)=>{if(table==='verification_requests')grants.delete('TRUST');}});assert.equal((await revoked.readDocuments('TRUCKS',truckId,'')).permitted,false);
});
