import test from 'node:test';
import assert from 'node:assert/strict';
import {trackingLeases,freshBackgroundFix,backgroundLocationDue} from '../src/location/background-state.ts';
const now=1800000000000,lease={actorId:'11111111-1111-4111-8111-111111111111',shipmentId:'22222222-2222-4222-8222-222222222222',token:'a'.repeat(43),radius:20,expiresAt:new Date(now+86400000).toISOString(),absoluteExpiresAt:new Date(now+30*86400000).toISOString(),lastAttempt:0};
test('background storage accepts only unexpired shipment-specific credentials with <=20-km precision',()=>{
 assert.deepEqual(trackingLeases([lease],now),[lease]);
 for(const change of [{token:'account.jwt.token'},{token:'bad'},{actorId:''},{shipmentId:''},{radius:40},{radius:2},{expiresAt:'bad'},{expiresAt:new Date(now).toISOString()},{absoluteExpiresAt:new Date(now).toISOString()}])assert.deepEqual(trackingLeases([{...lease,...change}],now),[]);
 assert.equal(backgroundLocationDue(lease,now),true);assert.equal(backgroundLocationDue({...lease,lastAttempt:now-599999},now),false);assert.equal(backgroundLocationDue({...lease,lastAttempt:now-600000},now),true);
});
test('stale, inaccurate and invalid background fixes never leave the device',()=>{
 const fix={latitude:41.8781,longitude:-87.6298,accuracy:25,timestamp:now};assert.equal(freshBackgroundFix(fix,now),true);
 for(const change of [{latitude:91},{longitude:181},{latitude:NaN},{accuracy:null},{accuracy:1001},{accuracy:-1},{timestamp:now-120001},{timestamp:now+30001}])assert.equal(freshBackgroundFix({...fix,...change},now),false);
 assert.equal(freshBackgroundFix({...fix,latitude:0,longitude:0},now),true);
});
