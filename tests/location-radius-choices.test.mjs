import test from 'node:test';
import assert from 'node:assert/strict';
import {capacityPrivacyRadii,nextCapacityPrivacyRadius,validateCapacityPrivacyRadius,obscureCoordinate} from '../src/lib/location-privacy.js';
import {trackingPrivacyRadius,TRACKING_PRIVACY_RADII_KM} from '../src/lib/tracking-location-controls.js';
import {selectLocationSchema,approximateTelematicsPosition} from '../src/lib/telematics-contract.js';
test('new capture choices use Capacity20/Tracking10 with10 default and no sub-kilometre choice',()=>{
 assert.deepEqual(capacityPrivacyRadii('BOTH'),[1,3,5,10,20]);assert.deepEqual(TRACKING_PRIVACY_RADII_KM,[1,3,5,10]);
 assert.equal(nextCapacityPrivacyRadius(undefined),10);assert.equal(trackingPrivacyRadius(undefined),10);
 assert.equal(nextCapacityPrivacyRadius(40),20);assert.equal(trackingPrivacyRadius(20),10);
 assert.throws(()=>validateCapacityPrivacyRadius('BOTH',40));assert.throws(()=>validateCapacityPrivacyRadius('BOTH',0.5));
});
test('new GPS/manual configuration and raw projections reject40 but historical obscuring remains stable',()=>{
 const input={vehicleId:'00000000-0000-4000-8000-000000000001',source:'MANUAL',expectedRevision:'2026-10-18T12:00:00Z',precisionKm:20,manualLatitude:9.03,manualLongitude:38.74};
 assert.equal(selectLocationSchema.safeParse(input).success,true);assert.equal(selectLocationSchema.safeParse({...input,precisionKm:40}).success,false);
 assert.throws(()=>approximateTelematicsPosition(9.03,38.74,40));
 const old=obscureCoordinate(9.03,38.74,40);assert.deepEqual(old,obscureCoordinate(9.03,38.74,40));assert.notDeepEqual(old,obscureCoordinate(9.03,38.74,20));
});
