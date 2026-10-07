import {Link} from 'expo-router';
import {useLanguage} from '../localization/provider';
import {focusedMarkers,type MapPoint} from '../map/focused-markers';
import { mapStyle } from './map-style';
import {AppIcon} from './app-icon';
import { memo,useCallback,useEffect,useMemo,useRef,useState } from 'react';
import { Modal,useWindowDimensions,Image,Pressable,ScrollView,StyleSheet,Text,View } from 'react-native';
import { Map,Camera,GeoJSONSource,Layer,Marker,type CameraRef,type GeoJSONSourceRef,type MapRef,type ViewState } from './map-platform';
import type { Feature,FeatureCollection,LineString,Point } from 'geojson';
import type { CapacitySignal } from '../api/public-capacity';
import { markerLocation,separateMarkers,signalBounds,signalPaths,type LngLat } from '../map/capacity-geometry';
import { vehicleConfigurationImage } from '../../../../src/lib/vehicle-configurations';
import { apiOrigin } from '../api/http';
type VisiblePoint=MapPoint;
const colors={truck:'#0c7275',location:'#1a73e8',current:'#16a34a',regular:'#c06620'};
type InfoKind=keyof typeof colors;
function CapacityMap({items,onSelect,onDeselect,selected=null,loading=false}:{items:CapacitySignal[];onSelect:(item:CapacitySignal)=>void;onDeselect:()=>void;selected?:CapacitySignal|null;loading?:boolean}) {
 const {t}=useLanguage();
 const host=useRef<View>(null),windowSize=useWindowDimensions();
 const [modalFrame,setModalFrame]=useState({left:0,top:0,width:windowSize.width,height:windowSize.height});
 const latestView=useRef<Pick<ViewState,'center'|'zoom'|'bearing'|'pitch'>>({center:[39.5,9],zoom:5,bearing:0,pitch:0});
 const previousView=useRef<typeof latestView.current|null>(null);
 const [info,setInfo]=useState<{id:string;kind:InfoKind;index:number}|null>(null);
 const camera=useRef<CameraRef>(null),source=useRef<GeoJSONSourceRef>(null),map=useRef<MapRef>(null);
 const [error,setError]=useState(''),[ready,setReady]=useState(false),[zoom,setZoom]=useState(5),[visible,setVisible]=useState<VisiblePoint[]>([]);
 const fitted=useRef(false),alive=useRef(true),querying=useRef(false),lastQuery=useRef(0),signature=useRef(''),dataEpoch=useRef(0);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const data=useMemo<FeatureCollection<Point>>(()=>({type:'FeatureCollection',features:items.flatMap(item=>{const coordinate=markerLocation(item);return coordinate?[{type:'Feature' as const,id:item.id,properties:{id:item.id,status:item.status},geometry:{type:'Point' as const,coordinates:coordinate}}]:[];})}),[items]);
 useEffect(()=>{dataEpoch.current++;},[data]);
 const refreshVisible=useCallback(async()=>{
  if(!ready||querying.current||Date.now()-lastQuery.current<200)return;
  querying.current=true;lastQuery.current=Date.now();const epoch=dataEpoch.current;
  try{const features=await map.current?.queryRenderedFeatures({layers:['capacity-clusters','capacity-trucks']});if(!features||!alive.current||epoch!==dataEpoch.current)return;
   const unique=new globalThis.Map<string,VisiblePoint>();
   for(const f of features){if(f.geometry.type!=='Point')continue;const cluster=f.properties?.cluster?Number(f.properties.cluster_id):null,key=cluster===null?`truck:${f.properties?.id}`:`cluster:${cluster}`;unique.set(key,{key,cluster,count:Number(f.properties?.point_count)||1,itemId:String(f.properties?.id||''),coordinate:f.geometry.coordinates as LngLat});}
   const values=[...unique.values()].sort((a,b)=>a.key.localeCompare(b.key)),next=JSON.stringify(values);if(signature.current!==next){signature.current=next;setVisible(values);}
  }catch{/* A style/source may be between frames; retry after it renders. */}finally{querying.current=false;}
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
 const offsets=useMemo(()=>separateMarkers(visible.filter(point=>point.cluster===null).map(point=>({id:point.itemId,coordinate:point.coordinate})),zoom),[visible,zoom]);
 const showPoint=async(point:VisiblePoint)=>{
  if(selected){setInfo({id:selected.id,kind:'truck',index:-1});return;}
  if(point.cluster===null){const item=items.find(item=>item.id===point.itemId);if(item){setInfo(null);onSelect(item);}return;}
  try{const expansion=await source.current?.getClusterExpansionZoom(point.cluster);camera.current?.easeTo({center:point.coordinate,zoom:Math.min(20,Math.max(zoom+1,expansion??zoom+2)),duration:350});}catch{setError('Could not open these trucks. Try zooming in.');}
 };
 const selectFeature=(feature:Feature|undefined)=>{if(!feature||feature.geometry.type!=='Point')return;void showPoint({key:'',coordinate:feature.geometry.coordinates as LngLat,cluster:feature.properties?.cluster?Number(feature.properties.cluster_id):null,count:Number(feature.properties?.point_count)||1,itemId:String(feature.properties?.id||'')});};
 const active=info?.id===selected?.id?info:null;
 const measureModal=useCallback(()=>host.current?.measureInWindow((left,top,width,height)=>{if(width&&height)setModalFrame({left,top,width,height});}),[]);
 useEffect(()=>{if(active)measureModal();},[active,measureModal,windowSize.width,windowSize.height]);
 const color=(kind:InfoKind)=>kind==='current'&&selected?.status==='PARTIAL'?'#eab308':colors[kind];
 const label=(kind:InfoKind)=>kind==='truck'?'Truck details':kind==='location'?'Approximate location':kind==='regular'?'Regular service':selected?.geometry==='RADIUS'?'Service area':'Capacity route';
 const choices: {kind:InfoKind;index:number}[]=selected?[{kind:'truck',index:-1},...paths.map((path,index)=>({kind:path.kind,index}))]:[];
 const shortLabel=(kind:InfoKind)=>kind==='truck'?'Truck':kind==='location'?'Location':kind==='regular'?'Regular service':'Capacity';
 const regular=active?.kind==='regular';
 const regularSignal=regular?selected?.regular[0]:null;
 const area=regular?regularSignal?.geometry==='RADIUS':selected?.geometry==='RADIUS';
 const routeNames=regular?regularSignal?.points:selected?.currentPoints;
 const explanation=area?'The outline marks the service area. These places define its boundary, not a trip.':regular?'This route is served in both directions. Contact the transporter to confirm availability.':'Follow the route in the order shown. Contact the driver to confirm pickup, delivery and available space.';
 return <View ref={host} collapsable={false} onLayout={measureModal} style={styles.map}>
 <Map ref={map} style={styles.map} mapStyle={mapStyle} attribution onDidFailLoadingMap={()=>setError('The map could not load. Check your connection.')} onDidFinishLoadingMap={()=>{setReady(true);setError('');}} onDidFinishRenderingFrame={()=>void refreshVisible()} onRegionIsChanging={event=>{latestView.current=event.nativeEvent;}} onRegionDidChange={event=>{latestView.current=event.nativeEvent;setZoom(event.nativeEvent.zoom);void refreshVisible();}}>
 <Camera ref={camera} initialViewState={{center:[39.5,9],zoom:5}} maxZoom={20}/>
 <GeoJSONSource id="selected-signals" data={pathData} onPress={event=>{event.stopPropagation();const feature=event.nativeEvent.features[0];const kind=feature?.properties?.kind as InfoKind;if(selected&&kind in colors)setInfo({id:selected.id,kind,index:Number(feature?.properties?.index)||0});}}>
 <Layer id="location-outline" type="line" filter={['==',['get','kind'],'location']} paint={{'line-color':'#1a73e8','line-width':4,'line-dasharray':[2,2]}}/>
 <Layer id="current-route" type="line" filter={['==',['get','kind'],'current']} layout={{'line-cap':'round','line-join':'round'}} paint={{'line-color':color('current'),'line-width':5}}/>
 <Layer id="regular-route" type="line" filter={['==',['get','kind'],'regular']} layout={{'line-cap':'round','line-join':'round'}} paint={{'line-color':'#c06620','line-width':4,'line-dasharray':[1,2]}}/>
 </GeoJSONSource>
 <GeoJSONSource ref={source} id="capacity" data={data} cluster clusterRadius={52} clusterMaxZoom={19} onPress={event=>{event.stopPropagation();selectFeature(event.nativeEvent.features[0]);}}>
 <Layer id="capacity-clusters" type="circle" layout={{visibility:selected?'none':'visible'}} filter={['has','point_count']} paint={{'circle-radius':22,'circle-color':'#0c7275','circle-stroke-color':'#fff','circle-stroke-width':3}}/>
 <Layer id="capacity-trucks" type="circle" layout={{visibility:selected?'none':'visible'}} filter={['!',['has','point_count']]} paint={{'circle-radius':10,'circle-color':['match',['get','status'],'EMPTY','#16845b','#e5ac00'],'circle-stroke-color':'#fff','circle-stroke-width':3}}/>
 </GeoJSONSource>
 {displayPoints.map(point=>{const item=selected||items.find(item=>item.id===point.itemId);if(point.cluster===null&&!item)return null;return <Marker key={point.key} id={point.key} lngLat={point.coordinate} offset={!selected&&point.cluster===null?(offsets[point.itemId]||[0,0]):[0,0]} onPress={()=>void showPoint(point)}><View accessible accessibilityRole="button" accessibilityLabel={point.cluster!==null?`${point.count} trucks. Zoom in.`:`${item!.truck}, ${item!.driver}, ${item!.status==='EMPTY'?'Empty':'Partial'}`} style={point.cluster!==null?styles.cluster:[styles.truck,{borderColor:selected?'#0c7275':item!.status==='EMPTY'?'#16845b':'#e5ac00'},selectedId===item!.id&&styles.selected]}>{point.cluster!==null?<Text style={styles.count}>{point.count}</Text>:<Image source={{uri:apiOrigin+vehicleConfigurationImage(item!.configuration)}} resizeMode="contain" style={styles.image}/>}</View></Marker>;})}
 {selected&&markerLocation(selected)&&<Marker id="selected-truck-exit" lngLat={markerLocation(selected)!} offset={[37,-22]} onPress={onDeselect}><View accessible accessibilityRole="button" accessibilityLabel={t('Back to map')} style={styles.selectionExit}><Text style={{fontSize:28,color:'#0c7275'}}>×</Text></View></Marker>}
 </Map>
 {!!selected&&<ScrollView style={styles.infoControls} contentContainerStyle={{gap:6}} showsVerticalScrollIndicator={false}>{choices.map(choice=><Pressable key={`${choice.kind}:${choice.index}`} accessibilityRole="button" accessibilityLabel={t(label(choice.kind))} accessibilityState={{selected:active?.kind===choice.kind}} onPress={()=>setInfo({id:selected.id,...choice})} style={[styles.infoControl,{borderLeftColor:color(choice.kind)},active?.kind===choice.kind&&{backgroundColor:'#f1f7f6',borderColor:color(choice.kind)}]}><Text style={styles.controlLabel}>{t(shortLabel(choice.kind))}</Text><Text style={{fontSize:18,fontWeight:'700',color:color(choice.kind)}}>…</Text></Pressable>)}</ScrollView>}
 {!!selected&&!markerLocation(selected)&&<Pressable accessibilityRole="button" accessibilityLabel={t('Back to map')} onPress={onDeselect} style={[styles.selectionExit,{position:'absolute',left:12,top:68}]}><Text style={{fontSize:28,color:'#0c7275'}}>×</Text></Pressable>}
 {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
 {selected&&active&&<Modal transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={()=>setInfo(null)}><View style={styles.modalBackdrop}><Pressable accessibilityRole="button" accessibilityLabel={t('Close map signal details')} style={StyleSheet.absoluteFill} onPress={()=>setInfo(null)}/><View pointerEvents="box-none" style={[styles.modalPosition,modalFrame]}><View accessibilityViewIsModal style={[styles.infoCard,{borderColor:color(active.kind)},active.kind==='truck'&&{maxWidth:540}]}><View style={styles.infoHeader}><Text style={styles.infoTitle}>{t(label(active.kind))}</Text><Pressable accessibilityRole="button" accessibilityLabel={t('Close map signal details')} onPress={()=>setInfo(null)} style={styles.close}><Text style={{fontSize:25,color:'#172c46'}}>×</Text></Pressable></View><ScrollView style={{flexGrow:0,flexShrink:1}} contentContainerStyle={{padding:18,gap:12}}>
 {active.kind==='truck'?<>
 <View style={styles.truckHero}>
  <View style={styles.truckIllustration}><Image source={{uri:apiOrigin+vehicleConfigurationImage(selected.configuration)}} resizeMode="contain" style={{width:'100%',height:72}}/></View>
  <View style={{flex:1,gap:4}}><Text style={[styles.truckStatus,{backgroundColor:selected.status==='EMPTY'?'#eaf8f1':'#fff7d6',color:selected.status==='EMPTY'?'#087443':'#805c00'}]}>{t(selected.status==='EMPTY'?'Empty truck':'Partial capacity')}</Text><Text style={styles.summary}>{selected.truck}</Text><Text style={styles.truckConfiguration}>{t(selected.configuration)}</Text></View>
 </View>
 <View style={styles.truckPeople}>
  <View style={styles.truckPerson}><View style={styles.personIdentity}><AppIcon name="profile" size={19} color="#0c7275"/><View style={{flex:1,gap:3}}><Text style={styles.personLabel}>{t('Transporter')}</Text><Text style={styles.personName}>{selected.provider}</Text></View></View>{!!selected.handle&&<Link href={{pathname:'/transporter',params:{handle:selected.handle}}} asChild><Pressable accessibilityRole="link" style={styles.profileAction}><Text style={styles.profileActionText}>{t('Profile')}</Text><AppIcon name="external" size={16} color="#0c7275"/></Pressable></Link>}</View>
  <View style={styles.truckPerson}><View style={styles.personIdentity}><AppIcon name="user" size={19} color="#0c7275"/><View style={{flex:1,gap:3}}><Text style={styles.personLabel}>{t('Driver')}</Text><Text style={styles.personName}>{selected.driver}</Text></View></View></View>
 </View>
 <View style={styles.truckUpdates}><View style={styles.truckUpdate}><AppIcon name="truck" size={16}/><Text style={styles.truckUpdateText}>{selected.capacityAge}</Text></View>{selected.currentVisible&&<View style={styles.truckUpdate}><AppIcon name="location" size={16} color="#1a73e8"/><Text style={styles.truckUpdateText}>{selected.locationAge}</Text></View>}</View>
 </>:active.kind==='location'?<><Text style={styles.summary}>{t('Within {distance} km',{distance:selected.precisionKm})}</Text><Text style={styles.infoText}>{t('The transporter chose this location accuracy. This is not an exact or live position.')}</Text><Text style={styles.update}>{selected.locationAge}</Text></>:<>
 {regular&&!area&&<Text style={styles.summary}>{t('Regular two-way service')}</Text>}
 {!regular&&<Text style={styles.infoText}>{t(selected.status==='EMPTY'?'Empty truck':'Partial capacity')}</Text>}
 <Text style={styles.infoText}>{t(explanation)}</Text>
 <View style={area?styles.areaPlaces:undefined}>{routeNames?.map((point,index)=>area?<Text key={index} style={styles.areaPlace}>{point.label}</Text>:<View key={index}><View style={styles.stop}><Text style={[styles.stopNumber,{borderColor:color(active.kind)}]}>{index+1}</Text><Text style={[styles.infoText,{flex:1,fontWeight:'600'}]}>{point.label}</Text></View>{index<(routeNames?.length||0)-1&&<Text style={[styles.direction,{color:color(active.kind)}]}>{regular?'↕':'↓'}</Text>}</View>)}</View>
 <Text style={styles.update}>{regular?t('Regular service is not a current capacity update.'):selected.capacityAge}</Text>
 </>}

 </ScrollView></View></View></View></Modal>}
 </View>;
}
const styles=StyleSheet.create({
 truckHero:{flexDirection:'row',alignItems:'center',gap:14},truckIllustration:{width:86,height:80,borderRadius:12,borderWidth:1,borderColor:'#e1eaea',backgroundColor:'#f2f7f7',justifyContent:'center'},truckStatus:{alignSelf:'flex-start',fontSize:11,fontWeight:'700',paddingHorizontal:7,paddingVertical:4,borderRadius:6},truckConfiguration:{fontSize:12,lineHeight:17,color:'#526875'},
 truckPeople:{flexDirection:'row',gap:14,paddingVertical:12,borderTopWidth:1,borderBottomWidth:1,borderColor:'#e2ebeb'},truckPerson:{flex:1,gap:8},personIdentity:{flexDirection:'row',alignItems:'flex-start',gap:7},personLabel:{fontSize:11,lineHeight:15,color:'#526875'},personName:{fontSize:14,lineHeight:19,fontWeight:'600',color:'#172c46'},profileAction:{minHeight:44,borderWidth:1,borderColor:'#bad0d0',borderRadius:8,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,padding:8},profileActionText:{color:'#0c7275',fontSize:13,fontWeight:'700'},
 truckUpdates:{flexDirection:'row',gap:12},truckUpdate:{flex:1,flexDirection:'row',gap:6,alignItems:'flex-start'},truckUpdateText:{flex:1,fontSize:12,lineHeight:17,color:'#526875'},
 summary:{fontSize:19,lineHeight:25,fontWeight:'700',color:'#172c46'},update:{fontSize:13,lineHeight:19,color:'#526875',paddingTop:10,borderTopWidth:1,borderTopColor:'#e5eded'},stop:{flexDirection:'row',alignItems:'center',gap:10},stopNumber:{width:28,height:28,borderRadius:14,borderWidth:1,textAlign:'center',lineHeight:26,color:'#172c46',fontSize:12},direction:{width:28,textAlign:'center',fontSize:20,lineHeight:24},areaPlaces:{flexDirection:'row',flexWrap:'wrap',gap:6},areaPlace:{borderWidth:1,borderColor:'#dae5e5',borderRadius:6,padding:7,color:'#172c46'},
 infoControls:{position:'absolute',right:8,top:68,width:106,bottom:8},infoControl:{minHeight:44,paddingHorizontal:8,paddingVertical:6,borderWidth:1,borderColor:'#d6e1e1',borderLeftWidth:4,borderRadius:8,backgroundColor:'#fff',flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:4},controlLabel:{fontSize:11,fontWeight:'700',color:'#172c46',flex:1},
 selectionExit:{width:44,height:44,borderRadius:22,borderWidth:2,borderColor:'#0c7275',backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},
 modalBackdrop:{flex:1,backgroundColor:'rgba(23,44,70,0.22)'},modalPosition:{position:'absolute',alignItems:'center',justifyContent:'center',padding:16},
 infoCard:{width:'100%',maxWidth:430,maxHeight:'100%',borderWidth:2,borderRadius:12,backgroundColor:'#fff',overflow:'hidden'},infoHeader:{minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingLeft:12,borderBottomWidth:1,borderBottomColor:'#e5eded'},infoTitle:{fontSize:14,fontWeight:'700',color:'#172c46',flexShrink:1},infoText:{fontSize:15,lineHeight:22,color:'#526875'},close:{width:44,height:44,alignItems:'center',justifyContent:'center'},profile:{color:'#0c7275',fontWeight:'700',minHeight:44,paddingVertical:12},
map:{flex:1,overflow:'hidden'},error:{position:'absolute',top:62,left:16,right:16,padding:12,backgroundColor:'#fff',color:'#8b2525',borderRadius:12},cluster:{width:44,height:44,borderRadius:22,backgroundColor:'#0c7275',alignItems:'center',justifyContent:'center',borderWidth:3,borderColor:'#fff'},count:{fontSize:15,fontWeight:'700',color:'#fff'},truck:{width:54,height:54,borderRadius:27,borderWidth:3,backgroundColor:'#fff',alignItems:'center',justifyContent:'center',overflow:'hidden'},selected:{width:70,height:70,borderRadius:35,borderWidth:4},image:{width:'95%',height:'90%'},legend:{position:'absolute',bottom:12,left:12,right:12,alignItems:'center'},legendText:{backgroundColor:'#ffffffee',color:'#334b58',fontSize:11,padding:7,borderRadius:8}});

// Draft typing and opening unrelated controls do not rebuild native map layers.
export default memo(CapacityMap);
