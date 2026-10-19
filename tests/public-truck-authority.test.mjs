import test from 'node:test';
import assert from 'node:assert/strict';
import {publicTruckAuthority,publicProviderAuthoritySummary} from '../src/lib/public-truck-authority.js';
import {nativePublicProvider} from '../src/lib/mobile/public-contract.js';
test('rental permission never implies ownership, licence holder or qualification',()=>{
  const result=publicTruckAuthority({permission:{verified:true,reviewedAt:'2026-10-14',privateHolderName:'Private name'},qualifiesProvider:true,documentNumber:'hidden'});
  assert.equal(result.permission.verified,true);assert.equal(result.ownership.verified,false);
  assert.equal(result.operatingLicence.verified,false);assert.equal(result.qualifiesProvider,false);
  assert.doesNotMatch(JSON.stringify(result),/Private name|documentNumber|hidden/);
});
test('finance licence is distinct from outright ownership and needs reviewed holder basis',()=>{
  const result=publicTruckAuthority({operatingLicence:{verified:true,holderBasis:'FINANCED',reviewedAt:'2026-10-14',expiresOn:'2027-01-01',requestId:'private'}});
  assert.equal(result.ownership.verified,false);assert.equal(result.qualifiesProvider,true);
  assert.equal(result.operatingLicence.holderBasis,'FINANCED');
  assert.equal(publicTruckAuthority({operatingLicence:{verified:true,holderBasis:'PERMISSION'}}).qualifiesProvider,false);
  assert.equal(publicTruckAuthority({ownership:{verified:true}}).qualifiesProvider,true);
});
test('public provider totals require complete mutually exclusive fleet counts',()=>{
  const summary={total:20,ownershipVerified:4,operatingLicenceVerified:3,financedVerified:2,permissionVerified:5,notYetVerified:8,privateDrafts:17};
  assert.equal(publicProviderAuthoritySummary(summary).total,20);
  assert.equal('privateDrafts' in publicProviderAuthoritySummary(summary),false);
  assert.equal(publicProviderAuthoritySummary({...summary,total:12}),null);
  assert.equal(publicProviderAuthoritySummary({...summary,financedVerified:4}),null);
});
test('native profile carries only safe exact truck facts and full fleet summary',()=>{
  const summary={total:2,ownershipVerified:1,operatingLicenceVerified:0,financedVerified:0,permissionVerified:1,notYetVerified:0};
  const profile=nativePublicProvider({name:'Aster',authoritySummary:summary,trucks:[{authority:{permission:{verified:true,beneficiaryEmail:'private@example.test'}},privateDraft:'hidden'}]});
  assert.deepEqual(profile.authoritySummary,summary);assert.equal(profile.trucks[0].authority.permission.verified,true);
  assert.doesNotMatch(JSON.stringify(profile),/beneficiaryEmail|private@example|privateDraft|hidden/);
});
