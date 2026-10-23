import test from 'node:test';
import assert from 'node:assert/strict';
import {publicDestinations,workspaceDestinations,hasWorkspace,workspaceRoleLabel,workspaceCapabilities,accountSections,activeDestination,isWorkspace} from '../src/navigation/destinations.ts';
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
  assert.equal(hasWorkspace(member),false);assert.deepEqual(workspaceDestinations(member),[]);assert.equal(isWorkspace('/account',member),false);
 }
});
test('workspace tabs group operations and settings without a More sitemap',()=>{
 assert.deepEqual(links(workspaceDestinations(session())),['/account','/shipments','/network','/account-settings']);
 assert.deepEqual(links(workspaceDestinations(session('DRIVER','COMPANY_DRIVER'))),['/account','/manage-capacity','/shipments','/network','/account-settings']);
 for(const model of ['OWNER_OPERATOR','SELF_MANAGED_DRIVER'])assert.ok(links(workspaceDestinations(session('DRIVER',model))).includes('/fleet'));
 assert.equal(activeDestination('/regular-service',true,session()),'/account');
 assert.equal(activeDestination('/fleet',true,session()),'/account');
 assert.equal(activeDestination('/manage-capacity',true,session('DRIVER','COMPANY_DRIVER')),'/manage-capacity');
 for(const path of ['/account-details','/account-security','/driver-photo','/profile','/documents','/billing'])assert.equal(activeDestination(path,true,session()),'/account-settings');
});
test('same-page account sections preserve role and limited access boundaries',()=>{
 assert.deepEqual(accountSections(session()),['DETAILS','SECURITY','PROFILE']);
 assert.deepEqual(accountSections(session('DRIVER','COMPANY_DRIVER')),['DETAILS','SECURITY']);
 for(const member of [null,{...session(),state:'ONBOARDING'},session('ADMIN'),session('SUPPORT')])assert.deepEqual(accountSections(member),[]);
 const limited=session('TRANSPORTER','FLEET_TRANSPORTER',false);
 assert.deepEqual(accountSections(limited),['DETAILS','SECURITY']);
 assert.deepEqual(links(workspaceDestinations(limited)),['/account','/support','/account-settings']);
});
test('session parser retains known operating models without accepting arbitrary actor fields',()=>{
 const raw={accessToken:'a',refreshToken:'r',expiresAt:99,state:'ACTIVE',user:{id:'u',name:'Synthetic',email:'a@example.test',role:'DRIVER',organizationName:'Fleet',businessName:null,operatingModel:'COMPANY_DRIVER',canManageStaff:true},access:{granted:true,status:'FREE_ACCESS'}};
 assert.equal(parseSession(raw).user.operatingModel,'COMPANY_DRIVER');
 assert.equal(parseSession(raw).user.canManageStaff,undefined);
 assert.equal(parseSession({...raw,user:{...raw.user,operatingModel:'ADMIN'}}).user.operatingModel,null);
});

test('provider owners share one label while employed drivers keep their job label',()=>{
 assert.equal(workspaceRoleLabel(session()),'Transport Provider');
 assert.equal(workspaceRoleLabel(session('DRIVER','OWNER_OPERATOR')),'Transport Provider');
 assert.equal(workspaceRoleLabel(session('DRIVER','COMPANY_DRIVER')),'Company driver');
 assert.equal(workspaceRoleLabel(session('DRIVER','SELF_MANAGED_DRIVER')),'Transport Provider');
 assert.equal(workspaceRoleLabel(null),'');
});

test('authoritative driving and fleet capabilities control navigation independently of legacy role',()=>{
 const owner=(role,drivesTruck)=>({...session(role,role==='DRIVER'?'SELF_MANAGED_DRIVER':'FLEET_TRANSPORTER'),user:{...session(role).user,ownsProviderAccount:true,canManageFleet:true,drivesTruck,currentDriverId:drivesTruck?'local':null,currentDrivenVehicleId:null}});
 for(const role of ['DRIVER','TRANSPORTER']){
  const driving=owner(role,true),managing=owner(role,false);
  assert.deepEqual(links(workspaceDestinations(driving)),['/account','/fleet','/shipments','/network','/account-settings']);
  assert.deepEqual(links(workspaceDestinations(managing)),['/account','/shipments','/network','/account-settings']);
  assert.equal(activeDestination('/fleet',true,driving),'/fleet');assert.equal(activeDestination('/fleet',true,managing),'/account');
  assert.equal(workspaceCapabilities(driving).drivesTruck,true);assert.equal(workspaceCapabilities(managing).drivesTruck,false);
 }
 const employee={...session('DRIVER','COMPANY_DRIVER'),user:{...session('DRIVER','COMPANY_DRIVER').user,ownsProviderAccount:false,canManageFleet:false,drivesTruck:true,currentDriverId:'local',currentDrivenVehicleId:'assigned'}};
 assert.ok(!links(workspaceDestinations(employee)).includes('/fleet'));assert.equal(workspaceCapabilities(employee).currentDrivenVehicleId,'assigned');
 const denied={...owner('TRANSPORTER',true),user:{...owner('TRANSPORTER',true).user,ownsProviderAccount:false,canManageFleet:false}};
 assert.equal(workspaceCapabilities(denied).canManageFleet,false,'an authoritative denial overrides a legacy owner role');
});
