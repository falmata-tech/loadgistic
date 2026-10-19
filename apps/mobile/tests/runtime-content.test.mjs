import test from 'node:test';
import assert from 'node:assert/strict';
import {parseFeatured,parseTrackingPage,parseVisitorShipment} from '../src/api/runtime-content.ts';
import {nativeFeatured} from '../../../src/lib/mobile/public-contract.js';
const shipment={id:'demo',code:'DEMO',origin:'A',destination:'B',cargo:'Demo',status:'CREATED',driver:'Demo',truck:'Demo',updatedAt:''};
test('server Featured projections including an honestly empty roster remain renderable',()=>{
 const value=nativeFeatured({feature_date:'2026-10-11',published:false,providers:[]});
 assert.deepEqual(parseFeatured(value),value);assert.deepEqual(value.trucks,[]);
});
test('bad Featured arrays or nested records fail before the screen calls filter/map',()=>{
 const value=nativeFeatured({feature_date:'2026-10-11',published:false,providers:[]});
 for(const invalid of [null,{},[],{...value,trucks:null},{...value,week:[null]},{...value,programme:[{slot:{}}]},{...value,sponsors:[{}]}])
  assert.throws(()=>parseFeatured(invalid),/Featured is unavailable/);
});
test('Tracking accepts its authorized projection and rejects malformed lists and details before render',()=>{
 const page={items:[shipment],total:1,page:1,pageCount:1};assert.deepEqual(parseTrackingPage(page),page);
 const detail={...shipment,route:[],publicTruck:null,provider:'Demo',mode:'STATUS_ONLY',canReview:false,canApprove:false,events:[],location:null,review:null};
 assert.deepEqual(parseVisitorShipment(detail),detail);
 const route=[{placeRef:'pickup',label:'Pickup',coordinate:[0,0]},{placeRef:'via',label:'Via',coordinate:[38,9]},{placeRef:'delivery',label:'Delivery',coordinate:[39,10]}];
 assert.deepEqual(parseVisitorShipment({...detail,route}).route,route);
 for(const value of [null,{}, {...page,items:[null]}, {...page,pageCount:'1'}])assert.throws(()=>parseTrackingPage(value),/Could not load shipment updates/);
 for(const value of [null,{}, {...detail,events:[null]}, {...detail,events:null},{...detail,location:{latitude:NaN}},{...detail,review:{rating:Infinity,note:''}},{...detail,route:[route[0],{...route[1],coordinate:[38,NaN]},route[2]]},{...detail,route:[route[0],route[0]]},{...detail,publicTruck:{plate:'PRIVATE'}}])
  assert.throws(()=>parseVisitorShipment(value),/Could not load shipment updates/);
});
