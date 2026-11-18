import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as locationSource from '../src/lib/location-source.js';
import * as trackingMap from '../src/lib/tracking-map.js';
import * as contracts from '../src/lib/tracking-sessions/contracts.ts';
import * as client from '../src/lib/tracking-sessions/client.ts';
import * as refresh from '../src/lib/tracking-refresh-policy.js';
function load(file,imports){const compiled=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,exports={};new Function('require','exports',compiled)(name=>{assert.ok(name in imports,name);return imports[name];},exports);return exports;}
const {trackingMapData}=load('src/components/tracking-map-data.ts',{'@/lib/tracking-map.js':trackingMap});
const node=(type,props)=>({type,props:props||{}}),nodes=value=>!value||typeof value!=='object'?[]:Array.isArray(value)?value.flatMap(nodes):[value,...nodes(value.props?.children)];
function render(canViewLocation,source){
 const projected=trackingMapData({tracking_mode:'LOCATION_AND_STATUS',operational_status:'IN_TRANSIT',can_view_location:canViewLocation,current_location:{location_area:'Area',location_lat:9,location_lng:38,location_precision_km:5,updated_at:'2026-10-18T12:00:00Z',location_source:source},events:[]});
 const id='16000000-0000-4000-8000-000000000001',shipmentId='16000000-0000-4000-8000-000000000002';
 const session={id,reference:'Local load',state:'CONNECTED',revision:1,workspaceId:null,shipmentId,route:[{placeRef:'A',label:'A',coordinate:[38,9]},{placeRef:'B',label:'B',coordinate:[39,10]}],cargoSummary:'Local cargo',pickupDate:'',deliveryDate:'',capabilities:{canIssueLink:false,canRevokeLink:false,canAcceptProvider:false},links:[],tracking:{shipmentId,code:'Local reference',status:'IN_TRANSIT',updatedAt:'',trackingMode:projected.trackingMode,location:projected.location,events:[]}};
 const React={useState:value=>[value,()=>{}],useRef:value=>({current:value}),useCallback:fn=>fn,useEffect(){}};
 const {TrackingSessionGuest}=load('src/components/tracking-session-guest.tsx',{'react/jsx-runtime':{jsx:node,jsxs:node},react:{__esModule:true,default:React},'./tracking-progress-panel':{trackingStatusLabels:{}},'@/lib/tracking-sessions/contracts':contracts,'@/lib/tracking-sessions/client':client,'@/lib/tracking-refresh-policy.js':refresh,'@/lib/location-source.js':locationSource,'./tracking-location-map':{TrackingLocationMap:'Map'},'./localization':{Text:'Text',useTranslation:()=>({t:value=>value})}});
 return nodes(TrackingSessionGuest({initial:{session,grant:'local.grant',expiresAt:new Date(Date.now()+300000).toISOString()}}));
}
test('route-only recipients see status guidance and no location source despite underlying shipment mode',()=>{
 const tree=render(false,'TELEMATICS'),banner=tree.find(item=>item.props.className==='tracking-mode-banner'),labels=nodes(banner).filter(item=>item.type==='Text').map(item=>item.props.message);
 assert.ok(labels.includes('Status updates'));assert.equal(labels.includes('Location and status updates'),false);assert.equal(labels.includes('GPS device'),false);assert.equal(tree.find(item=>item.type==='Map').props.shipment.location,null);assert.equal(tree.some(item=>['Proof','Sharing','PrivateFile'].includes(item.type)),false);
});
test('location recipients see the actual saved source without obsolete phone foreground claims',()=>{
 for(const [source,label]of [['TELEMATICS','GPS device'],['DEVICE_OBSCURED','Driver’s phone']]){const tree=render(true,source),banner=tree.find(item=>item.props.className==='tracking-mode-banner'),labels=nodes(banner).filter(item=>item.type==='Text').map(item=>item.props.message);assert.ok(labels.includes('Location and status updates'));assert.ok(labels.includes(label));assert.equal(labels.some(value=>/phone locks|visible Tracking screen/.test(value)),false);assert.ok(tree.find(item=>item.type==='Map').props.shipment.location);}
});
test('retired and malformed Tracking provenance cannot become an unlabelled current point',()=>{
 for(const source of ['MANUAL_ADMIN','MANUAL','unknown']){const tree=render(true,source);assert.equal(tree.find(item=>item.type==='Map').props.shipment.location,null);assert.equal(tree.some(item=>item.type==='Text'&&item.props.message==='Manually entered'),false);}
});
