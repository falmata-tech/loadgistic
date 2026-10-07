import test from 'node:test';
import assert from 'node:assert/strict';
import {publicDestinations,workspaceDestinations,workspaceMenu,accountSections,activeDestination,isWorkspace} from '../src/navigation/destinations.ts';
import {parseSession} from '../src/session/contract.ts';
const session=(role='TRANSPORTER',operatingModel='FLEET_TRANSPORTER',granted=true)=>({state:'ACTIVE',user:{id:'local',role,operatingModel},access:{granted}});
const links=items=>items.map(item=>item.href);
test('public phone tabs mirror web and retain visitor Tracking outside provider workspace',()=>{
 assert.deepEqual(links(publicDestinations),['/','/visitor-tracking','/featured','/about']);
 for(const member of [null,session(),session('DRIVER','COMPANY_DRIVER')]){
  assert.equal(isWorkspace('/visitor-shipment',member),false);assert.equal(isWorkspace('/',member),false);
 }
 assert.equal(activeDestination('/visitor-shipment',false),'/visitor-tracking');
 assert.equal(activeDestination('/shipment-detail',true),'/shipments');
 assert.equal(activeDestination('/transporter',false),'/');
});
test('guest, setup and web-only roles never receive operating menus',()=>{
 for(const member of [null,{...session(),state:'ONBOARDING'},{...session(),state:'JOIN_FLEET'},session('ADMIN'),session('SUPPORT')]){
  assert.deepEqual(workspaceMenu(member),[]);assert.deepEqual(workspaceDestinations(member),[]);assert.equal(isWorkspace('/account',member),false);
 }
});
test('workspace tabs group operations and settings without a More sitemap',()=>{
 assert.deepEqual(links(workspaceDestinations(session())),['/account','/fleet','/shipments','/network','/account-settings']);
 assert.deepEqual(links(workspaceDestinations(session('DRIVER','COMPANY_DRIVER'))),['/account','/manage-capacity','/shipments','/network','/account-settings']);
 for(const model of ['OWNER_OPERATOR','SELF_MANAGED_DRIVER'])assert.ok(links(workspaceDestinations(session('DRIVER',model))).includes('/fleet'));
 assert.deepEqual(links(workspaceMenu(session())),['/account']);
 assert.equal(activeDestination('/regular-service',true,session()),'/fleet');
 assert.equal(activeDestination('/manage-capacity',true,session('DRIVER','COMPANY_DRIVER')),'/manage-capacity');
 for(const path of ['/account-details','/account-security','/driver-photo','/profile','/documents','/billing'])assert.equal(activeDestination(path,true,session()),'/account-settings');
});
test('same-page account sections preserve role and limited access boundaries',()=>{
 assert.deepEqual(accountSections(session()),['DETAILS','SECURITY','PROFILE','REGULAR','DOCUMENTS','BILLING']);
 assert.deepEqual(accountSections(session('DRIVER','COMPANY_DRIVER')),['DETAILS','PHOTO','SECURITY','DOCUMENTS','BILLING']);
 for(const member of [null,{...session(),state:'ONBOARDING'},session('ADMIN'),session('SUPPORT')])assert.deepEqual(accountSections(member),[]);
 const limited=session('TRANSPORTER','FLEET_TRANSPORTER',false);
 assert.deepEqual(accountSections(limited),['DETAILS','SECURITY','BILLING']);
 assert.deepEqual(links(workspaceDestinations(limited)),['/account','/billing','/support','/account-settings']);
});
test('session parser retains known operating models without accepting arbitrary actor fields',()=>{
 const raw={accessToken:'a',refreshToken:'r',expiresAt:99,state:'ACTIVE',user:{id:'u',name:'Synthetic',email:'a@example.test',role:'DRIVER',organizationName:'Fleet',businessName:null,operatingModel:'COMPANY_DRIVER',canManageStaff:true},access:{granted:true,status:'FREE_ACCESS'}};
 assert.equal(parseSession(raw).user.operatingModel,'COMPANY_DRIVER');
 assert.equal(parseSession(raw).user.canManageStaff,undefined);
 assert.equal(parseSession({...raw,user:{...raw.user,operatingModel:'ADMIN'}}).user.operatingModel,null);
});
