import test from 'node:test';
import assert from 'node:assert/strict';
import {loadFeaturedTruckCandidates,readFeaturedRows} from '../src/lib/featured-truck-candidates.js';

function fixture(count, failTable='') {
  const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
  const vehicles=Array.from({length:count},(_,i)=>({id:uuid(i+1),provider_profile_id:'owner',active:true,
    cargo_configuration:'Pickup truck',platform_number:String(i).padStart(6,'0')}));
  const assignments=vehicles.map((vehicle,i)=>({vehicle_id:vehicle.id,driver_user_id:uuid(count+i+1)}));
  const tables={vehicles,assignments,profiles:assignments.map(a=>({id:a.driver_user_id,active:true,full_name:'Demo Driver'})),
    drivers:[],driver_portrait_uploads:[],capacities:vehicles.flatMap((vehicle,i)=>[
      ...Array.from({length:i===0?1100:0},(_,n)=>({id:uuid(100000+n),vehicle_id:vehicle.id,
        visibility:'OPEN',market_status:'EMPTY',updated_at:`2020-${String(n).padStart(5,'0')}`})),
      {id:uuid(200000+i),vehicle_id:vehicle.id,visibility:i===0?'PRIVATE':'OPEN',market_status:'EMPTY',updated_at:'2026-10-11'},
    ])};
  const requests=[];
  function query(table) {
    let rows=tables[table],start=0,end=999;
    const orders=[];
    const q={select(){return q;},eq(key,value){rows=rows.filter(row=>row[key]===value);return q;},
      in(key,ids){requests.push({table,ids:ids.length});if(ids.length>100)throw Error('URI_TOO_LONG');rows=rows.filter(row=>ids.includes(row[key]));return q;},
      order(key,options={}){orders.push([key,options.ascending!==false]);return q;},
      range(from,to){start=from;end=to;return q;},
      then(resolve,reject){
        const sorted=[...rows].sort((a,b)=>{for(const [key,asc]of orders){const diff=String(a[key]).localeCompare(String(b[key]));if(diff)return asc?diff:-diff;}return 0;});
        return Promise.resolve({data:table===failTable?null:sorted.slice(start,end+1),error:table===failTable?{code:'SERVICE_FAILURE'}:null}).then(resolve,reject);
      }};return q;
  }
  return {client:{from:query,rpc(){return query('assignments');}},requests,
    providers:[{provider_profile_id:'owner',eligible:true,provider_kind:'INDEPENDENT_DRIVER'}]};
}

test('Featured reads all candidates beyond gateway and row limits and uses their latest capacity',async()=>{
  const f=fixture(1105),rows=await loadFeaturedTruckCandidates(f.client,'2026-10-11',f.providers);
  assert.equal(rows.length,1105);
  assert.ok(f.requests.every(request=>request.ids<=100));
  assert.equal(rows[0].public_capacity_available,false,'older public capacity must not replace newer private capacity');
  assert.ok(rows.slice(1).every(row=>row.public_capacity_available));
  assert.equal(new Set(rows.map(row=>row.vehicle_id)).size,1105);
});
test('a failed Featured batch cannot produce a partial roster',async()=>{
  for(const table of ['vehicles','assignments','capacities','profiles','drivers','driver_portrait_uploads']){
    const f=fixture(236,table);
    await assert.rejects(loadFeaturedTruckCandidates(f.client,'2026-10-11',f.providers),/SUPABASE_FEATURED_/);
  }
});
test('public provider RPC rows are not truncated before exact saved trucks are joined',async()=>{
 const rows=Array.from({length:1105},(_,i)=>({handle:`provider-${i}`})),ranges=[];
 const result=await readFeaturedRows(()=>({range:async(from,to)=>{ranges.push([from,to]);return {data:rows.slice(from,to+1),error:null};}}),'SUPABASE_PUBLIC_FEATURED_FAILED');
 assert.deepEqual(result,rows);assert.equal(ranges.length,3);
});
