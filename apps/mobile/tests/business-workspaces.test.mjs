import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {businessApiPathAllowed,businessApiArrayResponse} from '../../../src/lib/mobile/business-api-path.js';
import {parseBusinessContext,parseBusinessDirectory,parseBusinessTrackingDetail,loadBusinessCapacity} from '../src/api/business-workspaces.ts';
import {workspaceDestinations,workspaceHome,activeDestination,workspaceCapabilities} from '../src/navigation/destinations.ts';
const require=createRequire(import.meta.url),{allowedPath}=require('../scripts/local-preview-proxy.cjs');
test('shared validation resolves only the pinned mobile runtime without widening project roots',()=>{
 const config=require('../metro.config.js'),mobileRoot=fileURLToPath(new URL('../',import.meta.url));
 assert.equal(config.resolver.extraNodeModules.zod,path.join(mobileRoot,'node_modules/zod'));
 assert.equal(require('../node_modules/zod/package.json').version,'3.24.2');
 assert.equal(config.watchFolders.some(folder=>folder.includes('suqpage')||folder===path.resolve(mobileRoot,'../..')),false);
});
const actor='16000000-0000-4000-8000-000000000001',workspace='16000000-0000-4000-8000-000000000002',foreign='16000000-0000-4000-8000-000000000003';
const summary={id:workspace,name:'Synthetic business',handle:'synthetic',kind:'BROKER',city:null,version:1,actorId:actor,actorRole:'CUSTOMER',membershipRole:'STAFF',membershipRevision:1,permissions:{capacity:true,tracking:true,team:false,owner:false}};
test('native transport and local proxy share bounded authenticated business paths',()=>{
 for(const path of ['/api/business-workspaces','/api/business-workspaces/search?q=cargo',`/api/business-workspaces/${workspace}`,`/api/business-workspaces/${workspace}/capacity/discovery?q=office`, `/api/business-workspaces/${workspace}/tracking/${foreign}`,`/api/business-workspaces/invitations/${foreign}/accept`,'/api/business-capacity-shares']){
  assert.equal(businessApiPathAllowed(path),true,path);assert.equal(allowedPath(path),true,path);
 }
 for(const path of ['https://foreign.test/api/business-workspaces','//foreign.test/api/business-workspaces','/api/admin/accounts','/api/business-workspaces/not-a-uuid','/api/business-workspaces/../../admin','/api/business-workspaces/%2e%2e/admin','/api/business-workspaces#tracking','/api/business-workspaces\\admin'])assert.equal(businessApiPathAllowed(path),false,path);
 assert.equal(businessApiArrayResponse('/api/business-workspaces/search?q=x'),true);assert.equal(businessApiArrayResponse(`/api/business-workspaces/${workspace}/capacity`),false);
});
test('native context and directory reject foreign identities, invalid selected context and private colleague email leaks',()=>{
 const context={actorId:actor,selectedWorkspaceId:workspace,workspaces:[summary],invitations:[]};assert.equal(parseBusinessContext(context,actor).selectedWorkspaceId,workspace);
 for(const value of [{...context,actorId:foreign},{...context,selectedWorkspaceId:foreign},{...context,workspaces:[{...summary,actorId:foreign}]},{...context,workspaces:[summary,summary]}])assert.throws(()=>parseBusinessContext(value,actor));
 const directory={workspace:summary,members:[{userId:foreign,firstName:'Synthetic',role:'STAFF',active:true,revision:1,capacity:true,tracking:false}],invitations:[]};
 assert.equal(parseBusinessDirectory(directory,actor,workspace).members.length,1);
 assert.throws(()=>parseBusinessDirectory({...directory,members:[{...directory.members[0],email:'private@example.test'}]},actor,workspace));
 const erased={...directory.members[0],firstName:'Former team member',active:false,erased:true};
 assert.equal(parseBusinessDirectory({...directory,members:[erased]},actor,workspace).members[0].erased,true);
 for(const extra of [{email:'erased@example.test'},{active:true}])assert.throws(()=>parseBusinessDirectory({...directory,members:[{...erased,...extra}]},actor,workspace));
 assert.throws(()=>parseBusinessDirectory(directory,actor,foreign));
});
test('customer tabs follow current explicit permissions without fleet/driver authority',()=>{
 const session={state:'ACTIVE',user:{id:actor,role:'CUSTOMER',selectedBusinessWorkspace:summary},access:{granted:true}};
 assert.deepEqual(workspaceDestinations(session).map(item=>item.href),['/business-capacity','/business-tracking','/business-account']);assert.equal(workspaceHome(session),'/business-capacity');
 const trackingOnly={...session,user:{...session.user,selectedBusinessWorkspace:{...summary,permissions:{...summary.permissions,capacity:false}}}};
 assert.deepEqual(workspaceDestinations(trackingOnly).map(item=>item.href),['/business-tracking','/business-account']);assert.equal(workspaceHome(trackingOnly),'/business-tracking');
 assert.equal(activeDestination('/business-shipment',true,session),'/business-tracking');assert.equal(workspaceCapabilities(session).canManageFleet,false);assert.equal(workspaceCapabilities(session).drivesTruck,false);
});
test('business Tracking refuses location/approval/proof escalation in normalized server responses',()=>{
 const detail={workspaceId:workspace,isOwner:false,ownerActionsRequireVerification:true,id:foreign,code:'SYNTHETIC',origin:'A',destination:'B',cargo:'Synthetic',status:'IN_TRANSIT',driver:'Synthetic',truck:'Synthetic',updatedAt:'',provider:'Synthetic',mode:'STATUS_ONLY',canShare:false,canApprove:false,canReview:false,canViewLocation:false,route:[],publicTruck:null,events:[],location:null,review:null};
 assert.equal(parseBusinessTrackingDetail(detail,workspace,foreign).location,null);
 for(const value of [{...detail,workspaceId:foreign},{...detail,canApprove:true},{...detail,canShare:true},{...detail,location:{latitude:9,longitude:38,radius:10,area:'A',updatedAt:'2026-10-18'}},{...detail,events:[{id:'event',status:'LOADING',note:'',createdAt:'2026-10-18',hasProof:true}]}])assert.throws(()=>parseBusinessTrackingDetail(value,workspace,foreign));
});
test('business capacity reads every authorized page, binds workspace/filter and discards aborted returns',async()=>{
 const calls=[],pages=[],row=id=>({id,status:'EMPTY',assigned_driver_first_name:'Synthetic',provider_name:'Synthetic provider',provider_handle:'synthetic',location_lat:9,location_lng:38,location_precision_km:10});
 let index=0;
 const vehicleCategory='Cargo van,Mini Box Truck';
 await loadBusinessCapacity(workspace,new AbortController().signal,items=>pages.push(items.map(item=>item.id)),async path=>{calls.push(path);return index++===0?{items:[row('a')],hasMore:true,nextCursor:'next'}:{items:[row('b')],hasMore:false,nextCursor:null};},{vehicleCategory});
 assert.deepEqual(pages,[['a'],['a','b']]);assert.ok(calls.every(path=>path.startsWith(`/api/business-workspaces/${workspace}/capacity?`)));assert.ok(calls.every(path=>new URL(path,'http://local.test').searchParams.get('vehicleCategory')===vehicleCategory));assert.match(calls[1],/cursor=next/);
 const controller=new AbortController();let published=false;
 await loadBusinessCapacity(workspace,controller.signal,()=>{published=true;},async()=>{controller.abort();return {items:[row('secret')],hasMore:false,nextCursor:null};});assert.equal(published,false);
});
