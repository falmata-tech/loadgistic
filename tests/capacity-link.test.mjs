import test from 'node:test';
import assert from 'node:assert/strict';
import {currentCapacityLinkFilters} from '../src/lib/capacity-link.js';
const old='11111111-1111-4111-8111-111111111111',vehicle='22222222-2222-4222-8222-222222222222',fresh='33333333-3333-4333-8333-333333333333';
function client(results){const calls=[];return {calls,from(table){const call={table,operations:[]};calls.push(call);const query={};for(const name of ['select','eq','order','limit'])query[name]=(...args)=>{call.operations.push([name,...args]);return query;};query.maybeSingle=async()=>results.shift();return query;}};}
test('ordinary discovery makes no identity queries; malformed IDs retain existing validation',async()=>{
 const db=client([]);for(const filters of [{status:'EMPTY'},{truck:'invalid'}])assert.equal(await currentCapacityLinkFilters(db,filters),filters);assert.deepEqual(db.calls,[]);
});
test('a historical link resolves only the same vehicle and preserves every other filter',async()=>{
 const db=client([{data:{vehicle_id:vehicle}},{data:{id:fresh}}]);
 const filters={truck:old,status:'PARTIAL',provider:'fixture',viewport:'1,2,3,4',ownerDocs:'IDENTITY'};
 assert.deepEqual(await currentCapacityLinkFilters(db,filters),{...filters,capacityId:fresh});assert.equal(filters.capacityId,undefined);
 assert.deepEqual(db.calls[0].operations,[['select','vehicle_id'],['eq','id',old]]);
 assert.deepEqual(db.calls[1].operations,[['select','id'],['eq','vehicle_id',vehicle],['order','updated_at',{ascending:false}],['order','id',{ascending:false}],['limit',1]]);
});
test('missing historical/current rows retain a restrictive ID instead of widening discovery',async()=>{
 for(const results of [[{data:null}],[{data:{vehicle_id:null}}],[{data:{vehicle_id:vehicle}},{data:null}]]){
  const filters={truck:old};assert.equal(await currentCapacityLinkFilters(client(results),filters),filters);
 }
});
test('identity read failures stop before any unfiltered projection',async()=>{
 for(const results of [[{error:{message:'private database details'}}],[{data:{vehicle_id:vehicle}},{error:{message:'private database details'}}]])await assert.rejects(currentCapacityLinkFilters(client(results),{truck:old}),error=>error.message==='CAPACITY_LINK_UNAVAILABLE');
});
