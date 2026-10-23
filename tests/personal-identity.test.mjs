import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAccountDetails} from '../src/lib/account-details.js';
import {normalizeProviderSignupInput} from '../src/lib/provider-signup.js';
import {nativePublicProvider} from '../src/lib/mobile/public-contract.js';

test('structured account names preserve compound first names and separate private last names',()=>{
  assert.deepEqual(parseAccountDetails({firstName:' Aster\u00a0Hana ',lastName:' Private Father ',phone:'',publicCallbackPhone:'+251 911 000 000'}),{
    firstName:'Aster Hana',lastName:'Private Father',phone:'',publicCallbackPhone:'+251 911 000 000'
  });
});
test('personal profile commands preserve omitted historic descriptions and contacts',async()=>{
  const {providerProfileCommand}=await import('../src/lib/provider-profile/supabase.js');
  assert.deepEqual(providerProfileCommand({basePlaceRef:'catalog-city',baseRegionCode:'OROMIA',published:true}),{
    base_place_ref:'catalog-city',base_region_code:'OROMIA',published:true
  });
  assert.deepEqual(providerProfileCommand({contactPhone:'',showContactPhone:false,published:false}),{contact_phone:'',show_contact_phone:false,published:false});
});
test('native personal profile omits extra personal facts while keeping separate driver portraits and company facts',()=>{
  const portrait='/api/public/driver-portraits/10000000-0000-4000-8000-000000000001';
  const personal=nativePublicProvider({name:'Aster Hana',provider_kind:'SELF_MANAGED_DRIVER',headline:'PRIVATE',about:'PRIVATE',city:'PRIVATE',contact_email:'private@example.test',contact_website:'https://private.example.test',contact_whatsapp:'+251900000000',youtube_video_id:'abcdefghijk',trucks:[{assigned_driver_first_name:'Aster Hana',assigned_driver_portrait_url:portrait}]});
  assert.equal(JSON.stringify(personal).includes('PRIVATE'),false);assert.equal(personal.contacts.email,'');assert.equal(personal.contacts.website,'');assert.equal(personal.contacts.whatsapp,'');
  assert.equal(personal.trucks[0].portrait,portrait);assert.equal(personal.isCompany,false);
  const company=nativePublicProvider({name:'Company Business',provider_kind:'FLEET_TRANSPORTER',headline:'Company headline',about:'Company About',city:'Company city',contact_email:'public@example.test'});
  assert.equal(company.about,'Company About');assert.equal(company.city,'Company city');assert.equal(company.contacts.email,'public@example.test');assert.equal(company.isCompany,true);
});
test('legacy account input and omitted callback retain their original shape',()=>{
  assert.deepEqual(parseAccountDetails({name:'Aster PrivateFather',phone:''}),{name:'Aster PrivateFather',phone:''});
  assert.deepEqual(parseAccountDetails({firstName:'Aster',lastName:'',phone:''}),{firstName:'Aster',lastName:'',phone:''});
  assert.equal(parseAccountDetails({firstName:'Aster',lastName:'',phone:'',publicCallbackPhone:''}).publicCallbackPhone,'');
});
test('signup and account phones round-trip common punctuation and require seven actual digits',()=>{
  const phone='+1.612.555.0100';
  assert.equal(parseAccountDetails({firstName:'Aster',lastName:'',phone,publicCallbackPhone:phone}).phone,phone);
  assert.equal(parseAccountDetails({name:'Aster Private',phone}).phone,phone);
  assert.equal(normalizeProviderSignupInput({firstName:'Aster',lastName:'',phone,publicCallbackPhone:phone,applicationType:'SELF_MANAGED_DRIVER'}).ok,true);
  for(const value of ['.......','+() - .','123.456','12a345678','1234567\u0000']){
    assert.throws(()=>parseAccountDetails({firstName:'Aster',lastName:'',phone:value}),/INVALID_ACCOUNT_DETAILS/);
    assert.equal(normalizeProviderSignupInput({firstName:'Aster',lastName:'',phone:value,applicationType:'SELF_MANAGED_DRIVER'}).ok,false);
  }
});
test('public mobile profile and truck callbacks retain accepted dotted formatting without unsafe destinations',()=>{
  const phone='+1.612.555.0100';
  const personal=nativePublicProvider({name:'Aster',provider_kind:'SELF_MANAGED_DRIVER',contact_phone:phone,trucks:[{assigned_driver_phone:phone}]});
  assert.equal(personal.contacts.phone,phone);assert.equal(personal.trucks[0].phone,phone);
  assert.equal(nativePublicProvider({provider_kind:'FLEET_TRANSPORTER',contact_phone:'123456'}).contacts.phone,'123456');
  for(const value of ['tel:1234567','12a345678','1234567\u0000','1234567\n','.......']){
    const projected=nativePublicProvider({provider_kind:'SELF_MANAGED_DRIVER',contact_phone:value,trucks:[{assigned_driver_phone:value}]});
    assert.equal(projected.contacts.phone,'');assert.equal(projected.trucks[0].phone,'');
  }
});
test('personal identity rejects control characters, oversized names and authority input',()=>{
  for(const extra of [{firstName:'Aster\u0000'},{firstName:'x'.repeat(101)},{lastName:'x'.repeat(100)},{driverId:'foreign'},{name:'other'},{publicCallbackPhone:'account@example.test'}]){
    assert.throws(()=>parseAccountDetails({firstName:'Aster',lastName:'',phone:'',...extra}),/INVALID_ACCOUNT_DETAILS/);
  }
});
test('structured signup keeps company business identity and permits an independent without an invented business name',()=>{
  const common={firstName:' Aster\u202fHana ',lastName:'PrivateFather',phone:'+251911000000',notes:''};
  const company=normalizeProviderSignupInput({...common,businessName:'Company Business',applicationType:'TRANSPORT_COMPANY'});
  assert.equal(company.ok,true);assert.equal(company.input.firstName,'Aster Hana');assert.equal(company.input.lastName,'PrivateFather');assert.equal(company.input.businessName,'Company Business');
  const independent=normalizeProviderSignupInput({...common,applicationType:'SELF_MANAGED_DRIVER'});
  assert.equal(independent.ok,true);assert.equal(independent.input.businessName,'Aster Hana');
  assert.equal(normalizeProviderSignupInput({...common,applicationType:'TRANSPORT_COMPANY'}).ok,false);
  for(const applicationType of ['transport_company',' TRANSPORT_COMPANY ']){
    assert.equal(normalizeProviderSignupInput({...common,applicationType}).ok,false);
    assert.equal(normalizeProviderSignupInput({...common,businessName:'Company Business',applicationType}).ok,true);
  }
  const single=normalizeProviderSignupInput({firstName:'李',lastName:'',phone:'+251911000000',applicationType:'SELF_MANAGED_DRIVER'});
  assert.equal(single.ok,true);assert.equal(single.input.businessName,'李');
});
