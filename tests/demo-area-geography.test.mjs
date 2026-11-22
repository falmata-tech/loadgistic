import test from 'node:test';
import assert from 'node:assert/strict';
import {DEMO_BASES,DEMO_PLACES,demoCurrentRouteForLocation,demoServiceAreaForLocation} from '../src/lib/demo-capacity-geography.js';
import {distanceBetweenKm} from '../src/lib/domain.js';
import {serviceAreaGeometryMatch} from '../src/lib/route-matching.js';

const configurations=['Courier car','Cargo van','Pickup truck','Mini Open Body Truck',
  'Light Box Truck','Medium Box Truck','Heavy Rigid Stake Body Truck','Tractor + Container Trailer'];
const known=new Set(Object.values(DEMO_PLACES));

test('every qualified demo Area has real surrounding settlements and a strictly enclosed center',()=>{
  let qualified=0;
  for(const [key,base] of Object.entries(DEMO_BASES))for(const index of [0,1]){
    const record={id:`area:${key}`,location_place_ref:base.place_ref,location_lat:base.lat,location_lng:base.lng};
    const area=demoServiceAreaForLocation(record,index);
    if(key==='moyale'){assert.equal(area,null);continue;}
    assert.ok(area,key);qualified++;
    assert.ok(area.boundary.length>=3&&area.boundary.length<=5,key);
    assert.equal(new Set(area.boundary.map(point=>point.place_ref)).size,area.boundary.length,key);
    assert.ok(area.boundary.every(point=>known.has(point)&&point.place_ref!==area.center.place_ref),key);
    assert.ok(area.boundary.every(point=>!['chamuk','burji moyale'].includes(point.key)),key);
    const match=serviceAreaGeometryMatch(area.center,area.boundary,{searchRadiusKm:0});
    assert.equal(match.inside,true,key);assert.ok(match.distance_km>0.000001,key);
    assert.ok(Number.isFinite(area.radiusKm)&&area.boundary.every(point=>distanceBetweenKm(area.center,point)<=area.radiusKm),key);
    for(const cargo_configuration of configurations){
      assert.deepEqual(demoServiceAreaForLocation({...record,cargo_configuration},index),area,`${key}/${cargo_configuration}`);
    }
  }
  assert.equal(qualified,28);
});

test('a base without surrounding verified towns gets a Route example without fabricated Area geometry',()=>{
  const record={id:'moyale-without-ring',location_place_ref:DEMO_PLACES.moyale.place_ref};
  for(const cargo_configuration of configurations)for(const index of [0,1]){
    assert.equal(demoServiceAreaForLocation({...record,cargo_configuration},index),null);
    const route=demoCurrentRouteForLocation({...record,cargo_configuration},index);
    assert.ok(route.points.length>=2);
    assert.ok(route.points.every(point=>known.has(point)&&!['chamuk','burji moyale'].includes(point.key)));
  }
});

test('a returned Area boundary cannot mutate the next generated example',()=>{
  const record={id:'area-copy',location_place_ref:DEMO_PLACES.addis.place_ref};
  const expected=demoServiceAreaForLocation(record),changed=demoServiceAreaForLocation(record);
  changed.boundary.pop();
  assert.deepEqual(demoServiceAreaForLocation(record),expected);
});
