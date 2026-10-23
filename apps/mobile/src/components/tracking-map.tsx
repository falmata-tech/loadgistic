import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Image,Text,View} from 'react-native';
import {Map,Camera,GeoJSONSource,Layer,Marker,type CameraRef} from './map-platform';
import {mapStyle} from './map-style';
import {trackingAreaGeometry,type TrackingArea} from '../location/tracking-area';
import {Copy,ErrorText} from './ui';
import {coverageBounds,coverageGeometry} from '../map/coverage-preview';
import {useLanguage} from '../localization/provider';
import {apiOrigin} from '../api/http';
import {vehicleConfigurationImage} from '../../../../src/lib/vehicle-configurations';
import type {Place} from './place-picker';
import type {TrackingRoutePoint,TrackingPublicTruck} from '../api/tracking';
import {AppIcon} from './app-icon';
import {locationSourceKind,locationSourceLabel,locationSourceColor} from '../../../../src/lib/location-source.js';
import {capacityStatusPresentation} from '../theme/capacity-status-presentation';
export type MapCoverage={kind:string;places:Place[];partial:boolean};
const cameraFailureMessage='The map view could not update. Shipment progress remains available.';
export function TrackingMap({location=null,route=[],truck=null,onTruckPress,coverage,regular=[],fill=false,vehicleConfiguration}:{
 location?:TrackingArea|null;route?:TrackingRoutePoint[];truck?:TrackingPublicTruck|null;onTruckPress?:()=>void;
 coverage?:MapCoverage;regular?:MapCoverage[];fill?:boolean;vehicleConfiguration?:string;
}){
 const {t}=useLanguage(),[error,setError]=useState('');
 const geometry=useMemo(()=>location?trackingAreaGeometry(location):null,[location]);
 const planned=useMemo(()=>route.length>=2?coverageGeometry('ROUTE',route):null,[route]);
 const current=useMemo(()=>coverage?coverageGeometry(coverage.kind,coverage.places):null,[coverage]);
 const regularShapes=useMemo(()=>regular.map(item=>coverageGeometry(item.kind,item.places)).filter(item=>item!==null),[regular]);
 const frame=useMemo<[number,number,number,number]>(()=>{
  const bounds=[geometry,planned,current,...regularShapes].filter(shape=>shape!==null).map(shape=>coverageBounds(shape));
  return bounds.length?[Math.min(...bounds.map(b=>b[0])),Math.min(...bounds.map(b=>b[1])),Math.max(...bounds.map(b=>b[2])),Math.max(...bounds.map(b=>b[3]))]:[32,3,49,15];
 },[geometry,planned,current,regularShapes]);
 const camera=useRef<CameraRef|null>(null),mapLoaded=useRef(false),mapReady=useRef(false),latestFrame=useRef(frame),fitRequest=useRef(0);
 const pendingFit=useRef<{frame:typeof frame;request:number;attempt:number}|null>(null);
 const routeCoordinates=planned?JSON.stringify(route.map(point=>point.coordinate)):'';
 const previousView=useRef({routeCoordinates,located:!!geometry});
 const fitPendingFrame=useCallback((allowRetry=false)=>{
  const target=pendingFit.current;
  if(!mapReady.current||!camera.current||!target||(target.attempt>0&&!allowRetry))return;
  pendingFit.current=null;
  const failed=()=>{
   if(fitRequest.current!==target.request||pendingFit.current)return;
   if(target.attempt===0)pendingFit.current={...target,frame:latestFrame.current,attempt:1};
   else setError(cameraFailureMessage);
  };
  try{
   // Native dispatch returns a Promise at runtime despite the shared void signature.
   void Promise.resolve(camera.current.fitBounds(target.frame,{padding:{top:130,right:76,bottom:100,left:76},duration:0})).then(()=>{
    if(fitRequest.current===target.request)setError(previous=>previous===cameraFailureMessage?'':previous);
   },failed);
  }catch{failed();}
 },[]);
 const attachCamera=useCallback((instance:CameraRef|null)=>{
  camera.current=instance;
  // Native Camera can replace its imperative handle while the same map stays loaded.
  if(instance)fitPendingFrame();
 },[fitPendingFrame]);
 useEffect(()=>{
  const previous=previousView.current;
  latestFrame.current=frame;
  if(routeCoordinates&&(routeCoordinates!==previous.routeCoordinates||(!previous.located&&geometry)))pendingFit.current={frame,request:++fitRequest.current,attempt:0};
  else if(pendingFit.current)pendingFit.current={...pendingFit.current,frame};
  previousView.current={routeCoordinates,located:previous.located||!!geometry};
  fitPendingFrame();
 },[routeCoordinates,geometry,frame,fitPendingFrame]);
 const color=coverage?.partial?capacityStatusPresentation.PARTIAL.color:capacityStatusPresentation.EMPTY.color;
 const source=locationSourceKind(location?.source),sourceLabel=locationSourceLabel(source);
 // Only the saved obscured center positions this marker; city stops are not GPS fixes.
 return <View style={fill?{flex:1}:{gap:8}}><View style={fill?{flex:1,overflow:'hidden'}:{height:280,borderRadius:14,overflow:'hidden'}}>
  <Map style={{flex:1}} androidView="texture" mapStyle={mapStyle} attribution onDidFinishLoadingMap={()=>{mapLoaded.current=true;}} onDidFinishRenderingFrame={()=>{if(mapLoaded.current&&camera.current){mapReady.current=true;fitPendingFrame(true);}}} onDidFailLoadingMap={()=>setError(route.length?'Map tiles could not load. The reported route and update time remain available.':'Map tiles could not load. The reported area and update time are shown above.')}>
   <Camera ref={attachCamera} initialViewState={{bounds:frame,padding:route.length?{top:130,right:76,bottom:100,left:76}:{top:28,right:28,bottom:28,left:28}}}/>
   {planned&&<GeoJSONSource id="tracking-planned-route" data={planned}><Layer id="tracking-planned-route-line" type="line" layout={{'line-cap':'round','line-join':'round'}} paint={{'line-color':'#155eef','line-width':4,'line-dasharray':[2,1]}}/></GeoJSONSource>}
   {geometry&&<GeoJSONSource id="tracking-area" data={geometry}><Layer id="tracking-area-fill" type="fill" paint={{'fill-color':'#1976ed','fill-opacity':.12}}/><Layer id="tracking-area-outline" type="line" paint={{'line-color':'#1976ed','line-width':3,'line-dasharray':[2,2]}}/></GeoJSONSource>}
   {route.map((point,index)=><Marker key={point.placeRef} id={`tracking-city-${index}`} lngLat={[point.coordinate[0],point.coordinate[1]]}><View style={{alignItems:'center',maxWidth:130}}><Text style={{padding:5,borderRadius:6,backgroundColor:'#fff',color:'#0b1d3a',fontSize:11,fontWeight:'600'}}>{point.label}</Text><View style={{width:16,height:16,borderRadius:8,backgroundColor:index===route.length-1?'#e9b400':'#155eef',borderColor:'#fff',borderWidth:3}}/></View></Marker>)}
   {(truck||vehicleConfiguration)&&location&&geometry&&<Marker id="tracking-reported-truck" lngLat={[location.longitude,location.latitude]} onPress={onTruckPress}><View accessible accessibilityRole={onTruckPress?'button':'image'} accessibilityLabel={`${t(onTruckPress?'Vehicle details':'Vehicle')}${sourceLabel?', '+t(sourceLabel):''}${location.demo?', '+t('Demo location'):''}`} style={{position:'relative',width:58,height:58,alignItems:'center',justifyContent:'center'}}><View style={{width:54,height:54,borderRadius:27,borderWidth:3,borderColor:'#1a73e8',backgroundColor:'#fff',alignItems:'center',justifyContent:'center'}}><Image source={{uri:apiOrigin+vehicleConfigurationImage(truck?.configuration||vehicleConfiguration||'')}} resizeMode="contain" style={{width:44,height:40}}/></View>{source&&<View pointerEvents="none" testID="tracking-location-source" style={{position:'absolute',top:0,left:0,width:22,height:22,borderRadius:11,borderWidth:1.5,borderColor:locationSourceColor(source),backgroundColor:'#fff',alignItems:'center',justifyContent:'center'}}><AppIcon name={source==='GPS'?'gps':source==='MOBILE'?'phone':'manual'} size={13} color={locationSourceColor(source)}/></View>}</View></Marker>}
   {current&&<GeoJSONSource id="saved-capacity" data={current}>{current.geometry.type==='Polygon'&&<Layer id="saved-capacity-fill" type="fill" paint={{'fill-color':color,'fill-opacity':.1}}/>}<Layer id="saved-capacity-outline" type="line" layout={{'line-cap':'round','line-join':'round'}} paint={{'line-color':color,'line-width':4}}/></GeoJSONSource>}
   {regularShapes.map((shape,index)=><GeoJSONSource key={index} id={`home-regular-${index}`} data={shape}><Layer id={`home-regular-line-${index}`} type="line" layout={{'line-cap':'round','line-join':'round'}} paint={{'line-color':'#b56326','line-width':3,'line-dasharray':[2,2]}}/></GeoJSONSource>)}
  </Map>
 </View>{!fill&&<><Copy message="The driver is somewhere within the blue area. This is not a precise location."/>{current&&<Copy message="Coverage preview · not driving directions"/>}</>}{fill&&route.length>0?!!error&&<View style={{position:'absolute',left:10,right:10,bottom:88,maxWidth:440,padding:10,borderRadius:10,backgroundColor:'#fff'}}><ErrorText message={error}/></View>:<ErrorText message={error}/>}</View>;
}
