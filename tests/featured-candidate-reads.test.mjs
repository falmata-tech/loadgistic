import test from 'node:test';
import assert from 'node:assert/strict';
import {loadFeaturedTruckCandidates,readFeaturedRows} from '../src/lib/featured-truck-candidates.js';

function fixture(count, failTable='') {
  const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
  const vehicles=Array.from({length:count},(_,i)=>({id:uuid(i+1),provider_profile_id:'owner',active:true,
    cargo_configuration:'Pickup truck',platform_number:String(i).padStart(6,'0')}));
  const assignments=vehicles.map((vehicle,i)=>({vehicle_id:vehicle.id,driver_user_id:uuid(count+i+1)}));
  const tables={vehicles,assignments,profiles:assignments.map(a=>({id:a.driver_user_id,active:true,full_name:'Demo Driver'})),
    identities:assignments.map(a=>({id:a.driver_user_id,first_name:'Demo Compound',portrait_url:null,callback_phone:null})),
    drivers:[],driver_portrait_uploads:[],regular_signals:[],capacities:vehicles.flatMap((vehicle,i)=>[
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
  return {client:{from:query,rpc(name,input){return name==='featured_truck_regular_signals'?query('regular_signals').in('vehicle_id',input.requested_vehicle_ids):name==='public_person_identities'?query('identities').in('id',input.requested_user_ids):query('assignments');}},requests,tables,
    providers:[{provider_profile_id:'owner',eligible:true,provider_kind:'INDEPENDENT_DRIVER'}]};
}

test('restored courier types join Tuesday only with authoritative current driver links and eligible provider',async()=>{
 const f=fixture(5),types=['Courier car','Courier motorcycle','Cargo van','Courier car','Courier motorcycle'];
 f.tables.vehicles.forEach((vehicle,index)=>{vehicle.cargo_configuration=types[index];});
 f.tables.assignments=f.tables.assignments.filter(link=>link.vehicle_id!==f.tables.vehicles[3].id);
 f.tables.vehicles[4].active=false;
 const rows=await loadFeaturedTruckCandidates(f.client,'2026-10-20',f.providers);
 assert.deepEqual(rows.map(row=>row.cargo_configuration),types.slice(0,3));
 assert.equal(rows.length,3);assert.ok(rows.every(row=>row.driver_user_id));
 f.providers[0].eligible=false;
 assert.deepEqual(await loadFeaturedTruckCandidates(f.client,'2026-10-20',f.providers),[]);
});

test('Featured reads all candidates beyond gateway and row limits and uses their latest capacity',async()=>{
  const f=fixture(1105),rows=await loadFeaturedTruckCandidates(f.client,'2026-10-11',f.providers);
  assert.equal(rows.length,1105);
  assert.ok(f.requests.every(request=>request.ids<=100));
  assert.equal(rows[0].public_capacity_available,false,'older public capacity must not replace newer private capacity');
  assert.ok(rows.slice(1).every(row=>row.public_capacity_available));
  assert.equal(new Set(rows.map(row=>row.vehicle_id)).size,1105);
  assert.equal(rows[0].driver_first_name,'Demo Compound');
  assert.equal(f.requests.some(request=>['profiles','driver_portrait_uploads','drivers'].includes(request.table)),false,'Safe identity and eligible-link commands replace private identity and employee-row reads');
});
test('a failed Featured batch cannot produce a partial roster',async()=>{
  for(const table of ['vehicles','assignments','capacities','identities']){
    const f=fixture(236,table);
    await assert.rejects(loadFeaturedTruckCandidates(f.client,'2026-10-11',f.providers),/SUPABASE_FEATURED_/);
  }
});
test('Featured includes eligible organization owners who drive without an employee-directory row',async()=>{
 const f=fixture(1),vehicle=f.tables.vehicles[0];vehicle.organization_id='company';vehicle.provider_profile_id=null;f.providers=[{provider_organization_id:'company',eligible:true,provider_kind:'FLEET_TRANSPORTER',provider_kind_label:'Transport Provider'}];
 const rows=await loadFeaturedTruckCandidates(f.client,'2026-10-11',f.providers);assert.equal(f.tables.drivers.length,0);assert.equal(rows.length,1);assert.equal(rows[0].driver_user_id,f.tables.assignments[0].driver_user_id);assert.equal(rows[0].driver_kind_label,'Driver');assert.equal(rows[0].provider_kind_label,'Transport Provider');
});
test('Featured gives employees of personal providers the same neutral driver label',async()=>{
 const f=fixture(1);f.providers[0].provider_kind='SELF_MANAGED_DRIVER';f.providers[0].provider_kind_label='Transport Provider';f.tables.drivers=[{user_id:f.tables.assignments[0].driver_user_id,active:true}];
 const rows=await loadFeaturedTruckCandidates(f.client,'2026-10-11',f.providers);assert.equal(rows.length,1);assert.equal(rows[0].driver_kind_label,'Driver');assert.equal(rows[0].provider_kind_label,'Transport Provider');
});
test('a directory row cannot restore missing eligible links, safe identities or an ineligible provider',async()=>{
 for(const missing of ['link','identity','provider','provider-scope']){
  const f=fixture(1);f.tables.drivers=[{user_id:f.tables.assignments[0].driver_user_id,active:true}];
  if(missing==='link')f.tables.assignments=[];if(missing==='identity')f.tables.identities=[];if(missing==='provider')f.providers[0].eligible=false;if(missing==='provider-scope')f.providers[0].provider_profile_id='another-owner';
  assert.deepEqual(await loadFeaturedTruckCandidates(f.client,'2026-10-11',f.providers),[],missing);
 }
});
test('public provider RPC rows are not truncated before exact saved trucks are joined',async()=>{
 const rows=Array.from({length:1105},(_,i)=>({handle:`provider-${i}`})),ranges=[];
 const result=await readFeaturedRows(()=>({range:async(from,to)=>{ranges.push([from,to]);return {data:rows.slice(from,to+1),error:null};}}),'SUPABASE_PUBLIC_FEATURED_FAILED');
 assert.deepEqual(result,rows);assert.equal(ranges.length,3);
});
test('Featured route facts come from each exact assigned truck rather than provider inheritance',async()=>{
 const f=fixture(2);f.providers[0].services='RETIRED-SERVICE';f.providers[0].regular_signal={geometry:'ROUTE',route_points:[{label:'RETIRED-PROVIDER-ROUTE'}]};f.providers[0].corridors=['RETIRED-PROVIDER-ROUTE'];
 const signal=(vehicle,driver,labels)=>({vehicle_id:vehicle,driver_user_id:driver,regular_signal:{id:'private-route-id',geometry:'ROUTE',route_points:labels.map(label=>({label,lat:9,lng:38}))}});
 const first=signal(f.tables.vehicles[0].id,f.tables.assignments[0].driver_user_id,['First A','First B']),second=signal(f.tables.vehicles[1].id,f.tables.assignments[1].driver_user_id,['Second A','Second B']);
 f.tables.regular_signals=[first,second];
 const rows=await loadFeaturedTruckCandidates(f.client,'2026-10-11',f.providers);
 assert.deepEqual(rows[0].corridors,['First A ↔ First B']);assert.deepEqual(rows[1].corridors,['Second A ↔ Second B']);
 for(const hidden of ['RETIRED-','Legacy A','Stale A'])assert.equal(JSON.stringify(rows).includes(hidden),false);
 assert.ok(f.requests.filter(request=>request.table==='regular_signals').every(request=>request.ids<=100));
 f.tables.regular_signals=[second];const privateRows=await loadFeaturedTruckCandidates(f.client,'2026-10-11',f.providers);assert.deepEqual(privateRows[0].corridors,[],'Public helper omits private/off-duty pair geometry without removing its showcase identity');assert.equal(privateRows.length,2);
 f.tables.regular_signals=[{...first,driver_user_id:f.tables.assignments[1].driver_user_id},second];const changed=await loadFeaturedTruckCandidates(f.client,'2026-10-11',f.providers);assert.deepEqual(changed[0].corridors,[],'A projection from a newer assignment must not attach to the previous snapshot');
 assert.equal(JSON.stringify(rows[0].regular_signal).includes('private-route-id'),false);assert.equal(JSON.stringify(rows[0].regular_signal).includes('"lat"'),false);
 const failed=fixture(2,'regular_signals');await assert.rejects(loadFeaturedTruckCandidates(failed.client,'2026-10-11',failed.providers),/SUPABASE_FEATURED_REGULAR/);
});
