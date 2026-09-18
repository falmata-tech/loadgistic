import test from 'node:test';
import assert from 'node:assert/strict';
import {trackingRecoveryActions} from '../src/lib/domain.js';
import {lifecycleCommand} from '../src/lib/lifecycle.js';
const base={revision:'2026-09-14T10:00:00.000Z',reason:'Correct agreed details'};
const correction={...base,action:'CORRECT',cargo_summary:'Boxed goods',origin_place_ref:'origin',destination_place_ref:'destination',expected_pickup_date:'2026-09-14',expected_delivery_date:'2026-09-15'};
test('recovery is limited to nonterminal Tracking states',()=>{
 for(const status of ['CREATED','TO_PICKUP','LOADING','IN_TRANSIT','UNLOADING','ISSUE'])assert.deepEqual(trackingRecoveryActions(status),['CORRECT','REASSIGN','CANCEL']);
 for(const status of ['COMPLETED','CANCELLED','UNKNOWN',null])assert.deepEqual(trackingRecoveryActions(status),[]);
});
test('correction requires a revision, reason, bounded cargo, distinct route and ordered dates',()=>{
 assert.deepEqual(lifecycleCommand(correction),correction);
 for(const changed of [{revision:''},{reason:'x'},{cargo_summary:'x'.repeat(501)},{owner:'forged'}])assert.throws(()=>lifecycleCommand({...correction,...changed}),/INVALID_LIFECYCLE_COMMAND/);
 assert.throws(()=>lifecycleCommand({...correction,destination_place_ref:'origin'}),/ROUTE_LOCATIONS_MUST_DIFFER/);
 assert.throws(()=>lifecycleCommand({...correction,expected_delivery_date:'2026-09-13'}),/INVALID_DELIVERY_DATE/);
});
test('cancellation needs explicit confirmation and cannot carry arbitrary state changes',()=>{
 assert.equal(lifecycleCommand({...base,action:'CANCEL',confirm:'CANCEL'}).action,'CANCEL');
 for(const changed of [{},{confirm:'yes'},{confirm:'CANCEL',tracking_mode:'LOCATION_AND_STATUS'}])assert.throws(()=>lifecycleCommand({...base,action:'CANCEL',...changed}),/INVALID_LIFECYCLE_COMMAND/);
});
test('reassignment accepts an exact truck number without exposing an unbounded selector',()=>{
 assert.equal(lifecycleCommand({...base,action:'REASSIGN',vehicle_id:' LG-TEST-123 '}).vehicle_id,'LG-TEST-123');
 assert.throws(()=>lifecycleCommand({...base,action:'REASSIGN',vehicle_id:''}),/INVALID_LIFECYCLE_COMMAND/);
});
