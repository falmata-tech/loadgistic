import test from 'node:test';
import assert from 'node:assert/strict';
import {trackingRefreshAllowed,trackingRefreshDelay,trackingShipmentActiveStatus} from '../src/lib/tracking-refresh-policy.js';
import {trackingRefreshState} from '../src/lib/tracking-refresh-revision.js';

test('automatic Tracking reads run only for a visible active shipment before absolute expiry',()=>{
 const input={active:true,visible:true,expiresAt:300000,now:60000};
 assert.equal(trackingRefreshAllowed(input),true);
 for(const change of [{active:false},{visible:false},{now:300000},{now:300001},{expiresAt:NaN}])
  assert.equal(trackingRefreshAllowed({...input,...change}),false);
 assert.deepEqual([0,1,2,9].map(trackingRefreshDelay),[60000,120000,240000,240000]);
 assert.equal(trackingShipmentActiveStatus('ISSUE'),true);
 assert.equal(trackingShipmentActiveStatus('COMPLETED'),false);
 assert.equal(trackingShipmentActiveStatus('UNKNOWN'),false);
});

test('poll response exposes only an opaque revision and active state for the authorized projection',()=>{
 const base={id:'synthetic',operational_status:'IN_TRANSIT',events:[],tracking_selected_location:{latitude:9,longitude:39},recipient_email:'private@example.test'};
 const first=trackingRefreshState(base);
 assert.equal(first.revision,trackingRefreshState(structuredClone(base)).revision);
 assert.deepEqual(Object.keys(first),['revision','active']);
 assert.equal(first.active,true);
 assert.doesNotMatch(JSON.stringify(first),/private@example|latitude|longitude/);
 assert.notEqual(first.revision,trackingRefreshState({...base,tracking_selected_location:{latitude:9,longitude:40}}).revision);
 assert.notEqual(first.revision,trackingRefreshState({...base,events:[{status:'UNLOADING'}]}).revision);
 assert.equal(trackingRefreshState({...base,operational_status:'COMPLETED'}).active,false);
});
