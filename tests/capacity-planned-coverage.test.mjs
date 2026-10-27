import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {capacityStatusPresentation} from '../src/lib/capacity-status-presentation.js';
import * as selection from '../src/lib/capacity-location-selection.js';
import * as sharing from '../src/lib/capacity-sharing.js';

const nodes=value=>!value||typeof value!=='object'?[]:Array.isArray(value)?value.flatMap(nodes):[value,...nodes(value.props?.children)];
const point=(lat,lng,label)=>({lat,lng,label});
const route=[point(9,38,'A'),point(10,39,'B')];
const preferred={id:'preferred',vehicle_id:'vehicle',driver_user_id:'driver',geometry:'ROUTE',route_points:[point(11,40,'C'),point(12,41,'D')],area_boundary:[]};
function load(file,extra={}){
 const node=(type,props)=>({type,props:props||{}}),react={useState:initial=>[typeof initial==='function'?initial():initial,()=>{}],useRef:initial=>({current:initial}),useMemo:fn=>fn(),useEffect(){},useTransition:()=>[false,()=>{}]};
 const icons=new Proxy({},{get:(_value,key)=>key});
 const ports={'react/jsx-runtime':{jsx:node,jsxs:node},react:{__esModule:true,default:react},
  'react-leaflet':{Circle:'Circle',CircleMarker:'CircleMarker',MapContainer:'MapContainer',Tooltip:'Tooltip',useMap:()=>({})},leaflet:{__esModule:true,default:{}},
  'next/image':{__esModule:true,default:'Image'},'next/link':{__esModule:true,default:'Link'},'next/navigation':{useRouter:()=>({refresh(){}})},'lucide-react':icons,
  '@/components/localization':{Text:'Text',FeedbackText:'FeedbackText',Localized:'Localized',useTranslation:()=>({t:message=>message})},
  '@/components/base-map-tiles':{BaseMapTiles:'Tiles'},'@/lib/capacity-status-presentation':{capacityStatusPresentation},'@/components/offset-signal-polyline':{OffsetSignalPolyline:'OffsetPolyline'},
  '@/lib/capacity-location-selection.js':selection,'@/lib/capacity-sharing':sharing,'@/lib/vehicle-configurations':{vehicleConfigurationImage:()=>'/vehicle.jpg'},'@/lib/location-privacy.js':{nextCapacityPrivacyRadius:()=>5},
  '@/lib/ui':{relativeTime:()=>''},'@/lib/capacity-editor-client':{},'@/lib/location-source.js':{locationSourceLabel:()=>''},
  './capacity-location-map':{CapacityLocationMap:'CoverageMap'},'./capacity-form':{CapacityForm:'Form'},'./cargo-space-photo-panel':{ProviderCargoSpacePhoto:'PhotoPanel'},'./public-capacity-map':{PublicCapacityMap:'PublicMap'},'./status-pill':{StatusPill:'StatusPill'},'./capacity-market-planning':{CapacityMarketPlanning:'Planning'},'./capacity-edit-dialog':{CapacityEditDialog:'Dialog'},'./capacity-signal-editor':{CapacitySignalEditor:'SignalEditor'},'./driver-capacity-location-editor':{DriverCapacityLocationEditor:'LocationEditor'},...extra};
 const code=ts.transpileModule(readFileSync(new URL('../'+file,import.meta.url),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,exports={};
 new Function('require','exports',code)(name=>{assert.ok(name in ports,'Unexpected dependency '+name);return ports[name];},exports);return exports;
}
test('saved Planned/Preferred coverage renders without inventing a reported vehicle location',()=>{
 const render=load('src/components/capacity-location-map-leaflet.tsx').CapacityLocationMapLeaflet;
 const tree=render({center:null,radiusKm:5,routePoints:route,regularSignals:[preferred]});
 const all=nodes(tree);assert.equal(all.filter(node=>node.type==='OffsetPolyline').length,2);
 assert.equal(all.filter(node=>node.type==='Circle'||node.type==='CircleMarker').length,0,'No GPS/phone/manual point or uncertainty circle is fabricated');
 assert.deepEqual(all.find(node=>node.type==='MapContainer').props.center,[9,38]);
 assert.equal(all.some(node=>node.props.message==='Planned route'),true);
 assert.equal(all.some(node=>node.props.message==='Preferred corridor'),true);
 assert.equal(tree.props['aria-label'],'Capacity coverage');
});
test('reported location keeps its separate uncertainty circle alongside Planned and Preferred coverage',()=>{
 const render=load('src/components/capacity-location-map-leaflet.tsx').CapacityLocationMapLeaflet;
 const all=nodes(render({center:point(8,37,'Reported'),radiusKm:5,routePoints:route,regularSignals:[preferred]}));
 assert.equal(all.filter(node=>node.type==='Circle').length,1);
 assert.deepEqual(all.find(node=>node.type==='Circle').props.center,[8,37]);
 assert.equal(all.find(node=>node.type==='Circle').props.radius,5000);
 assert.equal(all.filter(node=>node.type==='OffsetPolyline').length,2);
});
test('provider Home keeps saved coverage visible before a reported location exists',()=>{
 const render=load('src/components/capacity-form.tsx').CapacityForm;
 for(const current of [null,{status:'EMPTY',availability_geometry:'ROUTE',current_route_points:route}]){
  const tree=render({vehicles:[{id:'vehicle',label:'Vehicle',make:'Example',model:'Van',driver:{id:'driver',name:'Driver'},current}],corridors:[preferred],allowCorridors:true,renderedAt:0});
  const map=nodes(tree).find(node=>node.type==='CoverageMap');assert.ok(map);
  assert.equal(map.props.center,null);assert.equal(map.props.regularSignals.length,1);
  assert.deepEqual(map.props.routePoints,current?route:[]);
 }
});
test('a fleet driver without publishing permission also sees saved coverage without a reported marker',()=>{
 const render=load('src/components/driver-capacity-home.tsx').DriverCapacityHome;
 const tree=render({vehicles:[{id:'vehicle',assigned_driver:{id:'driver'}}],capacities:[],corridors:[preferred],access:{kind:'COMPANY',can_manage_capacity:false},query:{},renderedAt:0});
 const task=nodes(tree).find(node=>typeof node.type==='function'&&node.type.name==='RestrictedAvailability');assert.ok(task);
 const map=nodes(task.type(task.props)).find(node=>node.type==='CoverageMap');assert.ok(map);
 assert.equal(map.props.center,null);assert.equal(map.props.regularSignals.length,1);
});
