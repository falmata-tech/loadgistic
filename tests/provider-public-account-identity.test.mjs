import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePublicAccountIdentity} from '../src/lib/provider-public-identity.js';
import {normalizeProviderSignupInput} from '../src/lib/provider-signup.js';
import {providerProfileCommand} from '../src/lib/provider-profile/supabase.js';
import {nativePublicProvider} from '../src/lib/mobile/public-contract.js';
import {discoveryProfiles} from '../src/lib/mobile/discovery-contract.js';
import {mobileIdentity} from '../src/lib/mobile/identity-policy.js';

test('chosen account identity normalizes independently of private legal names',()=>{
 assert.deepEqual(normalizePublicAccountIdentity({accountName:' 李 ',handle:' LI '}),{accountName:'李',handle:'li'});
 assert.equal(normalizePublicAccountIdentity({accountName:'A'.repeat(140),handle:'a'.repeat(64)}).handle.length,64);
 assert.deepEqual(normalizePublicAccountIdentity({firstName:'Aster',lastName:'PrivateFather'}),{});
 for(const input of [{accountName:'Aster'},{handle:'aster'},{accountName:'',handle:'aster'},{accountName:'x'.repeat(141),handle:'aster'},{accountName:'Aster\u0000',handle:'aster'},{accountName:'Aster',handle:'a'},{accountName:'Aster',handle:'a'.repeat(65)},{accountName:'Aster',handle:'api'},{accountName:'Aster',handle:'name/other'}])assert.throws(()=>normalizePublicAccountIdentity(input),/INVALID_/);
});
test('signup display names never choose a company anchor or overwrite private manager names',()=>{
 const person={applicationType:'TRANSPORT_PROVIDER',drivesTruck:false,firstName:'Aster Hana',lastName:'PrivateFather',phone:'+251911000000',accountName:'Rift Road',handle:'rift-road',businessName:'Should not choose authority'};
 const result=normalizeProviderSignupInput(person);
 assert.equal(result.ok,true);assert.equal(result.input.applicationType,'SELF_MANAGED_DRIVER');
 assert.equal(result.input.accountName,'Rift Road');assert.equal(result.input.businessName,'Aster Hana');assert.equal(result.input.lastName,'PrivateFather');
 const legacy=normalizeProviderSignupInput({...person,applicationType:'TRANSPORT_COMPANY',businessName:'Existing legal company'});
 assert.equal(legacy.ok,true);assert.equal(legacy.input.applicationType,'TRANSPORT_COMPANY');assert.equal(legacy.input.businessName,'Existing legal company');
 const oldInput={...person};delete oldInput.accountName;delete oldInput.handle;
 assert.equal(normalizeProviderSignupInput(oldInput).input.applicationType,'TRANSPORT_COMPANY');
});
test('profile edits send only explicit public identity fields and reject manager impersonation',()=>{
 assert.deepEqual(providerProfileCommand({accountName:' Rift Road ',handle:'RIFT-ROAD'}),{account_name:'Rift Road',handle:'rift-road'});
 assert.deepEqual(providerProfileCommand({published:true}),{published:true});
 for(const input of [{managerName:'PrivateFather'},{manager_name:'PrivateFather'},{accountName:'New name'}])assert.throws(()=>providerProfileCommand(input),/INVALID_PUBLIC_ACCOUNT_IDENTITY/);
 const command=providerProfileCommand({accountName:'Rift Road',handle:'rift-road',firstName:'PrivateFirst',lastName:'PrivateFather',role:'ADMIN',organizationId:'foreign'});
 assert.deepEqual(command,{account_name:'Rift Road',handle:'rift-road'});
});
test('public mobile providers expose chosen identity without private legal fields',()=>{
 const profile=nativePublicProvider({account_name:'Rift Road',manager_name:'Aster Hana',name:'Historical PrivateName',handle:'rift-road',provider_kind:'SELF_MANAGED_DRIVER',first_name:'Aster Hana',last_name:'PrivateFather',business_name:'PrivateLegal',phone:'PrivatePhone'});
 assert.equal(profile.name,'Rift Road');assert.equal(profile.accountName,'Rift Road');assert.equal(profile.managerName,'Aster Hana');assert.equal(profile.handle,'rift-road');
 assert.equal(JSON.stringify(profile).includes('Private'),false);
});
test('account search keeps chosen provider identities and excludes employed driver rows',()=>{
 const result=discoveryProfiles({items:[{key:'PROVIDER:rift-road',kind:'COMPANY',title:'Rift Road',accountName:'Rift Road',managerName:'Aster',handle:'rift-road',matching_trucks:2},{key:'DRIVER:employee',kind:'COMPANY_DRIVER',title:'Beka',accountName:'Rift Road',managerName:'Aster',owner:'Rift Road',handle:'rift-road',capacity_id:'pair',matching_trucks:1},{key:'PROVIDER:beka-transport',kind:'SELF_MANAGED_DRIVER',title:'Beka Transport',accountName:'Beka Transport',managerName:'Beka',handle:'beka-transport',matching_trucks:1,capacity_id:'self-pair'}],total:2,page:1,pageSize:15,hasMore:false});
 assert.equal(result.items.length,2);
 assert.equal(result.items[0].title,'Rift Road');assert.equal(result.items[0].managerName,'Aster');
 assert.equal(result.items.some(row=>row.key==='DRIVER:employee'),false);
 assert.equal(result.items[1].title,'Beka Transport');assert.equal(result.items[1].kind,'SELF_MANAGED_DRIVER');assert.equal(result.items[1].accountName,'Beka Transport');assert.equal(result.items[1].managerName,'Beka');assert.equal(result.items[1].handle,'beka-transport');
 assert.ok(result.items.every(row=>row.capacityId===''),'account search does not grant a direct employee/vehicle selection');
});
test('private session display keeps chosen account identity separate from legal anchors and permissions',async()=>{
 const user=mobileIdentity({id:'owner',name:'Aster PrivateFather',email:'synthetic@example.test',role:'DRIVER',provider_account_name:'Rift Road',provider_business_name:'LegacyLegal167',can_manage_fleet:true,secret:'discard'});
 assert.equal(user.providerAccountName,'Rift Road');assert.equal(user.businessName,'LegacyLegal167');assert.equal(user.role,'DRIVER');assert.equal('secret' in user,false);assert.equal('can_manage_fleet' in user,false);
 const {parseSession}=await import('../apps/mobile/src/session/contract.ts');
 const input={accessToken:'synthetic-access',refreshToken:'synthetic-refresh',expiresAt:2000000000,state:'ACTIVE',user,access:{granted:true,status:'FREE_ACCESS'}};
 const parsed=parseSession(input);assert.equal(parsed.user.providerAccountName,'Rift Road');assert.equal(parsed.user.businessName,'LegacyLegal167');assert.equal(parsed.user.role,'DRIVER');
 assert.throws(()=>parseSession({...input,user:{...user,providerAccountName:'x'.repeat(201)}}),/Invalid sign-in/);
});
