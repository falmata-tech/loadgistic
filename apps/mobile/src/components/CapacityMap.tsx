import {TruckAuthorityBadges} from './truck-authority';
import {capacitySharingLabel} from '../../../../src/lib/capacity-sharing';
import {Link} from 'expo-router';
import {useLanguage} from '../localization/provider';
import {focusedMarkers,type MapPoint} from '../map/focused-markers';
import {capacityMapData,capacityStatuses,capacityColors,capacitySourceIds,capacityLayerIds,renderedCapacityPoints,capacityMarkerOffsets} from '../map/capacity-clusters';
import {capacityLoadLabel} from '../../../../src/lib/capacity-load-preferences';
import { mapStyle } from './map-style';
import {AppIcon} from './app-icon';
import {locationSourceKind,locationSourceLabel,locationSourceColor} from '../../../../src/lib/location-source.js';
import {PublicCardImage} from './public-card';
import { memo,useCallback,useEffect,useMemo,useRef,useState } from 'react';
import { Modal,useWindowDimensions,Image,Pressable,ScrollView,StyleSheet,Text,View } from 'react-native';
import { Map,Camera,GeoJSONSource,Layer,Marker,type CameraRef,type GeoJSONSourceRef,type MapRef,type ViewState } from './map-platform';
import type { FeatureCollection,LineString } from 'geojson';
import type { CapacitySignal } from '../api/public-capacity';
import { markerLocation,signalBounds,signalPaths } from '../map/capacity-geometry';
import {createVisibleQuery} from '../map/visible-query';
import { vehicleConfigurationImage } from '../../../../src/lib/vehicle-configurations';
import { apiOrigin } from '../api/http';
type VisiblePoint=MapPoint;
const colors={truck:'#0c7275',location:'#1a73e8',current:'#16a34a',regular:'#c06620'};
type InfoKind=keyof typeof colors;
function CapacityMap({items,onSelect,onDeselect,selected=null,loading=false,topInset=68,bottomInset=8}:{items:CapacitySignal[];onSelect:(item:CapacitySignal)=>void;onDeselect:()=>void;selected?:CapacitySignal|null;loading?:boolean;topInset?:number;bottomInset?:number}) {
 const {t}=useLanguage();
 const host=useRef<View>(null),windowSize=useWindowDimensions();
 const [modalFrame,setModalFrame]=useState({left:0,top:0,width:windowSize.width,height:windowSize.height});
 const latestView=useRef<Pick<ViewState,'center'|'zoom'|'bearing'|'pitch'>>({center:[39.5,9],zoom:5,bearing:0,pitch:0});
 const previousView=useRef<typeof latestView.current|null>(null);
 const [info,setInfo]=useState<{id:string;kind:InfoKind;index:number}|null>(null);
 const camera=useRef<CameraRef>(null),emptySource=useRef<GeoJSONSourceRef>(null),partialSource=useRef<GeoJSONSourceRef>(null),map=useRef<MapRef>(null);
 const [error,setError]=useState(''),[ready,setReady]=useState(false),[zoom,setZoom]=useState(5),[visible,setVisible]=useState<VisiblePoint[]>([]);
 const fitted=useRef(false),signature=useRef('');
 const visibleQuery=useRef<ReturnType<typeof createVisibleQuery<VisiblePoint[]>>|null>(null);
 useEffect(()=>{
  const query=createVisibleQuery(async()=>{
   const groups=await Promise.all(capacityStatuses.map(async status=>renderedCapacityPoints(await map.current?.queryRenderedFeatures({layers:capacityLayerIds(status)})||[],status)));
   const unique=new globalThis.Map<string,VisiblePoint>();
   for(const point of groups.flat())unique.set(point.key,point);
   return [...unique.values()].sort((a,b)=>a.key.localeCompare(b.key));
  },values=>{const next=JSON.stringify(values);if(signature.current!==next){signature.current=next;setVisible(values);}});
  visibleQuery.current=query;
  return()=>{query.close();visibleQuery.current=null;};
 },[]);
 const data=useMemo(()=>capacityMapData(items),[items]);
 useEffect(()=>{visibleQuery.current?.invalidate();},[data]);
 const refreshVisible=useCallback(async()=>{
  if(ready)await visibleQuery.current?.refresh();
 },[ready]);
 useEffect(()=>{if(ready&&!loading&&!selected&&!fitted.current){const bounds=signalBounds(items);if(bounds){camera.current?.fitBounds(bounds,{padding:{top:70,right:50,bottom:55,left:50},duration:300});}fitted.current=true;}},[items,loading,ready,selected]);
 if(info&&info.id!==selected?.id)setInfo(null);
 const selectedId=selected?.id,lastSelected=useRef<string|undefined>(undefined);
 useEffect(()=>{
  if(!selected){
   lastSelected.current=undefined;
   if(previousView.current){const view=previousView.current;previousView.current=null;camera.current?.jumpTo({...view,padding:{top:0,right:0,bottom:0,left:0}});}
   return;
  }
  if(ready&&selected.id!==lastSelected.current){
   if(!previousView.current)previousView.current={center:[...latestView.current.center],zoom:latestView.current.zoom,bearing:latestView.current.bearing,pitch:latestView.current.pitch};
   fitted.current=true;const bounds=signalBounds([selected]);
   if(bounds)camera.current?.fitBounds(bounds,{padding:{top:65,right:130,bottom:80,left:48},duration:300});
   lastSelected.current=selected.id;
  }
 },[selected,ready]);
 const paths=useMemo(()=>selected?signalPaths(selected,zoom):[],[selected,zoom]);
 const pathData=useMemo<FeatureCollection<LineString>>(()=>({type:'FeatureCollection',features:paths.map(path=>({type:'Feature',properties:{kind:path.kind,index:paths.indexOf(path)},geometry:{type:'LineString',coordinates:path.points}}))}),[paths]);
 const displayPoints=focusedMarkers(visible,selected?.id,selected?markerLocation(selected):null);
 const offsets=useMemo(()=>capacityMarkerOffsets(visible,zoom),[visible,zoom]);
 const showPoint=async(point:VisiblePoint)=>{
  if(selected){setInfo({id:selected.id,kind:'truck',index:-1});return;}
  if(point.cluster===null){const item=items.find(item=>item.id===point.itemId);if(item){setInfo(null);onSelect(item);}return;}
  if(!point.status)return;
  try{const source=point.status==='EMPTY'?emptySource:partialSource;const expansion=await source.current?.getClusterExpansionZoom(point.cluster);camera.current?.easeTo({center:point.coordinate,zoom:Math.min(20,Math.max(zoom+1,expansion??zoom+2)),duration:350});}catch{setError('Could not open these vehicles. Try zooming in.');}
 };
 const active=info?.id===selected?.id?info:null;
 const measureModal=useCallback(()=>host.current?.measureInWindow((left,top,width,height)=>{if(width&&height)setModalFrame({left,top,width,height});}),[]);
 useEffect(()=>{if(active)measureModal();},[active,measureModal,windowSize.width,windowSize.height]);
 const color=(kind:InfoKind)=>kind==='current'&&selected?.status==='PARTIAL'?'#eab308':colors[kind];
 const label=(kind:InfoKind)=>kind==='truck'?'Vehicle details':kind==='location'?'Approximate location':kind==='regular'?'Regular service':selected?.geometry==='RADIUS'?'Service area':'Capacity route';
 const choices: {kind:InfoKind;index:number}[]=selected?[{kind:'truck',index:-1},...paths.map((path,index)=>({kind:path.kind,index}))]:[];
 const shortLabel=(kind:InfoKind)=>kind==='truck'?'Vehicle':kind==='location'?'Location':kind==='regular'?'Regular service':'Capacity';
 const regular=active?.kind==='regular';
 const regularSignal=regular?selected?.regular[0]:null;
 const area=regular?regularSignal?.geometry==='RADIUS':selected?.geometry==='RADIUS';
 const routeNames=regular?regularSignal?.points:selected?.currentPoints;
 const explanation=area?'The outline marks the service area. These places define its boundary, not a trip.':regular?'This route is served in both directions. Contact the transporter to confirm availability.':'Follow the route in the order shown. Contact the driver to confirm pickup, delivery and available space.';
 return <View ref={host} collapsable={false} onLayout={measureModal} style={styles.map}>
 <Map ref={map} style={styles.map} mapStyle={mapStyle} attribution onDidFailLoadingMap={()=>setError('The map could not load. Check your connection.')} onDidFinishLoadingMap={()=>{setReady(true);setError('');}} onDidFinishRenderingFrame={()=>void refreshVisible()} onRegionIsChanging={event=>{latestView.current=event.nativeEvent;visibleQuery.current?.moving();}} onRegionDidChange={event=>{latestView.current=event.nativeEvent;setZoom(event.nativeEvent.zoom);visibleQuery.current?.settled();}}>
 <Camera ref={camera} initialViewState={{center:[39.5,9],zoom:5}} maxZoom={20}/>
 <GeoJSONSource id="selected-signals" data={pathData} onPress={event=>{event.stopPropagation();const feature=event.nativeEvent.features[0];const kind=feature?.properties?.kind as InfoKind;if(selected&&kind in colors)setInfo({id:selected.id,kind,index:Number(feature?.properties?.index)||0});}}>
 <Layer id="location-outline" type="line" filter={['==',['get','kind'],'location']} paint={{'line-color':'#1a73e8','line-width':4,'line-dasharray':[2,2]}}/>
 <Layer id="current-route" type="line" filter={['==',['get','kind'],'current']} layout={{'line-cap':'round','line-join':'round'}} paint={{'line-color':color('current'),'line-width':5}}/>
 <Layer id="regular-route" type="line" filter={['==',['get','kind'],'regular']} layout={{'line-cap':'round','line-join':'round'}} paint={{'line-color':'#c06620','line-width':4,'line-dasharray':[1,2]}}/>
 </GeoJSONSource>
 {capacityStatuses.map(status=><GeoJSONSource key={status} ref={status==='EMPTY'?emptySource:partialSource} id={capacitySourceIds[status]} data={data[status]} cluster clusterRadius={64} clusterMaxZoom={19}>
 <Layer id={capacityLayerIds(status)[0]} type="circle" layout={{visibility:selected?'none':'visible'}} filter={['has','point_count']} paint={{'circle-radius':29,'circle-opacity':0}}/>
 <Layer id={capacityLayerIds(status)[1]} type="circle" layout={{visibility:selected?'none':'visible'}} filter={['!',['has','point_count']]} paint={{'circle-radius':27,'circle-opacity':0}}/>
 </GeoJSONSource>)}
 {displayPoints.map(point=>{const item=selected||items.find(item=>item.id===point.itemId);if(point.cluster===null&&!item)return null;const status=point.status||item!.status;return <Marker key={point.key} id={point.key} lngLat={point.coordinate} offset={!selected?(offsets[point.key]||[0,0]):[0,0]} onPress={()=>void showPoint(point)}><View accessible accessibilityRole="button" accessibilityLabel={point.cluster!==null?t('{count} {status} vehicles. Zoom in.',{count:point.count,status:t(status==='EMPTY'?'Empty':'Partial')}):`${item!.truck}, ${item!.driver}, ${t(item!.status==='EMPTY'?'Empty':'Partial')}${locationSourceLabel(item!.locationSource)?', '+t(locationSourceLabel(item!.locationSource)):''}${item!.locationIsDemo?', '+t('Demo location'):''}`} style={point.cluster!==null?[styles.cluster,{backgroundColor:capacityColors[status]}]:styles.markerContents}>{point.cluster!==null?<><Text style={[styles.count,{color:status==='PARTIAL'?'#493600':'#fff'}]}>{point.count}</Text><Text style={[styles.clusterStatus,{color:status==='PARTIAL'?'#493600':'#fff'}]}>{t(status==='EMPTY'?'Empty':'Partial')}</Text></>:<><View style={styles.truckWrap}><View style={[styles.truck,{borderColor:selected?'#0c7275':capacityColors[status]},selectedId===item!.id&&styles.selected]}><Image source={{uri:apiOrigin+vehicleConfigurationImage(item!.configuration)}} resizeMode="contain" style={styles.image}/></View>{item!.latitude!==null&&item!.longitude!==null&&locationSourceKind(item!.locationSource)&&<View pointerEvents="none" style={[styles.sourceBadge,{borderColor:locationSourceColor(item!.locationSource)}]}><AppIcon name={item!.locationSource==='GPS'?'gps':item!.locationSource==='MOBILE'?'phone':'manual'} size={13} color={locationSourceColor(item!.locationSource)}/></View>}</View></>}</View></Marker>;})}
 </Map>
 {!!selected&&<ScrollView style={[styles.infoControls,{top:topInset,bottom:bottomInset}]} contentContainerStyle={{gap:6}} showsVerticalScrollIndicator={false}>{choices.map(choice=><Pressable key={`${choice.kind}:${choice.index}`} accessibilityRole="button" accessibilityLabel={t(label(choice.kind))} accessibilityState={{selected:active?.kind===choice.kind}} onPress={()=>setInfo({id:selected.id,...choice})} style={[styles.infoControl,{borderLeftColor:color(choice.kind)},active?.kind===choice.kind&&{backgroundColor:'#f1f7f6',borderColor:color(choice.kind)}]}><Text style={styles.controlLabel}>{t(shortLabel(choice.kind))}</Text><Text style={{fontSize:18,fontWeight:'700',color:color(choice.kind)}}>…</Text></Pressable>)}</ScrollView>}
 {/* Android resolves overlapping native marker rectangles before React handlers. */}
 {!!selected&&<Pressable accessibilityRole="button" accessibilityLabel={t('Back to map')} onPress={()=>{setInfo(null);onDeselect();}} style={[styles.selectionExit,{position:'absolute',left:12,top:topInset}]}><Text style={{fontSize:28,color:'#0c7275'}}>×</Text></Pressable>}
 {!!error&&<Text accessibilityRole="alert" style={[styles.error,{top:topInset+(selected?50:0),right:selected?122:16}]}>{error}</Text>}
 {selected&&active&&<Modal transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={()=>setInfo(null)}><View style={styles.modalBackdrop}><Pressable accessibilityRole="button" accessibilityLabel={t('Close map signal details')} style={StyleSheet.absoluteFill} onPress={()=>setInfo(null)}/><View pointerEvents="box-none" style={[styles.modalPosition,modalFrame]}><View accessibilityViewIsModal style={[styles.infoCard,active.kind==='truck'&&{maxWidth:540}]}><View style={styles.infoHeader}><View style={styles.infoHeading}><View style={[styles.infoAccent,{backgroundColor:color(active.kind)}]}/><Text accessibilityRole="header" style={styles.infoTitle}>{t(label(active.kind))}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={t('Close map signal details')} onPress={()=>setInfo(null)} style={styles.close}><Text style={{fontSize:25,color:'#172c46'}}>×</Text></Pressable></View><ScrollView style={{flexGrow:0,flexShrink:1}} contentContainerStyle={{padding:14,gap:12}}>
 {active.kind==='truck'?<>
 <View style={styles.truckHero}>
  <View style={styles.truckIllustration}><Image source={{uri:apiOrigin+vehicleConfigurationImage(selected.configuration)}} resizeMode="contain" style={{width:'100%',height:58}}/></View>
  <View style={{flex:1,gap:4}}><Text style={[styles.truckStatus,{backgroundColor:selected.status==='EMPTY'?'#eaf8f1':'#fff7d6',color:selected.status==='EMPTY'?'#087443':'#805c00'}]}>{t(selected.status==='EMPTY'?'Empty vehicle':'Partial capacity')}</Text><Text style={styles.summary}>{selected.truck}</Text><Text style={styles.truckConfiguration}>{t(selected.configuration)}</Text></View>
 </View>
 {!!(selected.sharingMode||selected.acceptedLoads)&&<View style={styles.truckFacts}>{!!selected.sharingMode&&<Text style={styles.truckFact}>{t(capacitySharingLabel(selected.sharingMode))}</Text>}{selected.acceptedLoads&&<Text style={styles.truckFact}>{t(capacityLoadLabel(selected.acceptedLoads))}</Text>}</View>}
 <TruckAuthorityBadges authority={selected.authority}/>
 <View style={styles.truckPeople}>
  <View style={styles.truckPerson}><View style={styles.personIdentity}><AppIcon name="profile" size={19} color="#0c7275"/><View style={{flex:1,gap:3}}><Text style={styles.personLabel}>{t('Transport Provider')}</Text><Text style={styles.personName}>{selected.provider}</Text></View></View>{!!selected.handle&&<Link href={{pathname:'/transporter',params:{handle:selected.handle}}} asChild><Pressable accessibilityRole="link" style={styles.profileAction}><Text style={styles.profileActionText}>{t('Profile')}</Text><AppIcon name="external" size={16} color="#0c7275"/></Pressable></Link>}</View>
  <View style={styles.truckPerson}><PublicCardImage path={selected.portrait} label={selected.driver} portrait identity="person"/><View style={styles.personIdentity}><View style={{flex:1,gap:3}}><Text style={styles.personLabel}>{t('Driver')}</Text><Text style={styles.personName}>{selected.driver}</Text></View></View></View>
 </View>
 <View style={styles.truckUpdates}><View style={styles.truckUpdate}><AppIcon name="truck" size={16}/><Text style={styles.truckUpdateText}>{selected.capacityAge}</Text></View>{selected.currentVisible&&<View style={styles.truckUpdate}><AppIcon name="location" size={16} color="#1a73e8"/><Text style={styles.truckUpdateText}>{selected.locationAge}</Text></View>}<Text style={styles.truckUpdateText}>{t('Confirm availability directly.')}</Text></View>
 </>:active.kind==='location'?<><Text style={styles.summary}>{t('Within {distance} km',{distance:selected.precisionKm})}</Text><Text style={styles.infoText}>{t('The transporter chose this location accuracy. This is not an exact or live position.')}</Text>{locationSourceLabel(selected.locationSource)&&<Text style={styles.infoText}>{t(locationSourceLabel(selected.locationSource))}</Text>}<Text style={styles.update}>{selected.locationIsDemo?t('Demo location')+' · ':''}{selected.locationAge}</Text></>:<>
 {regular&&!area&&<Text style={styles.summary}>{t('Regular two-way service')}</Text>}
 {!regular&&<Text style={styles.infoText}>{t(selected.status==='EMPTY'?'Empty vehicle':'Partial capacity')}</Text>}
 <Text style={styles.infoText}>{t(explanation)}</Text>
 <View style={area?styles.areaPlaces:undefined}>{routeNames?.map((point,index)=>area?<Text key={index} style={styles.areaPlace}>{point.label}</Text>:<View key={index}><View style={styles.stop}><Text style={[styles.stopNumber,{borderColor:color(active.kind)}]}>{index+1}</Text><Text style={[styles.infoText,{flex:1,fontWeight:'600'}]}>{point.label}</Text></View>{index<(routeNames?.length||0)-1&&<Text style={[styles.direction,{color:color(active.kind)}]}>{regular?'↕':'↓'}</Text>}</View>)}</View>
 <Text style={styles.update}>{regular?t('Regular service is not a current capacity update.'):selected.capacityAge}</Text>
 </>}

 </ScrollView></View></View></View></Modal>}
 </View>;
}
const styles=StyleSheet.create({
 truckWrap:{position:'relative'},sourceBadge:{position:'absolute',top:-4,left:-4,width:22,height:22,borderRadius:11,borderWidth:1.5,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},
 markerContents:{alignItems:'center',width:96},clusterStatus:{fontSize:10,lineHeight:14,fontWeight:'700'},
 truckFacts:{flexDirection:'row',flexWrap:'wrap',gap:6},truckFact:{fontSize:12,lineHeight:18,color:'#526875',backgroundColor:'#f2f6f6',borderRadius:6,paddingHorizontal:8,paddingVertical:5},
 truckHero:{flexDirection:'row',alignItems:'center',gap:14},truckIllustration:{width:70,height:66,borderRadius:8,borderWidth:1,borderColor:'#e1eaea',backgroundColor:'#f2f7f7',justifyContent:'center'},truckStatus:{alignSelf:'flex-start',fontSize:11,fontWeight:'700',paddingHorizontal:7,paddingVertical:4,borderRadius:6},truckConfiguration:{fontSize:12,lineHeight:17,color:'#526875'},
 truckPeople:{flexDirection:'column',gap:10,paddingVertical:10,borderTopWidth:1,borderBottomWidth:1,borderColor:'#e2ebeb'},truckPerson:{flexDirection:'row',alignItems:'center',gap:10,minHeight:36},personIdentity:{flex:1,flexDirection:'row',alignItems:'flex-start',gap:7},personLabel:{fontSize:11,lineHeight:15,color:'#526875'},personName:{fontSize:14,lineHeight:19,fontWeight:'600',color:'#172c46'},profileAction:{minHeight:44,minWidth:82,borderWidth:1,borderColor:'#bad0d0',borderRadius:8,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,padding:8},profileActionText:{color:'#0c7275',fontSize:13,fontWeight:'700'},
 truckUpdates:{gap:8},truckUpdate:{flexDirection:'row',gap:6,alignItems:'flex-start'},truckUpdateText:{flex:1,fontSize:12,lineHeight:17,color:'#526875'},
 summary:{fontSize:18,lineHeight:24,fontWeight:'700',color:'#172c46'},update:{fontSize:13,lineHeight:19,color:'#526875',paddingTop:10,borderTopWidth:1,borderTopColor:'#e5eded'},stop:{flexDirection:'row',alignItems:'center',gap:10},stopNumber:{width:28,height:28,borderRadius:14,borderWidth:1,textAlign:'center',lineHeight:26,color:'#172c46',fontSize:12},direction:{width:28,textAlign:'center',fontSize:20,lineHeight:24},areaPlaces:{flexDirection:'row',flexWrap:'wrap',gap:6},areaPlace:{borderWidth:1,borderColor:'#dae5e5',borderRadius:6,padding:7,color:'#172c46'},
 infoControls:{position:'absolute',right:8,top:68,width:106,bottom:8},infoControl:{minHeight:44,paddingHorizontal:8,paddingVertical:6,borderWidth:1,borderColor:'#d6e1e1',borderLeftWidth:4,borderRadius:8,backgroundColor:'#fff',flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:4},controlLabel:{fontSize:11,fontWeight:'700',color:'#172c46',flex:1},
 selectionExit:{width:44,height:44,borderRadius:22,borderWidth:2,borderColor:'#0c7275',backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},
 modalBackdrop:{flex:1,backgroundColor:'rgba(23,44,70,0.22)'},modalPosition:{position:'absolute',alignItems:'center',justifyContent:'center',padding:16},
 infoCard:{width:'100%',maxWidth:430,maxHeight:'100%',borderWidth:1,borderColor:'#cbdadb',borderRadius:12,backgroundColor:'#fff',overflow:'hidden'},infoHeader:{minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingLeft:14,borderBottomWidth:1,borderBottomColor:'#e5eded'},infoHeading:{flex:1,flexDirection:'row',alignItems:'center',gap:8},infoAccent:{width:4,height:18,borderRadius:2},infoTitle:{fontSize:14,lineHeight:20,fontWeight:'700',color:'#172c46',flexShrink:1},infoText:{fontSize:15,lineHeight:22,color:'#526875'},close:{width:44,height:44,alignItems:'center',justifyContent:'center'},profile:{color:'#0c7275',fontWeight:'700',minHeight:44,paddingVertical:12},
map:{flex:1,overflow:'hidden'},error:{position:'absolute',top:62,left:16,right:16,padding:12,backgroundColor:'#fff',color:'#8b2525',borderRadius:12},cluster:{width:58,height:58,borderRadius:29,backgroundColor:'#16a34a',alignItems:'center',justifyContent:'center',borderWidth:3,borderColor:'#fff'},count:{fontSize:15,fontWeight:'700',color:'#fff'},truck:{width:54,height:54,borderRadius:27,borderWidth:3,backgroundColor:'#fff',alignItems:'center',justifyContent:'center',overflow:'hidden'},selected:{width:70,height:70,borderRadius:35,borderWidth:4},image:{width:'95%',height:'90%'},legend:{position:'absolute',bottom:12,left:12,right:12,alignItems:'center'},legendText:{backgroundColor:'#ffffffee',color:'#334b58',fontSize:11,padding:7,borderRadius:8}});

// Draft typing and opening unrelated controls do not rebuild native map layers.
export default memo(CapacityMap);
