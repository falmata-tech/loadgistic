import test from 'node:test';
import assert from 'node:assert/strict';
import {capacityMapData,renderedCapacityPoints,capacityMarkerOffsets} from '../src/map/capacity-clusters.ts';
import {parseCapacityPage} from '../src/api/public-capacity.ts';
import {focusedMarkers} from '../src/map/focused-markers.ts';
const row=(id,status,full,shared)=>({id,status,assigned_driver_first_name:'Driver',location_lat:9,location_lng:38,accepts_full_load:full,accepts_partial_load:shared});
test('overlapping Empty and Partial trucks are partitioned before clustering with honest accepted-load flags',()=>{
 const items=parseCapacityPage({hasMore:false,items:[row('full','EMPTY',true,false),row('shared','EMPTY',false,true),row('either','EMPTY',true,true),row('partial','PARTIAL',false,true),row('unknown','EMPTY'),row('off','OFF_DUTY',true,true)]}).items;
 assert.deepEqual(items.map(item=>item.acceptedLoads),['FTL','PTL','BOTH','PTL',null]);
 const groups=capacityMapData(items);
 assert.equal(groups.EMPTY.features.length,4);assert.equal(groups.PARTIAL.features.length,1);
 for(const status of ['EMPTY','PARTIAL'])assert.ok(groups[status].features.every(feature=>feature.properties.status===status));
 const hidden=parseCapacityPage({hasMore:false,items:[{...row('private','EMPTY',true,true),current_signal_geometry_visible:false}]}).items;
 assert.equal(capacityMapData(hidden).EMPTY.features.length,0);
});
test('source-local cluster IDs do not overwrite opposite-status counts or touch targets',()=>{
 const feature={type:'Feature',properties:{cluster:true,cluster_id:7,point_count:3},geometry:{type:'Point',coordinates:[38,9]}};
 const empty=renderedCapacityPoints([feature,feature],'EMPTY'),partial=renderedCapacityPoints([{...feature,properties:{...feature.properties,point_count:5}}],'PARTIAL');
 const visible=[...empty,...partial];assert.equal(visible.length,2);assert.notEqual(empty[0].key,partial[0].key);
 assert.deepEqual(visible.map(point=>[point.status,point.count]),[['EMPTY',3],['PARTIAL',5]]);
 const offsets=capacityMarkerOffsets(visible,8);assert.ok(Math.hypot(...offsets[empty[0].key].map((n,i)=>n-offsets[partial[0].key][i]))>=96);
 assert.deepEqual(offsets,capacityMarkerOffsets(visible.toReversed(),8));assert.deepEqual(feature.geometry.coordinates,[38,9]);
 assert.equal(focusedMarkers(visible,'selected',[38,9]).length,1);assert.equal(focusedMarkers(visible,'selected',[38,9])[0].cluster,null);
 assert.deepEqual(focusedMarkers(visible,undefined,null),visible);
});
test('malformed rendered features cannot fabricate counts, IDs or locations',()=>{
 const cluster={type:'Feature',properties:{cluster:true,cluster_id:0,point_count:2},geometry:{type:'Point',coordinates:[0,0]}};
 assert.equal(renderedCapacityPoints([cluster],'EMPTY')[0].cluster,0);
 for(const bad of [{...cluster,properties:{cluster:true,cluster_id:-1,point_count:2}},{...cluster,properties:{cluster:true,cluster_id:1,point_count:NaN}},{...cluster,geometry:{type:'Point',coordinates:[NaN,0]}},{...cluster,geometry:{type:'Point',coordinates:[181,0]}}])assert.deepEqual(renderedCapacityPoints([bad],'EMPTY'),[]);
});
