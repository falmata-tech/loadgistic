import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as locationSource from '../src/lib/location-source.js';
import * as trackingMap from '../src/lib/tracking-map.js';
import * as demoTrackingIdentity from '../src/lib/demo-tracking-identity.js';
import * as trackingRefresh from '../src/lib/tracking-refresh-revision.js';

function load(file,imports){
 const compiled=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,exports={};
 new Function('require','exports',compiled)(name=>{assert.ok(name in imports,name);return imports[name];},exports);return exports;
}
const {trackingMapData}=load('src/components/tracking-map-data.ts',{'@/lib/tracking-map.js':trackingMap});
const node=(type,props)=>({type,props:props||{}});
const nodes=value=>!value||typeof value!=='object'?[]:Array.isArray(value)?value.flatMap(nodes):[value,...nodes(value.props?.children)];
async function render(canViewLocation,source){
 const shipment={id:'shipment',code:'REVIEW',origin:'Origin',destination:'Destination',recipient_role:'VIEWER',operational_status:'IN_TRANSIT',tracking_mode:'LOCATION_AND_STATUS',can_view_location:canViewLocation,events:[],current_location:{location_area:'Area',location_lat:9,location_lng:38,location_precision_km:5,updated_at:'2026-10-18T12:00:00Z',location_source:source}};
 const {default:Page}=load('src/app/track/[id]/page.tsx',{
  'react/jsx-runtime':{jsx:node,jsxs:node},'next/link':{__esModule:true,default:'Link'},'next/navigation':{redirect(){throw Error('Unexpected redirect');}},
  '@/components/localization':{Text:'Text'},'@/components/tracking-proof-link':{TrackingProofLink:'Proof'},'@/components/public-header':{PublicHeader:'Header'},'@/components/flash':{Flash:'Flash'},
  '@/components/demo-tracking-label':{DemoTrackingLabel:'DemoTrackingLabel'},'@/lib/demo-tracking-identity.js':demoTrackingIdentity,
  '@/lib/provider-tracking.js':{getProviderGuestTracking:async()=>shipment},'@/components/status-pill':{StatusPill:'Status'},'@/lib/auth':{getProviderTrackingGrant:async()=>({recipientDigest:'protected',expiresAt:1}),getCurrentUser:async()=>null},
  '@/components/tracking-idle-guard':{TrackingSessionBoundary:'Session'},'@/components/tracking-location-map':{TrackingLocationMap:'Map'},'@/components/tracking-auto-refresh':{TrackingAutoRefresh:'AutoRefresh'},'@/lib/tracking-refresh-revision.js':trackingRefresh,'@/components/tracking-map-data':{trackingMapData},'@/components/tracking-sharing':{TrackingSharing:'Sharing'},'@/lib/security.js':{},'@/lib/location-source.js':locationSource
 });
 return nodes(await Page({params:Promise.resolve({id:'shipment'}),searchParams:Promise.resolve({})}));
}
test('route-only recipients see status guidance and no location source despite underlying shipment mode',async()=>{
 const tree=await render(false,'TELEMATICS'),banner=tree.find(item=>item.props.className==='tracking-mode-banner');
 const labels=nodes(banner).filter(item=>item.type==='Text').map(item=>item.props.message);
 assert.ok(labels.includes('Status updates'));assert.equal(labels.includes('Location and status updates'),false);assert.equal(labels.includes('GPS device'),false);
 assert.equal(tree.find(item=>item.type==='Map').props.shipment.location,null);
});
test('location recipients see the actual saved source without obsolete phone foreground claims',async()=>{
 for(const [source,label]of [['TELEMATICS','GPS device'],['DEVICE_OBSCURED','Driver’s phone'],['MANUAL_ADMIN','Manually entered']]){
  const tree=await render(true,source),banner=tree.find(item=>item.props.className==='tracking-mode-banner');
  const labels=nodes(banner).filter(item=>item.type==='Text').map(item=>item.props.message);
  assert.ok(labels.includes('Location and status updates'));assert.ok(labels.includes(label));assert.equal(labels.some(value=>/phone locks|visible Tracking screen/.test(value)),false);
 }
});
