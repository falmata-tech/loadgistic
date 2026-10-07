import test from 'node:test';
import assert from 'node:assert/strict';
import {markerLocation,locationRing,signalPaths} from '../src/map/capacity-geometry.ts';
import {parseCapacityPage} from '../src/api/public-capacity.ts';
test('hidden current geometry cannot produce a location bubble, truck coordinate or ring',()=>{
 const item=parseCapacityPage({items:[{id:'private-only',status:'EMPTY',assigned_driver_first_name:'Driver',current_signal_geometry_visible:false,location_lat:9,location_lng:38,location_precision_km:20,recurring_corridors:[{geometry:'ROUTE',route_points:[{lat:9,lng:38,label:'A'},{lat:10,lng:39,label:'B'}]}]}],hasMore:false}).items[0];
 assert.equal(markerLocation(item),null);assert.deepEqual(locationRing(item),[]);assert.deepEqual(signalPaths(item,8).map(p=>p.kind),['regular']);
});
