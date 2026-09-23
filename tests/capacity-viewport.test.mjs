import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCapacityViewport,retainMapTrucks,capacityDatabaseFilters,MAX_MAP_TRUCKS} from '../src/lib/capacity-viewport.js';
test('viewport rejects incomplete, reversed and non-finite bounds without broadening',()=>{
 assert.deepEqual(parseCapacityViewport('38,8,40,10'),[38,8,40,10]);
 assert.equal(parseCapacityViewport(''),null);
 for(const value of ['38,,40,10','38,8,40','40,8,38,10','38,10,40,8','38,8,Infinity,10','-181,8,40,10',[null,8,40,10]])assert.throws(()=>parseCapacityViewport(value));
});
test('map retention stays bounded across pages and preserves selected truck once',()=>{
 let items=[];
 for(let page=0;page<50;page++)items=retainMapTrucks(items,Array.from({length:14},(_,i)=>({id:String(page*14+i)})),'0');
 assert.equal(items.length,MAX_MAP_TRUCKS);assert.equal(items[0].id,'0');assert.equal(new Set(items.map(row=>row.id)).size,MAX_MAP_TRUCKS);
 items=retainMapTrucks(items,[{id:'new'},{id:'0',updated:true}],'0',{replace:true});
 assert.deepEqual(items,[{id:'0',updated:true},{id:'new'}]);
 assert.deepEqual(retainMapTrucks(items,[],'missing',{replace:true}),[]);
 assert.deepEqual(retainMapTrucks(items,[{id:'next'}],'0',{limit:1}),[{id:'0',updated:true}]);
});
test('database query keeps combined criteria, resolved coordinates and absent proximity independent',()=>{
 const filters=capacityDatabaseFilters({originRadiusKm:25,destinationRadiusKm:100,currentAreaRadiusKm:50,geometry:'ROUTE',directionMode:'EITHER',nearLat:'',nearLng:'',viewport:'38,8,40,10'},[{center_lat:9,center_lng:38},{center_lat:10,center_lng:39},{center_lat:8,center_lng:40}]);
 assert.equal(filters.origin_lat,9);assert.equal(filters.destination_lat,10);assert.equal(filters.area_lat,8);assert.equal(filters.geometry,'ROUTE');assert.equal(filters.direction_mode,'EITHER');assert.equal(filters.near_lat,null);
 assert.deepEqual(filters.viewport,[38,8,40,10]);assert.equal(filters.destination_radius_km,100);
 assert.throws(()=>capacityDatabaseFilters({viewport:'38,8'}));
});


test('truck city filters reported location independently, taking precedence over device proximity',()=>{
 const places=[null,null,{center_lat:10,center_lng:40},{center_lat:8.54,center_lng:39.27}];
 const query=capacityDatabaseFilters({truckLocationRadiusKm:25,nearLat:14,nearLng:48,nearRadiusKm:5},places);
 assert.equal(query.near_lat,8.54);assert.equal(query.near_lng,39.27);assert.equal(query.near_radius_km,25);
 assert.equal(query.area_lat,10);assert.equal(query.geometry,null);
 assert.equal(capacityDatabaseFilters({truckLocationRadiusKm:999},places).near_radius_km,50);
});
