import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {publicFleetPage,loadPublicProviderFleet,publicFleetVehicleIds} from '../src/lib/public-provider-paging.js';

test('public fleet page input is bounded integer syntax, including overflow and duplicate values',()=>{
  for(const value of [undefined,null,'',0,-1,'1.5','Infinity','2e3','0002','2147483648',['2','3']])assert.equal(publicFleetPage(value),1);
  assert.equal(publicFleetPage('9'),9);assert.equal(publicFleetPage('2147483647'),2147483647);
});
test('internal fleet vehicle scope keeps empty pages empty and rejects malformed or oversized lists',()=>{
  assert.deepEqual(publicFleetVehicleIds([]),[]);
  const ids=Array.from({length:12},randomUUID);assert.deepEqual(publicFleetVehicleIds(ids),ids);
  for(const value of [null,'',{},['invalid'],[...ids,randomUUID()]])assert.throws(()=>publicFleetVehicleIds(value));
});
test('fleet adapter scopes both provider types, preserves server clamping and fails closed',async()=>{
  const id=randomUUID();const response={items:[],page:3,page_count:3,page_size:12,total:25,owner_operator:false,evidence:null};
  for(const kind of ['ORGANIZATION','PROVIDER_PROFILE']){
    let args;const client={rpc:async(name,input)=>{assert.equal(name,'public_provider_fleet_page');args=input;return {data:response,error:null};}};
    assert.deepEqual(await loadPublicProviderFleet(client,{id,kind},'999'),response);
    assert.deepEqual(args,{requested_organization_id:kind==='ORGANIZATION'?id:null,requested_provider_profile_id:kind==='PROVIDER_PROFILE'?id:null,requested_page:999});
  }
  assert.equal(await loadPublicProviderFleet({rpc:async()=>({data:null,error:null})},{id,kind:'ORGANIZATION'},1),null);
  await assert.rejects(loadPublicProviderFleet({rpc:async()=>({error:{message:'private internal detail'}})},{id,kind:'ORGANIZATION'},1),/SUPABASE_PUBLIC_PROVIDER_FLEET_FAILED/);
  await assert.rejects(loadPublicProviderFleet({rpc:async()=>({data:{...response,page_size:100},error:null})},{id,kind:'ORGANIZATION'},1));
});

test('provider regular service exposes only bounded place labels, independent of truck pages',async()=>{
  const {publicProviderRegularService}=await import('../src/lib/public-provider-paging.js');
  const projection=publicProviderRegularService({geometry:'ROUTE',origin:'A',destination:'B',created_by:'private-user',
    route_points_json:[{label:'A',lat:9,lng:38,private_note:'secret'},{label:'B',lat:8,lng:39}],
    storage_path:'private-file',private_phone:'private-contact'});
  assert.deepEqual(projection,{geometry:'ROUTE',route_labels:['A','B'],area_center_label:'',area_labels:[]});
  const area=publicProviderRegularService({geometry:'RADIUS',area_center_label:'Adama',area_boundary_json:Array.from({length:20},(_,i)=>({label:`Place ${i}`}))});
  assert.equal(area.area_labels.length,5);assert.equal(area.area_center_label,'Adama');
  assert.deepEqual(publicProviderRegularService({origin:'A',destination:'B'}).route_labels,['A','B']);
  assert.equal(publicProviderRegularService(null),null);
});
