import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {publicFleetPage,loadPublicProviderFleet,publicFleetVehicleIds,publicFleetRowKey} from '../src/lib/public-provider-paging.js';
import {emptyTruckAuthority} from '../src/lib/provider-authority-contract.js';
const summary=total=>({total,ownershipVerified:0,operatingLicenceVerified:0,financedVerified:0,permissionVerified:0,notYetVerified:total});

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
  const id=randomUUID();const response={items:[],page:3,page_count:3,page_size:12,total:25,owner_operator:false,evidence:null,authority_summary:summary(25)};
  for(const kind of ['ORGANIZATION','PROVIDER_PROFILE']){
    let args;const client={rpc:async(name,input)=>{assert.equal(name,'public_provider_fleet_page');args=input;return {data:response,error:null};}};
    assert.deepEqual(await loadPublicProviderFleet(client,{id,kind},'999'),response);
    assert.deepEqual(args,{requested_organization_id:kind==='ORGANIZATION'?id:null,requested_provider_profile_id:kind==='PROVIDER_PROFILE'?id:null,requested_page:999});
  }
  assert.equal(await loadPublicProviderFleet({rpc:async()=>({data:null,error:null})},{id,kind:'ORGANIZATION'},1),null);
  await assert.rejects(loadPublicProviderFleet({rpc:async()=>({error:{message:'private internal detail'}})},{id,kind:'ORGANIZATION'},1),/SUPABASE_PUBLIC_PROVIDER_FLEET_FAILED/);
  await assert.rejects(loadPublicProviderFleet({rpc:async()=>({data:{...response,page_size:100},error:null})},{id,kind:'ORGANIZATION'},1));
});

test('public truck regular geometry exposes bounded labels while the provider retains no account route',async()=>{
  const {nativePublicProvider}=await import('../src/lib/mobile/public-contract.js');
  const route={geometry:'ROUTE',created_by:'private-user',route_points:[{label:'A',lat:9,lng:38,private_note:'secret'},{label:'B',lat:8,lng:39}],storage_path:'private-file',private_phone:'private-contact'};
  const area={geometry:'RADIUS',area_center_label:'Adama',area_boundary:Array.from({length:20},(_,i)=>({label:`Place ${i}`}))};
  const project=(page,signal)=>nativePublicProvider({regular_service:{geometry:'ROUTE',route_labels:['Retired account route']},fleet_page:{page,pageCount:3,total:30},trucks:[{capacity:{recurring_corridors:[signal]}}]});
  assert.deepEqual(project(1,route).trucks[0].regular,{kind:'ROUTE',places:['A','B']});
  assert.deepEqual(project(2,area).trucks[0].regular,{kind:'AREA',places:['Adama','Place 0','Place 1','Place 2','Place 3','Place 4']});
  assert.equal(project(1,route).regular,null);assert.equal(project(2,area).regular,null);
  for(const hidden of ['private-user','secret','private-file','private-contact','Retired account route','"lat"','"lng"'])assert.equal(JSON.stringify(project(1,route)).includes(hidden),false);
  assert.equal(project(1,{geometry:'ROUTE',route_points:[]}).trucks[0].regular,null);
});

test('valid legacy fleet rows and evidence may omit only the optional platform number',async()=>{
 const id=randomUUID(),response={items:[{id,platform_number:null,make:'Truck',model:'Example',category:'Light',cargo_configuration:null,assigned_driver_id:null,authority:emptyTruckAuthority()}],total:1,page:1,page_size:12,page_count:1,owner_operator:false,evidence:{vehicle_id:id,platform_number:null,document:null},authority_summary:summary(1)};
 const client=payload=>({rpc:async()=>({data:payload,error:null})});
 assert.deepEqual(await loadPublicProviderFleet(client(response),{id,kind:'PROVIDER_PROFILE'},1),response);
 for(const item of [{...response.items[0],platform_number:123},{...response.items[0],id:'invalid'},{...response.items[0],category:undefined}])await assert.rejects(loadPublicProviderFleet(client({...response,items:[item]}),{id,kind:'PROVIDER_PROFILE'},1));
 await assert.rejects(loadPublicProviderFleet(client({...response,items:Array(13).fill(response.items[0])}),{id,kind:'PROVIDER_PROFILE'},1));
});

test('presentation row keys keep missing numbers independent without inventing displayed numbers',()=>{
 assert.equal(publicFleetRowKey('LG-001',0),'number:LG-001');
 assert.notEqual(publicFleetRowKey(null,0),publicFleetRowKey(null,1));
 assert.equal(publicFleetRowKey('',12),publicFleetRowKey(null,12));
 assert.notEqual(publicFleetRowKey(null,0),publicFleetRowKey(null,12));
 assert.notEqual(publicFleetRowKey('row:0',1),publicFleetRowKey(null,0));
});
