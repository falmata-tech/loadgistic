import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {trackingAreaGeometry} from '../src/location/tracking-area.ts';
import {canonicalRouteGeometry,coverageBounds,coverageGeometry} from '../src/map/coverage-preview.ts';
import {capacityStatusPresentation} from '../src/theme/capacity-status-presentation.ts';
import * as locationSource from '../../../src/lib/location-source.js';

// Run the actual component and its effects against the existing Camera ref contract.
// The adapter is stubbed; this checks fit requests, not native rendering or map tiles.
function trackingMap(initial){
 const source=readFileSync(new URL('../src/components/tracking-map.tsx',import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const slots=[];let cursor=0,effects=[],tree,props=initial,cameraReady=false,attachedRef;
 const fits=[],failures=[];
 const same=(left,right)=>left&&right&&left.length===right.length&&left.every((value,index)=>Object.is(value,right[index]));
 const memo=(factory,deps)=>{const index=cursor++;if(!slots[index]||!same(slots[index].deps,deps))slots[index]={deps,value:factory()};return slots[index].value;};
 const react={
  useState:initial=>{const index=cursor++;if(!slots[index])slots[index]={value:initial};return[slots[index].value,value=>{slots[index].value=typeof value==='function'?value(slots[index].value):value;}];},
  useRef:initial=>{const index=cursor++;if(!slots[index])slots[index]={current:initial};return slots[index];},
  useMemo:memo,useCallback:(fn,deps)=>memo(()=>fn,deps),
  useEffect:(fn,deps)=>{const index=cursor++;if(!slots[index]||!same(slots[index].deps,deps)){slots[index]={deps};effects.push(fn);}}
 };
 const node=(type,props,key)=>({type,props:props||{},key:key??null});
 const dependencies={
  react,'react/jsx-runtime':{jsx:node,jsxs:node},
  'react-native':{Image:'Image',Text:'Text',View:'View'},
  './map-platform':{Map:'Map',Camera:'Camera',GeoJSONSource:'GeoJSONSource',Layer:'Layer',Marker:'Marker'},
  './map-style':{mapStyle:{}},'../location/tracking-area':{trackingAreaGeometry},
  './ui':{Copy:'Copy',ErrorText:'ErrorText'},'../map/coverage-preview':{canonicalRouteGeometry,coverageBounds,coverageGeometry},
  '../localization/provider':{useLanguage:()=>({t:message=>message})},'../api/http':{apiOrigin:'http://127.0.0.1'},
  '../../../../src/lib/vehicle-configurations':{vehicleConfigurationImage:()=>'/truck.svg'},
  '../../../../src/lib/location-source.js':locationSource,'./app-icon':{AppIcon:'AppIcon'},
  '../theme/capacity-status-presentation':{capacityStatusPresentation}
 };
 const exports={};new Function('require','exports',compiled)(name=>{assert.ok(name in dependencies,`unexpected dependency ${name}`);return dependencies[name];},exports);
 const camera={fitBounds:(bounds,options)=>{
  fits.push({bounds:[...bounds],options});
  const fail=failures.shift();
  if(fail==='throw')throw new Error('Synthetic native Camera ref unavailable');
  if(typeof fail==='function')return fail();
 }};
 const assignRef=(ref,value)=>{if(typeof ref==='function')ref(value);else if(ref)ref.current=value;};
 function attach(){const ref=find(tree,item=>item.type==='Camera').props.ref;if(ref!==attachedRef){assignRef(attachedRef,null);attachedRef=ref;assignRef(ref,camera);}}
 return{
  fits,
  failNext:failure=>failures.push(failure),
  render(next=props){props=next;cursor=0;effects=[];tree=exports.TrackingMap(props);if(cameraReady)attach();for(const effect of effects)effect();return tree;},
  load(){find(tree,item=>item.type==='Map').props.onDidFinishLoadingMap?.();},
  mountCamera(){cameraReady=true;attach();},
  frame(){find(tree,item=>item.type==='Map').props.onDidFinishRenderingFrame?.();},
  refreshCameraRef(){assignRef(attachedRef,null);assignRef(attachedRef,camera);},
  ready(){// BrowserMap emits load before rendering its Camera child.
   find(tree,item=>item.type==='Map').props.onDidFinishLoadingMap?.();cameraReady=true;attach();
   find(tree,item=>item.type==='Map').props.onDidFinishRenderingFrame?.();
  }
 };
}
function find(tree,predicate){
 if(Array.isArray(tree)){for(const child of tree){const result=find(child,predicate);if(result)return result;}return null;}
 if(!tree||typeof tree!=='object')return null;if(predicate(tree))return tree;return find(tree.props?.children,predicate);
}
const route=[{placeRef:'origin',label:'Origin',coordinate:[39,8]},{placeRef:'via',label:'Passing city',coordinate:[40,9]},{placeRef:'destination',label:'Destination',coordinate:[41,10]}];

test('saved Planned and Preferred routes fit without a reported marker, circle or source',()=>{
 const props={location:null,coverage:{kind:'ROUTE',places:route},regular:[{kind:'ROUTE',places:[...route].reverse()}],vehicleConfiguration:'Box truck',fill:true},view=trackingMap(props);
 let tree=view.render();assert.ok(find(tree,node=>node.props.id==='saved-capacity'));assert.ok(find(tree,node=>node.props.id==='home-regular-0'));assert.equal(find(tree,node=>node.props.id==='tracking-area'),null);assert.equal(find(tree,node=>node.props.id==='tracking-reported-truck'),null);assert.equal(find(tree,node=>node.props.testID==='tracking-location-source'),null);assert.equal(find(tree,node=>node.type==='Marker'),null);
 const bounds=find(tree,node=>node.type==='Camera').props.initialViewState.bounds;for(const point of route)assert.ok(point.coordinate[0]>=bounds[0]&&point.coordinate[0]<=bounds[2]&&point.coordinate[1]>=bounds[1]&&point.coordinate[1]<=bounds[3]);
 find(tree,node=>node.type==='Map').props.onDidFailLoadingMap();tree=view.render();assert.equal(find(tree,node=>node.type==='ErrorText').props.message,'Map tiles unavailable.');
});
const area=(longitude,latitude=8)=>({longitude,latitude,radius:3,area:'Reported area',updatedAt:'2026-10-13T00:00:00Z'});
function contains(bounds,coordinate){assert.ok(coordinate[0]>=bounds[0]&&coordinate[0]<=bounds[2]&&coordinate[1]>=bounds[1]&&coordinate[1]<=bounds[3],`frame ${bounds} must contain ${coordinate}`);}

test('driver map separates same-lane Capacity and corridor routes from location',()=>{
 const coverage={kind:'ROUTE',places:route,partial:false};
 const view=trackingMap({location:area(39),coverage,regular:[coverage],vehicleConfiguration:'Box truck',fill:true});
 const tree=view.render();
 assert.equal(find(tree,item=>item.props.id==='tracking-area-outline').props.paint['line-color'],'#7846a7');
 assert.ok(find(find(tree,item=>item.props.id==='tracking-reported-truck'),item=>item.props.style?.borderColor==='#7846a7'));
 assert.equal(find(tree,item=>item.props.id==='saved-capacity-outline').props.paint['line-offset'],-6);
 assert.equal(find(tree,item=>item.props.id==='home-regular-line-0').props.paint['line-offset'],6);
 assert.equal(find(tree,item=>item.props.id==='home-regular-line-0').props.paint['line-color'],'#c06620');
 const reversed=view.render({location:area(39),coverage,regular:[{...coverage,places:[...route].reverse()}],vehicleConfiguration:'Box truck',fill:true});
 assert.deepEqual(find(reversed,item=>item.props.id==='saved-capacity').props.data.geometry.coordinates,find(reversed,item=>item.props.id==='home-regular-0').props.data.geometry.coordinates,'reversed corridors need the same display direction before opposite lane offsets');
 const single=view.render({location:area(39),coverage,regular:[],fill:true});
 assert.equal(find(single,item=>item.props.id==='saved-capacity-outline').props.paint['line-offset'],undefined);
});

test('the first saved approximate location fits the route and area without remounting',()=>{
 const view=trackingMap({route,location:null,fill:true});
 const initial=view.render();view.ready();
 const next=view.render({route,location:area(33),fill:true});
 assert.equal(find(next,item=>item.type==='Map').key,find(initial,item=>item.type==='Map').key);
 assert.equal(view.fits.length,1,'first saved location must update the camera');
 for(const point of route)contains(view.fits[0].bounds,point.coordinate);
 for(const point of trackingAreaGeometry(area(33)).geometry.coordinates[0])contains(view.fits[0].bounds,point);
 assert.deepEqual(view.fits[0].options.padding,{top:130,right:76,bottom:100,left:76});
});

test('driver map movement preserves its map instance and renders only actual published source badges',()=>{
 const view=trackingMap({location:{...area(39),source:'GPS'},vehicleConfiguration:'Box truck',fill:true});
 const initial=view.render();view.ready();
 const map=find(initial,item=>item.type==='Map');
 assert.equal(find(initial,item=>item.type==='AppIcon').props.name,'gps');
 const moved=view.render({location:{...area(40),source:'MOBILE'},vehicleConfiguration:'Box truck',fill:true});
 assert.equal(find(moved,item=>item.type==='Map').key,map.key);
 assert.equal(view.fits.length,0,'routine driver movement must preserve the user camera');
 assert.equal(find(moved,item=>item.type==='AppIcon').props.name,'phone');
 assert.equal(find(moved,item=>item.props.testID==='tracking-location-source').props.pointerEvents,'none');
 const manual=view.render({location:{...area(40),source:'MANUAL'},vehicleConfiguration:'Box truck',fill:true});
 assert.equal(find(manual,item=>item.type==='AppIcon').props.name,'manual');
 const unknown=view.render({location:area(40),vehicleConfiguration:'Box truck',fill:true});
 assert.equal(find(unknown,item=>item.type==='AppIcon'),null);
 const hidden=view.render({location:null,vehicleConfiguration:'Box truck',fill:true});
 assert.equal(find(hidden,item=>item.props.id==='tracking-reported-truck'),null);
});

test('Tracking keeps the reported vehicle above overlapping route-stop markers',()=>{
 const onTruckPress=()=>{};
 const view=trackingMap({route,location:{...area(39),source:'GPS'},vehicleConfiguration:'Box truck',onTruckPress,fill:true});
 const map=find(view.render(),item=>item.type==='Map');
 function markers(node){
  if(Array.isArray(node))return node.flatMap(markers);
  if(!node||typeof node!=='object')return [];
  return node.type==='Marker'?[node.props.id]:markers(node.props?.children);
 }
 assert.deepEqual(markers(map.props.children),[
  'tracking-city-0','tracking-city-1','tracking-city-2','tracking-reported-truck'
 ],'the vehicle and its tap target must paint above a city stop');
 assert.equal(find(map,item=>item.props?.id==='tracking-reported-truck').props.onPress,onTruckPress);
});

test('a corrected route refits but equivalent routes and later moving fixes preserve the camera',()=>{
 const view=trackingMap({route,location:area(39),fill:true});
 const initial=view.render();view.ready();
 const corrected=route.map(point=>point.placeRef==='via'?{...point,coordinate:[34,7]}:point);
 const changed=view.render({route:corrected,location:area(39),fill:true});
 assert.equal(find(changed,item=>item.type==='Map').key,find(initial,item=>item.type==='Map').key);
 assert.equal(view.fits.length,1,'changed route coordinates must update the camera');
 contains(view.fits[0].bounds,[34,7]);
 view.render({route:corrected.map(point=>({...point,label:`${point.label} refreshed`,coordinate:[...point.coordinate]})),location:area(39),fill:true});
 view.render({route:corrected,location:area(32),fill:true});
 view.render({route:corrected,location:null,fill:true});
 view.render({route:corrected,location:area(31),fill:true});
 assert.equal(view.fits.length,1,'status/equivalent refreshes and subsequent locations must not reset a user camera');
});

test('updates received before Camera readiness fit the latest route and saved area once ready',()=>{
 const view=trackingMap({route,location:null,fill:true});view.render();
 view.render({route,location:area(33),fill:true});
 const corrected=route.map(point=>point.placeRef==='via'?{...point,coordinate:[35,6]}:point);
 view.render({route:corrected,location:area(32),fill:true});
 assert.equal(view.fits.length,0,'camera updates must wait for the map and Camera ref');
 view.ready();
 assert.equal(view.fits.length,1,'pending correction must survive load-before-ref ordering');
 contains(view.fits[0].bounds,[35,6]);contains(view.fits[0].bounds,[32,8]);
 view.ready();view.render({route:corrected,location:area(31),fill:true});
 assert.equal(view.fits.length,1,'repeated readiness and later fixes must not reapply a fit');
});

test('an invalid location does not consume the first valid saved-location fit',()=>{
 const view=trackingMap({route,location:{...area(33),radius:2},fill:true});view.render();view.ready();
 view.render({route,location:area(33),fill:true});
 assert.equal(view.fits.length,1);
 contains(view.fits[0].bounds,[33,8]);
});

test('a pending fit waits for a rendered map frame after load and Camera mount',()=>{
 const view=trackingMap({route,location:null,fill:true});view.render();
 view.render({route,location:area(33),fill:true});
 view.frame();view.load();
 assert.equal(view.fits.length,0);
 view.mountCamera();
 assert.equal(view.fits.length,0,'a mounted handle alone does not prove the Camera is attached to the map');
 view.frame();assert.equal(view.fits.length,1);
});

test('native Camera handle replacement does not discard map readiness',()=>{
 const view=trackingMap({route,location:null,fill:true});view.render();view.ready();
 view.refreshCameraRef();view.render({route,location:area(33),fill:true});
 assert.equal(view.fits.length,1,'a stable loaded map must survive Camera imperative-handle replacement');
});

test('a synchronous Camera failure retries once on a later frame and stays bounded',()=>{
 const view=trackingMap({route,location:null,fill:true});view.render();view.ready();
 view.failNext('throw');view.failNext('throw');
 assert.doesNotThrow(()=>view.render({route,location:area(33),fill:true}));
 assert.equal(view.fits.length,1);
 assert.doesNotThrow(()=>view.frame());assert.equal(view.fits.length,2);
 view.frame();view.frame();assert.equal(view.fits.length,2,'a failed native ref must not produce an unlimited command loop');
 const error=find(view.render(),item=>item.type==='ErrorText');
 assert.equal(error.props.message,'The map view could not update. Shipment progress remains available.');
});

test('an asynchronous Camera rejection retains a pending fit until a later frame',async()=>{
 const view=trackingMap({route,location:null,fill:true});view.render();view.ready();
 const rejected=Promise.reject(new Error('Synthetic native view resolution failure'));
 void rejected.catch(()=>{}); // Keep the pre-fix red probe isolated from Node's unhandled-rejection runner.
 view.failNext(()=>rejected);view.render({route,location:area(33),fill:true});
 await Promise.resolve();await Promise.resolve();
 assert.equal(view.fits.length,1);
 view.frame();assert.equal(view.fits.length,2,'a rejected dispatch must retain its pending frame');
});

test('an older rejected Camera command cannot replace a newer corrected-route fit',async()=>{
 const view=trackingMap({route,location:null,fill:true});view.render();view.ready();
 let reject;
 const previous=new Promise((_resolve,rejectPromise)=>{reject=rejectPromise;});void previous.catch(()=>{});
 view.failNext(()=>previous);view.render({route,location:area(33),fill:true});
 const corrected=route.map(point=>point.placeRef==='via'?{...point,coordinate:[35,6]}:point);
 view.render({route:corrected,location:area(33),fill:true});
 assert.equal(view.fits.length,2);
 reject(new Error('Synthetic stale dispatch failure'));await Promise.resolve();await Promise.resolve();
 view.frame();assert.equal(view.fits.length,2,'a stale failure must not restore older bounds');
 contains(view.fits[1].bounds,[35,6]);
});
