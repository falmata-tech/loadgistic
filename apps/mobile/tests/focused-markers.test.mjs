import test from 'node:test';
import assert from 'node:assert/strict';
import {focusedMarkers} from '../src/map/focused-markers.ts';
const overview=[{key:'cluster:1',coordinate:[39,9],cluster:1,count:6,itemId:''},{key:'truck:other',coordinate:[40,10],cluster:null,count:1,itemId:'other'}];
test('focused truck replaces both clusters and other truck touch targets, even with a stale overview',()=>{
 assert.deepEqual(focusedMarkers(overview,'chosen',[38,8]),[{key:'truck:chosen',coordinate:[38,8],cluster:null,count:1,itemId:'chosen'}]);
 assert.deepEqual(focusedMarkers([], 'chosen',[38,8]),focusedMarkers(overview,'chosen',[38,8]));
 assert.deepEqual(focusedMarkers(overview,'chosen',null),[]);
});
test('closing focus restores the loaded overview without reloading or changing it',()=>{
 assert.equal(focusedMarkers(overview,undefined,null),overview);
 assert.equal(overview.length,2);
});
