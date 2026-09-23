import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveCapacityFilterPlaces,resolveCapacityFilterPlace} from '../src/lib/capacity-filter-places.js';

function catalog(result){
  const calls=[];
  const query={select(){return this;},eq(...args){calls.push(args);return this;},order(){return this;},limit(){return this;},async maybeSingle(){return result;}};
  return {calls,from(){return query;}};
}
test('omitted location is neutral but unknown names and references cannot broaden queries',async()=>{
  const client=catalog({data:null,error:null});
  assert.equal(await resolveCapacityFilterPlace(client,'',''),null);
  assert.equal(client.calls.length,0);
  for(const filters of [{origin:'unknown'},{destinationPlaceRef:'missing'},{currentArea:'x'},{truckCityPlaceRef:'missing'},{truckCity:'unknown'}]){
    const result=await resolveCapacityFilterPlaces(client,filters);
    assert.equal(result.places.length,0);assert.match(result.filterError,/Choose a suggested place/);
  }
  client.calls.length=0;
  await assert.rejects(resolveCapacityFilterPlace(client,'missing','Addis Ababa'),/INVALID_CAPACITY_PLACE/);
  assert.deepEqual(client.calls,[['id','missing']]);
});
test('valid catalog locations resolve and provider failures remain infrastructure errors',async()=>{
  const data={id:'city',name:'Adama',country_name:'Ethiopia',latitude:8.54,longitude:39.27};
  const result=await resolveCapacityFilterPlaces(catalog({data,error:null}),{originPlaceRef:'city'});
  assert.equal(result.filterError,null);assert.equal(result.places[0].center_lat,8.54);
  assert.equal(result.places[1],null);
  await assert.rejects(resolveCapacityFilterPlaces(catalog({data:null,error:{message:'network'}}),{origin:'Adama'}),/SUPABASE_PLACE_LOOKUP_FAILED/);
});


test('truck city resolves independently of service area and does not trust client coordinates',async()=>{
  const data={id:'city',name:'Adama',country_name:'Ethiopia',latitude:8.54,longitude:39.27};
  const client=catalog({data,error:null});
  const result=await resolveCapacityFilterPlaces(client,{truckCityPlaceRef:'city',nearLat:'14',nearLng:'48'});
  assert.equal(result.filterError,null);
  assert.equal(result.places[2],null);
  assert.equal(result.places[3].center_lat,8.54);
  assert.deepEqual(client.calls,[['id','city']]);
});
