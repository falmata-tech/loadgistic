import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import ts from 'typescript';import * as source from '../src/lib/location-source.js';import * as trackingMap from '../src/lib/tracking-map.js';
function load(file,imports){const code=ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,exports={};new Function('require','exports',code)(name=>{assert.ok(name in imports,'Unexpected import '+name);return imports[name];},exports);return exports;}
const styles={badge:'source-badge'},markerStyles={marker:'marker',frame:'circle',image:'art'};
const {trackingMarkerContent}=load('src/components/tracking-location-map-leaflet.tsx',{'react/jsx-runtime':{},'@/components/localization':{},react:{},'react-leaflet':{},leaflet:{},'@/components/base-map-tiles':{},'@/lib/vehicle-configurations':{vehicleConfigurationImage:()=>'/vehicle-configurations/mini-box-truck.jpg'},'@/lib/location-source.js':source,'./location-source-badge.module.css':{__esModule:true,default:styles},'./tracking-location-map.module.css':{__esModule:true,default:markerStyles}});
const {trackingMapData}=load('src/components/tracking-map-data.ts',{'@/lib/tracking-map.js':trackingMap});
test('Tracking marker uses a circle and source badge only for real recognized provenance',()=>{
 for(const kind of ['GPS','MOBILE','MANUAL']){const html=trackingMarkerContent('Box Truck',kind);assert.match(html,/class="circle"/);assert.match(html,/class="source-badge"/);assert.ok(html.includes(source.locationSourceSvg(kind)));assert.ok(html.includes(source.locationSourceLabel(kind)));}
 for(const kind of [null,undefined,'GPS_PENDING','<svg onload=alert(1)>']){const html=trackingMarkerContent('Box Truck',kind);assert.equal(html.includes('source-badge'),false);assert.equal(html.includes('onload'),false);}
 assert.equal(trackingMarkerContent('Box Truck','GPS',()=>'<script>"&').includes('<script>'),false);
});
test('Tracking map projection preserves only allowlisted source on an authorized obscured fix',()=>{
 const fix={location_area:'Area',location_lat:9,location_lng:38,location_precision_km:10,updated_at:'2026-10-18T12:00:00Z',imei:'PRIVATE_IMEI',speed:22,device_id:'PRIVATE_DEVICE',raw_latitude:9.123456};
 const base={tracking_mode:'LOCATION_AND_STATUS',operational_status:'IN_TRANSIT',current_location:fix};
 for(const [raw,kind]of [['TELEMATICS','GPS'],['DEVICE_OBSCURED','MOBILE'],['MANUAL_ADMIN','MANUAL']]){const data=trackingMapData({...base,current_location:{...fix,location_source:raw}});assert.equal(data.location.source,kind);assert.equal(JSON.stringify(data).includes('PRIVATE_'),false);assert.equal('raw_latitude'in data.location,false);}
 assert.equal('source'in trackingMapData(base).location,false);
 assert.equal(trackingMapData({...base,can_view_location:false}).location,null);assert.equal(trackingMapData({...base,can_view_location:false}).trackingMode,'STATUS_ONLY');
 assert.equal(trackingMapData({...base,current_location:{...fix,location_source:'TELEMATICS',is_demo:true}}).location.demo,true);
 for(const is_demo of [false,'true',1,null])assert.equal('demo'in trackingMapData({...base,current_location:{...fix,is_demo}}).location,false);
 assert.equal(trackingMapData({...base,current_location:null}).location,null);
 for(const operational_status of ['COMPLETED','CANCELLED'])assert.equal(trackingMapData({...base,operational_status}).location,null);
});

test('Demo location copy is present in both supported translations without translating record data',()=>{const {gpsMessages}=load('src/lib/i18n/gps-messages.ts',{});for(const locale of ['am','om'])assert.ok(gpsMessages[locale]['Demo location']&&gpsMessages[locale]['Demo location']!=='Demo location');});
