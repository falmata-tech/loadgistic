import test from 'node:test';import assert from 'node:assert/strict';
import {verificationBadgesFromApproved,projectVerificationSubject,truckDocumentBadges,publicVehicleAuthorityBadges} from '../src/lib/verification-summary.js';

test('public vehicle badges use current authority, not an old approved request',()=>{
 const oldApproval=[{type:'VEHICLE_OWNERSHIP',verified:true,reviewedAt:'2026-09-23'}];
 const badges=publicVehicleAuthorityBadges({},oldApproval);
 assert.deepEqual(badges.map(({type,verified})=>[type,verified]),[
  ['VEHICLE_OWNERSHIP',false],['VEHICLE_AUTHORIZATION',false],['VEHICLE_OPERATING_LICENSE',false]
 ]);
 assert.equal(JSON.stringify(badges).includes('2026-09-23'),false);
});

test('public authority badges distinguish current ownership, permission and licence',()=>{
 const authority={ownership:{verified:true,reviewedAt:'2026-10-01'},permission:{verified:false},operatingLicence:{verified:true,reviewedAt:'2026-10-02',holderBasis:'FINANCED'}};
 const badges=publicVehicleAuthorityBadges(authority,[]);
 assert.deepEqual(badges.map(({verified})=>verified),[true,false,true]);
 assert.equal(badges[0].reviewedAt,'2026-10-01');
 assert.equal(badges[2].reviewedAt,'2026-10-02');
 assert.equal(badges[1].reviewedAt,null);
});

test('expired, revoked and wrong-assignment approvals cannot produce a current public badge',()=>{
 const expired=[{type:'VEHICLE_AUTHORIZATION',verified:false,expired:true,expiresOn:'2026-01-01'}];
 const revoked=[{type:'VEHICLE_OPERATING_LICENSE',verified:true,reviewedAt:'2026-02-01'}];
 const badges=publicVehicleAuthorityBadges({permission:{verified:false},operatingLicence:{verified:false}},[...expired,...revoked]);
 assert.equal(badges[1].verified,false);assert.equal(badges[1].expired,true);
 assert.equal(badges[1].expiresOn,'2026-01-01','Approved expired evidence retains its public expiry detail');
 assert.equal(badges[2].verified,false);assert.equal(badges[2].expired,false);
 assert.equal(JSON.stringify(badges).includes('2026-02-01'),false);
 const staleFact=publicVehicleAuthorityBadges({ownership:{verified:true,reviewedAt:'2026-01-01',expiresOn:'2000-01-01'}},[])[0];
 assert.equal(staleFact.verified,false);assert.equal(staleFact.expired,true);
});

test('ownership and permission name only the document actually reviewed',()=>{
 const ownership={verification_type:'VEHICLE_OWNERSHIP',reviewed_at:'2026-09-23',expires_on:null};
 assert.deepEqual(verificationBadgesFromApproved('VEHICLE',[]).map(b=>[b.type,b.verified]),[['VEHICLE_AUTHORITY',false]]);
 assert.deepEqual(verificationBadgesFromApproved('VEHICLE',[ownership]).map(b=>[b.type,b.verified]),[['VEHICLE_OWNERSHIP',true]]);
 const expired={verification_type:'VEHICLE_AUTHORIZATION',expires_on:'2000-01-01'};
 assert.deepEqual(verificationBadgesFromApproved('VEHICLE',[expired,ownership]).map(b=>[b.type,b.verified,b.expired]),[['VEHICLE_OWNERSHIP',true,false],['VEHICLE_AUTHORIZATION',false,true]]);
});
test('legacy permission is confined to its truck; unrelated documents never verify a truck',()=>{
 const record={verification_type:'VEHICLE_AUTHORIZATION',related_vehicle_id:'truck-a',expires_on:'2999-01-01'};
 assert.equal(truckDocumentBadges([], [record],'truck-b','B')[0].verified,false);
 assert.equal(truckDocumentBadges([], [record],'truck-a','A')[0].type,'VEHICLE_AUTHORIZATION');
 assert.equal(truckDocumentBadges([{verification_type:'BUSINESS_LICENSE'}],[],'truck-a','A')[0].verified,false);
});
test('truck offers both document alternatives and pending state remains unreviewed',()=>{
 const subject={subject_type:'VEHICLE',subject_id:'truck-a',verification_types:['VEHICLE_OWNERSHIP','VEHICLE_AUTHORIZATION'],vehicles:[],approved_documents:[]};
 assert.deepEqual(projectVerificationSubject(subject,[]).allowed_types,['VEHICLE_OWNERSHIP','VEHICLE_AUTHORIZATION']);
 const projected=projectVerificationSubject(subject,[{subject_type:'VEHICLE',subject_id:'truck-a',verification_type:'VEHICLE_AUTHORIZATION',status:'PENDING'}]);
 assert.deepEqual(projected.allowed_types,['VEHICLE_OWNERSHIP']);assert.equal(projected.badges[0].verified,false);
});

test('a pending Driver permission appears under its truck without becoming an approval',()=>{
 const result=projectVerificationSubject({subject_type:'VEHICLE',subject_id:'a',verification_types:['VEHICLE_OWNERSHIP','VEHICLE_AUTHORIZATION']},[
  {subject_type:'DRIVER',subject_id:'driver',related_vehicle_id:'a',verification_type:'VEHICLE_AUTHORIZATION',status:'PENDING'}]);
 assert.equal(result.pending_count,1);assert.deepEqual(result.allowed_types,['VEHICLE_OWNERSHIP']);assert.equal(result.badges[0].verified,false);
});

test('truck-bound pending permission is not counted again as a Driver document',()=>{
 const result=projectVerificationSubject({subject_type:'DRIVER',subject_id:'driver',verification_types:['IDENTITY','DRIVER_IDENTITY']},[
  {subject_type:'DRIVER',subject_id:'driver',related_vehicle_id:'a',verification_type:'VEHICLE_AUTHORIZATION',status:'PENDING'}]);
 assert.equal(result.pending_count,0);assert.deepEqual(result.allowed_types,['IDENTITY','DRIVER_IDENTITY']);
});
