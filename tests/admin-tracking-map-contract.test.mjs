import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {z} from 'zod';
import * as trackingMap from '../src/lib/tracking-map.js';
import {trackingRecoveryActions,statusLabel} from '../src/lib/domain.js';
import {canManageProviderFleet} from '../src/lib/fleet.js';

const actor={id:'00000000-0000-4000-8000-000000000001',role:'SUPPORT',can_manage_operations:true};
const shipmentId='00000000-0000-4000-8000-000000000002';
const routeColumns=['origin_place_ref','origin','origin_lat','origin_lng','passing_place_ref','passing','passing_lat','passing_lng','destination_place_ref','destination','destination_lat','destination_lng','tracking_mode'];
const savedRoute={origin_place_ref:'saved-pickup',origin:'Saved pickup',origin_lat:8.5,origin_lng:39.2,passing_place_ref:'saved-via',passing:'Saved via',passing_lat:9,passing_lng:40.1,destination_place_ref:'saved-delivery',destination:'Saved delivery',destination_lat:9.6,destination_lng:41.9,tracking_mode:'LOCATION_AND_STATUS'};
const location={location_area:'Reported area',location_lat:9.3,location_lng:40.4,location_precision_km:20,updated_at:'2026-10-14T12:00:00Z'};
const authorized={operational_status:'TO_PICKUP',origin:'Saved pickup',origin_lat:8.5,origin_lng:39.2,destination:'Saved delivery',destination_lat:9.6,destination_lng:41.9,current_location:location};
const element=(type,props)=>({type,props:props||{}});
function load(file,imports){
 const source=readFileSync(new URL('../'+file,import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const exports={};new Function('require','exports',compiled)(name=>{assert.ok(name in imports,'Unexpected import '+name);return imports[name];},exports);return exports;
}
const mapData=load('src/components/tracking-map-data.ts',{'@/lib/tracking-map.js':trackingMap}).trackingMapData;
function adapter({gates=[{data:authorized,error:null},{data:authorized,error:null}],row={data:savedRoute,error:null}}={}){
 const calls=[];let gateIndex=0;
 const client={
  rpc:async(name,args)=>{calls.push({kind:'rpc',name,args});assert.equal(name,'admin_tracking_location');return gates[gateIndex++]||{data:null,error:null};},
  from:table=>{
   calls.push({kind:'table',table});
   return{select:columns=>{
    calls.push({kind:'select',columns});
    return{eq:(column,value)=>{
     calls.push({kind:'scope',column,value});
     return{maybeSingle:async()=>{calls.push({kind:'row'});return row;}};
    }};
   }};
  }
 };
 const module=load('src/lib/lifecycle.js',{'zod':{z},'./supabase-adapter.js':{createSupabaseAdminClient:()=>client},'./domain.js':{trackingRecoveryActions},'./fleet.js':{canManageProviderFleet}});
 return{calls,read:()=>module.adminTrackingLocation(actor,shipmentId)};
}
test('admin map initial denial or absent eligible location never reads a shipment table',async()=>{
 for(const gate of [{data:null,error:null},{data:null,error:{message:'FORBIDDEN'}}]){
  const current=adapter({gates:[gate]});
  if(gate.error)await assert.rejects(current.read(),/FORBIDDEN/);else assert.equal(await current.read(),null);
  assert.deepEqual(current.calls,[{kind:'rpc',name:'admin_tracking_location',args:{actor_user_id:actor.id,target_shipment_id:shipmentId}}]);
 }
});
test('admin map reads only exact saved route columns between actual actor authority checks',async()=>{
 const current=adapter(),data=await current.read();
 assert.deepEqual(current.calls,[
  {kind:'rpc',name:'admin_tracking_location',args:{actor_user_id:actor.id,target_shipment_id:shipmentId}},
  {kind:'table',table:'provider_shipments'},{kind:'select',columns:routeColumns.join(',')},
  {kind:'scope',column:'id',value:shipmentId},{kind:'row'},
  {kind:'rpc',name:'admin_tracking_location',args:{actor_user_id:actor.id,target_shipment_id:shipmentId}}
 ]);
 const projected=mapData(data);
 assert.deepEqual(projected.route,[{placeRef:'saved-pickup',label:'Saved pickup',coordinate:[39.2,8.5]},{placeRef:'saved-via',label:'Saved via',coordinate:[40.1,9]},{placeRef:'saved-delivery',label:'Saved delivery',coordinate:[41.9,9.6]}]);
 assert.deepEqual(projected.location,{coordinate:[40.4,9.3],radiusKm:20,label:'Reported area',updatedAt:'2026-10-14T12:00:00Z'});
 assert.equal(projected.truck,null);assert.equal(projected.status,'TO_PICKUP');assert.equal(projected.trackingMode,'LOCATION_AND_STATUS');
});
test('admin map final authority denial or location reset never returns an earlier location',async()=>{
 for(const gate of [{data:null,error:null},{data:null,error:{message:'FORBIDDEN'}}]){
  const current=adapter({gates:[{data:authorized,error:null},gate]});
  if(gate.error)await assert.rejects(current.read(),/FORBIDDEN/);else assert.equal(await current.read(),null);
  assert.equal(current.calls.filter(call=>call.kind==='rpc').length,2);assert.equal(current.calls.filter(call=>call.kind==='table').length,1);
 }
});
test('admin map uses only the second authorized status and reported location',async()=>{
 const currentLocation={...location,location_lat:10.1,location_lng:42.2,location_precision_km:5,updated_at:'2026-10-14T12:05:00Z'};
 const current=adapter({gates:[{data:authorized,error:null},{data:{...authorized,operational_status:'IN_TRANSIT',current_location:currentLocation},error:null}]});
 const data=mapData(await current.read());assert.equal(data.status,'IN_TRANSIT');
 assert.deepEqual(data.location,{coordinate:[42.2,10.1],radiusKm:5,label:'Reported area',updatedAt:'2026-10-14T12:05:00Z'});
});
test('admin map missing or failed route reads fail closed and malformed routes invent no city or coordinate',async()=>{
 const absent=adapter({row:{data:null,error:null}});assert.equal(await absent.read(),null);
 const failed=adapter({row:{data:null,error:{message:'PRIVATE_DATABASE_DETAIL'}}});await assert.rejects(failed.read(),error=>error.message==='LIFECYCLE_OPERATION_FAILED');
 for(const row of [{...savedRoute,origin_place_ref:null},{...savedRoute,passing_lat:null},{...savedRoute,destination_lng:999}]){
  assert.deepEqual(mapData(await adapter({row:{data:row,error:null}}).read()).route,[]);
 }
 const legacy={...savedRoute,passing_place_ref:null,passing:null,passing_lat:null,passing_lng:null};
 assert.equal(mapData(await adapter({row:{data:legacy,error:null}}).read()).route.length,2);
});
test('admin map allowlists route and obscured-location data without forwarding private or fabricated truck fields',async()=>{
 const forbidden={customer_email:'PRIVATE_CONTACT_SENTINEL',storage_path:'PRIVATE_FILE_SENTINEL',tracking_token:'PRIVATE_TOKEN_SENTINEL',device_lat:1.234567,device_lng:2.345678,public_truck_summary:{driverName:'PRIVATE_NAME_SENTINEL'}};
 const gate={data:{...authorized,...forbidden,current_location:{...location,...forbidden}},error:null};
 const current=adapter({gates:[gate,gate],row:{data:{...savedRoute,...forbidden},error:null}}),data=await current.read();
 assert.deepEqual(Object.keys(data).sort(),[...routeColumns,'operational_status','current_location'].sort());
 assert.deepEqual(Object.keys(data.current_location).sort(),Object.keys(location).sort());
 const rendered=JSON.stringify(mapData(data));for(const sentinel of ['PRIVATE_CONTACT_SENTINEL','PRIVATE_FILE_SENTINEL','PRIVATE_TOKEN_SENTINEL','PRIVATE_NAME_SENTINEL'])assert.equal(rendered.includes(sentinel),false);
 assert.equal(mapData(data).truck,null);
});

const nodes=tree=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):[tree,...nodes(tree.props?.children)];
function page(data){
 const simple=new Proxy({},{get:(_target,key)=>key});
 const record={id:shipmentId,view:'TRACKING',code:'SYNTHETIC-TRACKING',operational_status:'TO_PICKUP',origin:'Saved pickup',destination:'Saved delivery',events:[{id:'synthetic-event',status:'TO_PICKUP',note:'Saved event',created_at:location.updated_at}]};
 return load('src/app/admin/operations/[view]/[id]/page.tsx',{
  'react/jsx-runtime':{jsx:element,jsxs:element},'next/link':{__esModule:true,default:'Link'},'lucide-react':simple,
  'next/navigation':{redirect:()=>{throw Error('DENIED');},notFound:()=>{throw Error('MISSING');}},
  '@/app/admin/admin-presentation.module.css':{__esModule:true,default:simple},'@/components/localization':{Text:'Text'},
  '@/components/page-header':{PageHeader:'Header'},'@/components/flash':{Flash:'Flash'},'@/components/status-pill':{StatusPill:'Status'},'@/components/workspace-task-dialog':{WorkspaceTaskDialog:'TaskDialog'},
  '@/components/lifecycle-controls':{TrackingRecoveryControls:'Recovery'},'@/components/tracking-location-map':{TrackingLocationMap:'TrackingMap'},
  '@/components/tracking-proof-link':{TrackingProofLink:'Proof'},'@/components/tracking-map-data':{trackingMapData:mapData},
  '@/components/admin-record-documents':{AdminRecordDocuments:'RecordDocuments'},'@/components/admin-account-overview':{AdminAccountOverviewView:'AccountOverview'},
  '@/lib/platform-admin/account':{getAdminAccountOverview:async()=>null,getAdminRecordDocuments:async()=>null},'@/lib/admin-account-navigation.js':{adminAccountReturnPath:()=>null},
  '@/lib/auth':{requireUser:async()=>actor},'@/lib/ui':{displayStatus:statusLabel},
  '@/lib/platform-admin.js':{hasPlatformPermission:()=>true,PLATFORM_PERMISSIONS:{OPERATIONS:'OPERATIONS'},getAdminOperationRecord:async()=>record},
  '@/lib/lifecycle.js':{getTrackingRecovery:async()=>({actions:[]}),adminTrackingLocation:async()=>data},'@/lib/provider-tracking.js':{listProviderTrackingAppeals:async()=>[]}
 }).default;
}
test('actual Operations page converts the adapter projection before giving it to the shared map',async()=>{
 const data={...savedRoute,...authorized},render=page(data),tree=await render({params:Promise.resolve({view:'tracking',id:shipmentId}),searchParams:Promise.resolve({})});
 const map=nodes(tree).find(node=>node.type==='TrackingMap');assert.ok(map);assert.deepEqual(map.props.shipment,mapData(data));assert.equal(map.props.shipment.route.length,3);assert.equal(map.props.shipment.truck,null);
 const absent=await page(null)({params:Promise.resolve({view:'tracking',id:shipmentId}),searchParams:Promise.resolve({})});assert.equal(nodes(absent).some(node=>node.type==='TrackingMap'),false);
});
