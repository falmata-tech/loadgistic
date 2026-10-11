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
 const detail={...shipment,provider:'Demo',mode:'STATUS_ONLY',canReview:false,canApprove:false,events:[],location:null,review:null};
 assert.deepEqual(parseVisitorShipment(detail),detail);
 for(const value of [null,{}, {...page,items:[null]}, {...page,pageCount:'1'}])assert.throws(()=>parseTrackingPage(value),/Could not load shipment updates/);
 for(const value of [null,{}, {...detail,events:[null]}, {...detail,events:null},{...detail,location:{latitude:NaN}},{...detail,review:{rating:Infinity,note:''}}])
  assert.throws(()=>parseVisitorShipment(value),/Could not load shipment updates/);
});
