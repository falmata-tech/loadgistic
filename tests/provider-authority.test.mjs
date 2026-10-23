import test from 'node:test';
import assert from 'node:assert/strict';
import {authorityConfirmationSchema,providerAuthoritySummarySchema,providerPublicationSchema,truckAuthoritySchema,emptyTruckAuthority,authorityVehicleIdsSchema} from '../src/lib/provider-authority-contract.js';

test('ownership, permission and licence are independent facts, not an inferred account category',()=>{
 const empty=emptyTruckAuthority();assert.equal(truckAuthoritySchema.parse(empty).qualifiesProvider,false);
 const permission={...empty,permission:{verified:true,reviewedAt:'2026-10-14',expiresOn:'2027-01-01'}};
 assert.equal(truckAuthoritySchema.parse(permission).ownership.verified,false);
 const financed={...permission,operatingLicence:{verified:true,holderBasis:'FINANCED',reviewedAt:'2026-10-14',expiresOn:'2027-01-01'},qualifiesProvider:true};
 assert.equal(truckAuthoritySchema.parse(financed).ownership.verified,false);
 assert.equal(truckAuthoritySchema.parse(financed).permission.verified,true);
 assert.throws(()=>truckAuthoritySchema.parse({...permission,qualifiesProvider:true}));
 assert.throws(()=>truckAuthoritySchema.parse({...financed,operatingLicence:{...financed.operatingLicence,holderBasis:null}}));
});
test('a reviewed licence requires a deliberate holder basis and expiry; declarations are rejected',()=>{
 const contextRevision='a'.repeat(64);
 assert.throws(()=>authorityConfirmationSchema.parse({factKind:'OPERATING_LICENCE',contextRevision,expiresOn:'2027-01-01',reviewNote:'Matched holder.'}));
 assert.throws(()=>authorityConfirmationSchema.parse({factKind:'OPERATING_LICENCE',contextRevision,holderBasis:'PERMISSION',expiresOn:'2027-01-01',reviewNote:'Matched holder.'}));
 assert.throws(()=>authorityConfirmationSchema.parse({factKind:'PERMISSION',contextRevision,expiresOn:'2027-01-01',holderBasis:'OWNED',reviewNote:'Matched holder.'}));
 assert.throws(()=>authorityConfirmationSchema.parse({factKind:'OWNERSHIP',contextRevision,useBasis:'OWNED',reviewNote:'Matched holder.'}));
 assert.equal(authorityConfirmationSchema.parse({factKind:'OPERATING_LICENCE',contextRevision,holderBasis:'FINANCED',expiresOn:'2027-01-01',reviewNote:'Matched holder.'}).holderBasis,'FINANCED');
 assert.throws(()=>authorityConfirmationSchema.parse({factKind:'OWNERSHIP',reviewNote:'Matched holder.'}));
 assert.throws(()=>authorityConfirmationSchema.parse({factKind:'OWNERSHIP',contextRevision:'old',reviewNote:'Matched holder.'}));
});
test('full-fleet summary categories add up and financed is a licence subset',()=>{
 const valid={total:25,ownershipVerified:4,operatingLicenceVerified:5,financedVerified:3,permissionVerified:7,notYetVerified:9};
 assert.deepEqual(providerAuthoritySummarySchema.parse(valid),valid);
 assert.throws(()=>providerAuthoritySummarySchema.parse({...valid,total:12}));
 assert.throws(()=>providerAuthoritySummarySchema.parse({...valid,financedVerified:6}));
});
test('one unreviewed Live slot is separate from qualification for additional trucks',()=>{
 const empty={qualifyingTruckCount:0,qualifyingOwnershipCount:0,qualifyingLicenceCount:0};
 assert.equal(providerPublicationSchema.parse({...empty,canPublish:true,liveTruckCount:0}).canPublish,true);
 for(const liveTruckCount of [1,2,25]){
  assert.equal(providerPublicationSchema.parse({...empty,canPublish:false,liveTruckCount}).canPublish,false);
  assert.throws(()=>providerPublicationSchema.parse({...empty,canPublish:true,liveTruckCount}));
 }
 assert.throws(()=>providerPublicationSchema.parse({...empty,canPublish:false,liveTruckCount:0}));
 assert.throws(()=>providerPublicationSchema.parse({...empty,canPublish:true}));
 assert.throws(()=>providerPublicationSchema.parse({...empty,canPublish:true,liveTruckCount:0.5}));
 assert.equal(providerPublicationSchema.parse({canPublish:true,liveTruckCount:25,qualifyingTruckCount:1,qualifyingOwnershipCount:1,qualifyingLicenceCount:1}).qualifyingTruckCount,1);
});
test('authority projection drops private identity and document fields and bounds caller scope',()=>{
 const projected=truckAuthoritySchema.parse({...emptyTruckAuthority(),source_request_id:'private',holderName:'Private Person',storage_path:'private/file'});
 assert.equal('holderName' in projected,false);assert.equal('storage_path' in projected,false);
 assert.throws(()=>authorityVehicleIdsSchema.parse(Array(101).fill('11111111-1111-4111-8111-111111111111')));
 assert.throws(()=>authorityVehicleIdsSchema.parse(['arbitrary']));
});
