import assert from 'node:assert/strict';
import test from 'node:test';
import {withBusinessContext,managedBusinessContext} from '../src/lib/identity/business-context.js';
import {getManagedWorkspaceAccess} from '../src/lib/identity/workspace-access.js';
import {mobileAccountState,mobileIdentity} from '../src/lib/mobile/identity-policy.js';
import {parseSession} from '../apps/mobile/src/session/contract.ts';
import {isTransportSupportMember} from '../src/lib/support-policy.js';
import {areaReturnPath} from '../src/lib/workspace-area-navigation.js';
const actor='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const business={id:'33333333-3333-4333-8333-333333333333',name:'Test business',handle:'test-business',kind:'BROKER',city:null,version:1,actorId:actor,actorRole:'CUSTOMER',membershipRole:'STAFF',membershipRevision:2,permissions:{capacity:true,tracking:false,team:false,owner:false}};
const provider={id:actor,name:'First',email:'first@example.test',role:'TRANSPORTER',active:true,organization_id:'org',provider_profile_id:null,owns_provider_account:true,can_manage_fleet:true,drives_truck:false};
const context={actorId:actor,selectedWorkspaceId:business.id,workspaces:[business],invitations:[]};
const session=user=>({accessToken:'test-access',refreshToken:'test-refresh',expiresAt:2000000000,state:'ACTIVE',user:mobileIdentity(user),access:{granted:true,status:'BUSINESS_ACCESS'}});

test('verified business selection changes effective context while retaining provider anchors',()=>{
 const user=withBusinessContext(provider,context);
 assert.equal(user.role,'CUSTOMER');assert.equal(user.platform_role,'TRANSPORTER');assert.equal(user.organization_id,'org');assert.equal(user.provider_workspace_available,true);
 assert.equal(getManagedWorkspaceAccess(user).status,'BUSINESS_ACCESS');assert.equal(isTransportSupportMember(user),true);
 const mobile=mobileIdentity(user);assert.equal(mobile.canManageFleet,false);assert.equal(mobile.ownsProviderAccount,false);assert.equal(mobile.selectedBusinessWorkspace.id,business.id);
 const parsed=parseSession(session(user));assert.equal(parsed.user.role,'CUSTOMER');assert.equal(parsed.user.platformRole,'TRANSPORTER');assert.equal(parsed.user.businessWorkspaces.length,1);
 const cleared=withBusinessContext(user,{...context,selectedWorkspaceId:null});assert.equal(cleared.role,'TRANSPORTER');assert.equal(cleared.selected_business_workspace,null);assert.equal(cleared.organization_id,'org');
});
test('profile role alone or a stale/foreign selection never opens customer workspace',()=>{
 const base={...provider,role:'SHIPPER',organization_id:null};
 const user=withBusinessContext(base,{...context,selectedWorkspaceId:null});assert.equal(getManagedWorkspaceAccess(user).granted,false);
 assert.equal(mobileAccountState(user,actor),'ONBOARDING');assert.equal(isTransportSupportMember(user),false);
 assert.throws(()=>withBusinessContext(base,{...context,actorId:other}),/MANAGED_BUSINESS_CONTEXT_FAILED/);
 assert.throws(()=>withBusinessContext(base,{...context,workspaces:[]}),/MANAGED_BUSINESS_CONTEXT_FAILED/);
 assert.throws(()=>withBusinessContext(base,{...context,workspaces:[{...business,actorId:other}]}),/MANAGED_BUSINESS_CONTEXT_FAILED/);
 const stale={...withBusinessContext(base,context),business_workspaces:[]};assert.equal(managedBusinessContext(stale),null);assert.equal(mobileAccountState(stale,actor),'ONBOARDING');assert.equal(getManagedWorkspaceAccess(stale).granted,false);
});
test('inactive identities and platform staff cannot become customer contexts or native users',()=>{
 const inactive=withBusinessContext({...provider,active:false},context);assert.equal(inactive.role,'TRANSPORTER');assert.equal(inactive.selected_business_workspace,null);assert.equal(getManagedWorkspaceAccess(inactive).granted,false);
 for(const role of ['ADMIN','SUPPORT']){const user=withBusinessContext({...provider,role},context);assert.equal(user.role,role);assert.deepEqual(user.business_workspaces,[]);assert.equal(mobileAccountState(user,actor),'WEB_ONLY');
  assert.equal(mobileAccountState({...user,role:'CUSTOMER',selected_business_workspace:business,business_workspaces:[business]},actor),'WEB_ONLY');}
});
test('native parsing rejects forged customer, platform and inconsistent permission snapshots',()=>{
 const valid=session(withBusinessContext(provider,context));
 for(const patch of [{selectedBusinessWorkspace:null},{businessWorkspaces:[]},{platformRole:'ADMIN'},{businessWorkspaces:[{...business,actorId:other}]},{businessWorkspaces:[{...business,permissions:{...business.permissions,team:true}}]},{canManageFleet:true},{currentDriverId:actor}]){
  assert.throws(()=>parseSession({...valid,user:{...valid.user,...patch}}),/Invalid sign-in response/);
 }
 assert.throws(()=>parseSession({...valid,user:{...valid.user,selectedBusinessWorkspace:{...business,membershipRevision:99}}}),/Invalid sign-in response/);
});
test('business view return paths preserve only presentation filters, never credentials or foreign routes',()=>{
 assert.equal(areaReturnPath('/app/business/capacity?vehicleCategory=FLATBED','workspace'),'/app/business/capacity?vehicleCategory=FLATBED');
 assert.equal(areaReturnPath('/app/business/tracking/11111111-1111-4111-8111-111111111111','workspace'),'/app/business/tracking/11111111-1111-4111-8111-111111111111');
 for(const path of ['/app/business/capacity?token=private','/admin','https://example.test/app/business/account'])assert.equal(areaReturnPath(path,'workspace'),null);
});
