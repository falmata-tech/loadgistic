import {capacityJourneyInput} from '../../../../src/lib/capacity-journey.js';
import {CapacityTruckContact,CapacityTruckDetails} from './capacity-truck-details';
import {BusinessCargoSpacePhoto} from './business-cargo-space-photo';
import {capacityDetailFrame} from '../map/capacity-detail-frame';
import {useLanguage} from '../localization/provider';
import {focusedMarkers,type MapPoint} from '../map/focused-markers';
import {capacityMapData,capacityStatuses,capacityColors,capacitySourceIds,capacityLayerIds,renderedCapacityPoints,capacityMarkerOffsets} from '../map/capacity-clusters';
import {DEFAULT_CAPACITY_CAMERA,initialCapacityCamera} from '../../../../src/lib/map-initial-camera.js';
import { mapStyle } from './map-style';
import {AppIcon} from './app-icon';
import {locationSourceKind,locationSourceLabel,locationSourceColor} from '../../../../src/lib/location-source.js';
import { memo,useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState } from 'react';
import { FlatList,Modal,useWindowDimensions,Image,Pressable,ScrollView,StyleSheet,Text,View } from 'react-native';
import { Map,Camera,GeoJSONSource,Layer,Marker,type CameraRef,type GeoJSONSourceRef,type MapRef,type ViewState } from './map-platform';
import type { FeatureCollection,LineString,Polygon } from 'geojson';
import type { CapacitySignal } from '../api/public-capacity';
import { markerLocation,signalBounds,signalPaths } from '../map/capacity-geometry';
import {createVisibleQuery} from '../map/visible-query';
import {createCapacityCameraIntent,expandCapacityCluster,type CapacityCameraIntent} from '../map/capacity-camera-intent';
import {locationRadiusMinimumZoom} from '../../../../src/lib/map-signal-offset.js';
import {availableSpacePercent,emptyShipmentPreferenceLabel} from '../../../../src/lib/capacity-space-estimate.js';
import { vehicleConfigurationImage } from '../../../../src/lib/vehicle-configurations';
import { apiOrigin } from '../api/http';
import {palette} from './ui';
import {capacityMapColors,capacityStatusPresentation} from '../theme/capacity-status-presentation';
import {localizedUpdateLabel} from '../../../../src/lib/i18n/update-label.js';
type VisiblePoint=MapPoint;
const colors={truck:capacityMapColors.selection,location:capacityMapColors.selectedLocation,current:capacityMapColors.planned,regular:capacityMapColors.selectedPreferred};
const EXPO_CAPACITY_CAMERA={...DEFAULT_CAPACITY_CAMERA,zoom:DEFAULT_CAPACITY_CAMERA.zoom-1};
const INFO_CONTROL_WIDTH=116;
const INFO_CONTROL_RIGHT=8;
const INFO_CONTROL_CLEARANCE=INFO_CONTROL_WIDTH+INFO_CONTROL_RIGHT+8;
const MAX_CAPACITY_ZOOM=20;
const NO_OWN_SIGNALS:string[]=[];
const ownSourceId=(status:'EMPTY'|'PARTIAL')=>`${capacitySourceIds[status]}-own`;
const ownLayerIds=(status:'EMPTY'|'PARTIAL')=>[`${ownSourceId(status)}-clusters`,`${ownSourceId(status)}-trucks`];
type InfoKind=keyof typeof colors;
type ClusterPicker={label:string;vehicles:CapacitySignal[]};
function CapacityMap({items,ownSignalIds=NO_OWN_SIGNALS,onSelect,onDeselect,selected=null,loading=false,topInset=68,bottomInset=8,privatePhotoWorkspaceId}:{items:CapacitySignal[];ownSignalIds?:string[];onSelect:(item:CapacitySignal)=>void;onDeselect:()=>void;selected?:CapacitySignal|null;loading?:boolean;topInset?:number;bottomInset?:number;privatePhotoWorkspaceId?:string}) {
 const {t}=useLanguage();
 const host=useRef<View>(null),windowSize=useWindowDimensions();
 const [modalFrame,setModalFrame]=useState({left:0,top:0,width:windowSize.width,height:windowSize.height});
 const latestView=useRef<Pick<ViewState,'center'|'zoom'|'bearing'|'pitch'>>({center:[39.5,9],zoom:5,bearing:0,pitch:0});
 const cameraIntent=useRef<CapacityCameraIntent|null>(null);
 useLayoutEffect(()=>{const intent=createCapacityCameraIntent();cameraIntent.current=intent;return()=>{intent.close();cameraIntent.current=null;};},[]);
 const previousView=useRef<typeof latestView.current|null>(null);
 const [info,setInfo]=useState<{id:string;kind:InfoKind;index:number}|null>(null);
 const [picker,setPicker]=useState<ClusterPicker|null>(null);
 const [legendOpen,setLegendOpen]=useState(false);
 const camera=useRef<CameraRef>(null),emptySource=useRef<GeoJSONSourceRef>(null),partialSource=useRef<GeoJSONSourceRef>(null),ownEmptySource=useRef<GeoJSONSourceRef>(null),ownPartialSource=useRef<GeoJSONSourceRef>(null),map=useRef<MapRef>(null);
 const [error,setError]=useState(''),[ready,setReady]=useState(false),[zoom,setZoom]=useState(5),[visible,setVisible]=useState<VisiblePoint[]>([]);
 const fitted=useRef(false),signature=useRef('');
 const visibleQuery=useRef<ReturnType<typeof createVisibleQuery<VisiblePoint[]>>|null>(null);
 useEffect(()=>{
  const query=createVisibleQuery(async()=>{
   const groups=await Promise.all(capacityStatuses.flatMap(status=>[false,true].map(async mine=>renderedCapacityPoints(await map.current?.queryRenderedFeatures({layers:mine?ownLayerIds(status):capacityLayerIds(status)})||[],status,mine))));
   const unique=new globalThis.Map<string,VisiblePoint>();
   for(const point of groups.flat())unique.set(point.key,point);
   return [...unique.values()].sort((a,b)=>a.key.localeCompare(b.key));
  },values=>{const next=JSON.stringify(values);if(signature.current!==next){signature.current=next;setVisible(values);}});
  visibleQuery.current=query;
  return()=>{query.close();visibleQuery.current=null;};
 },[]);
 const ownIds=useMemo(()=>new Set(ownSignalIds),[ownSignalIds]);
 const data=useMemo(()=>capacityMapData(items.filter(item=>!ownIds.has(item.id))),[items,ownIds]);
 const ownData=useMemo(()=>capacityMapData(items.filter(item=>ownIds.has(item.id))),[items,ownIds]);
 const selectedId=selected?.id;
 const selectedIdentity=selected?.vehicleId||selectedId;
 const [pickerScope,setPickerScope]=useState({data,ownData,selectedId});
 if(pickerScope.data!==data||pickerScope.ownData!==ownData||pickerScope.selectedId!==selectedId){
  setPickerScope({data,ownData,selectedId});
  setPicker(null);
 }
 useLayoutEffect(()=>{cameraIntent.current?.invalidate();},[data,ownData,selectedId]);
 const initialCamera=useMemo(()=>initialCapacityCamera(items.map(item=>{const point=markerLocation(item);return point?{latitude:point[1],longitude:point[0]}:null;}),{zoom:EXPO_CAPACITY_CAMERA.zoom,fallback:EXPO_CAPACITY_CAMERA}),[items]);
 useEffect(()=>{visibleQuery.current?.invalidate();},[data,ownData]);
 const refreshVisible=useCallback(async()=>{
  if(ready)await visibleQuery.current?.refresh();
 },[ready]);
 useEffect(()=>{if(ready&&!loading&&!selected&&!fitted.current&&cameraIntent.current?.canCenterInitially()){camera.current?.jumpTo({center:[initialCamera.longitude,initialCamera.latitude],zoom:initialCamera.zoom});fitted.current=true;}},[initialCamera,loading,ready,selected]);
 if(info&&info.id!==selectedIdentity)setInfo(null);
 const lastSelected=useRef<string|undefined>(undefined);
 useEffect(()=>{
  if(!selected){
   lastSelected.current=undefined;
   if(previousView.current){const view=previousView.current;previousView.current=null;camera.current?.jumpTo({...view,padding:{top:0,right:0,bottom:0,left:0}});}
   return;
  }
  if(ready&&selectedIdentity!==lastSelected.current){
   if(!previousView.current)previousView.current={center:[...latestView.current.center],zoom:latestView.current.zoom,bearing:latestView.current.bearing,pitch:latestView.current.pitch};
   fitted.current=true;const bounds=signalBounds([selected]);
   if(bounds)camera.current?.fitBounds(bounds,{padding:{top:65,right:INFO_CONTROL_CLEARANCE,bottom:80,left:48},duration:300});
   lastSelected.current=selectedIdentity;
  }
 },[selected,ready,selectedIdentity]);
 const paths=useMemo(()=>selected?signalPaths(selected,zoom):[],[selected,zoom]);
 const showRadius=selected?.latitude!=null&&zoom>=locationRadiusMinimumZoom(selected.latitude,selected.precisionKm,512);
 const radius=showRadius?paths.find(path=>path.kind==='location'):undefined;
 const radiusData=useMemo<FeatureCollection<Polygon>>(()=>({
  type:'FeatureCollection',features:radius?[{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[radius.points]}}]:[]
 }),[radius]);
 const pathData=useMemo<FeatureCollection<LineString>>(()=>({
  type:'FeatureCollection',features:paths.flatMap((path,index)=>path.kind==='location'&&!radius?[]:[
   {type:'Feature',properties:{kind:path.kind,index},geometry:{type:'LineString',coordinates:path.points}}
  ])
 }),[paths,radius]);
 const displayPoints=focusedMarkers(visible,selected?.id,selected?markerLocation(selected):null);
 const offsets=useMemo(()=>capacityMarkerOffsets(visible,zoom),[visible,zoom]);
 const selectVehicle=(item:CapacitySignal)=>{
  setPicker(null);
  setInfo(null);
  onSelect(item);
 };
 const clusterLabel=(status:CapacitySignal['status'],count:number,mine?:boolean)=>
  `${mine?t('Your vehicles')+' · ':''}${t(status==='PARTIAL'?'{count} partly loaded vehicles':'{count} empty vehicles',{count})}`;
 const showPoint=async(point:VisiblePoint)=>{
  cameraIntent.current?.gesture();
  if(selected){setInfo({id:selectedIdentity!,kind:'truck',index:-1});return;}
  if(point.cluster===null){
   const item=items.find(candidate=>candidate.id===point.itemId);
   if(item)selectVehicle(item);
   return;
  }
  const {status,cluster}=point;
  const intent=cameraIntent.current;
  if(!status||!intent)return;
  const source=(point.mine?(status==='EMPTY'?ownEmptySource:ownPartialSource):(status==='EMPTY'?emptySource:partialSource)).current;
  const failed=()=>setError(t('Could not open these vehicles. Try again.'));
  if(latestView.current.zoom<MAX_CAPACITY_ZOOM){
   await expandCapacityCluster(intent,async()=>source?.getClusterExpansionZoom(cluster),expansion=>{
    setError('');
    const currentZoom=latestView.current.zoom;
    const nextZoom=Math.min(MAX_CAPACITY_ZOOM,currentZoom+2,Math.max(currentZoom+1,expansion??currentZoom+2));
    camera.current?.easeTo({center:point.coordinate,zoom:nextZoom,duration:350});
   },failed);
   return;
  }
  await expandCapacityCluster(intent,async()=>{
   const leaves=await source?.getClusterLeaves(cluster,point.count,0);
   if(leaves?.length!==point.count)throw Error('Cluster changed');
   const byId=new globalThis.Map(items.map(item=>[item.id,item]));
   const vehicles=new globalThis.Map<string,CapacitySignal>();
   for(const leaf of leaves){
    const id=leaf.properties?.id;
    const item=typeof id==='string'?byId.get(id):undefined;
    const coordinate=item&&markerLocation(item);
    const sourcePoint=leaf.geometry.type==='Point'?leaf.geometry.coordinates:null;
    if(!item||item.status!==status||ownIds.has(item.id)!==Boolean(point.mine)||!coordinate||
      sourcePoint?.length!==2||Math.abs(sourcePoint[0]-coordinate[0])>1e-6||Math.abs(sourcePoint[1]-coordinate[1])>1e-6)throw Error('Cluster changed');
    vehicles.set(item.id,item);
   }
   if(vehicles.size!==point.count)throw Error('Cluster changed');
   return [...vehicles.values()];
  },vehicles=>{
   setError('');
   setPicker({label:clusterLabel(status,point.count,point.mine),vehicles});
  },failed);
 };
 const observeView=(view:Pick<ViewState,'center'|'zoom'|'bearing'|'pitch'>,userInteraction:boolean)=>{
  const previous=latestView.current;
  if(view.zoom!==previous.zoom||view.bearing!==previous.bearing||view.pitch!==previous.pitch||view.center[0]!==previous.center[0]||view.center[1]!==previous.center[1]){
   setPicker(null);
   if(userInteraction)cameraIntent.current?.gesture();else cameraIntent.current?.invalidate();
  }
  latestView.current=view;
 };
 const active=info?.id===selectedIdentity?info:null;
 const detailFrame=active?.kind==='truck'?capacityDetailFrame(modalFrame,windowSize):modalFrame;
 const measureModal=useCallback(()=>host.current?.measureInWindow((left,top,width,height)=>{if(width&&height)setModalFrame({left,top,width,height});}),[]);
 useEffect(()=>{if(active)measureModal();},[active,measureModal,windowSize.width,windowSize.height]);
 const label=(kind:InfoKind)=>kind==='truck'?'Vehicle details':kind==='location'?'Approximate location':kind==='regular'?(selected?.regular[0]?.geometry==='RADIUS'?'Preferred area':'Preferred route'):'Planned route';
 const choices: {kind:InfoKind;index:number}[]=selected?[{kind:'truck',index:-1},...paths.map((path,index)=>({kind:path.kind,index}))]:[];
 const actionLabel=(kind:InfoKind)=>kind==='truck'?'Vehicle and driver':label(kind);
 const selectedSpace=availableSpacePercent(selected?.status,selected?.availablePercent,selected?.availablePercentReportedAt);
 const regular=active?.kind==='regular';
 const regularSignal=regular?selected?.regular[0]:null;
 const area=regular?regularSignal?.geometry==='RADIUS':false;
 const routeNames=regular?regularSignal?.points:selected?.currentPoints;
 return <View ref={host} collapsable={false} onLayout={measureModal} onTouchStart={()=>cameraIntent.current?.gesture()} onPointerDown={()=>cameraIntent.current?.gesture()} style={styles.map}>
 <Map ref={map} style={styles.map} mapStyle={mapStyle} attribution onPress={()=>setPicker(null)} onDidFailLoadingMap={()=>setError('The map could not load. Check your connection.')} onDidFinishLoadingMap={()=>{setReady(true);setError('');}} onDidFinishRenderingFrame={()=>void refreshVisible()} onRegionIsChanging={event=>{observeView(event.nativeEvent,event.nativeEvent.userInteraction);visibleQuery.current?.moving();}} onRegionDidChange={event=>{observeView(event.nativeEvent,event.nativeEvent.userInteraction);setZoom(event.nativeEvent.zoom);visibleQuery.current?.settled();}}>
 <Camera ref={camera} initialViewState={{center:[initialCamera.longitude,initialCamera.latitude],zoom:initialCamera.zoom}} maxZoom={MAX_CAPACITY_ZOOM}/>
 <GeoJSONSource id="location-radius-fill" data={radiusData}>
  <Layer id="location-radius-shade" type="fill" paint={{'fill-color':colors.location,'fill-opacity':.09,'fill-antialias':false}}/>
 </GeoJSONSource>
 <GeoJSONSource id="selected-signals" data={pathData} onPress={event=>{event.stopPropagation();const feature=event.nativeEvent.features[0];const kind=feature?.properties?.kind as InfoKind;if(selected&&kind in colors)setInfo({id:selectedIdentity!,kind,index:Number(feature?.properties?.index)||0});}}>
 <Layer id="location-outline" type="line" filter={['==',['get','kind'],'location']} paint={{'line-color':colors.location,'line-width':2,'line-opacity':.8}}/>
 <Layer id="current-route" type="line" filter={['==',['get','kind'],'current']} layout={{'line-cap':'round','line-join':'round'}} paint={{'line-color':colors.current,'line-width':5}}/>
 <Layer id="regular-route" type="line" filter={['==',['get','kind'],'regular']} layout={{'line-cap':'round','line-join':'round'}} paint={{'line-color':colors.regular,'line-width':4,'line-dasharray':[1,2]}}/>
 </GeoJSONSource>
 {capacityStatuses.map(status=><GeoJSONSource key={status} ref={status==='EMPTY'?emptySource:partialSource} id={capacitySourceIds[status]} data={data[status]} cluster clusterRadius={64} clusterMaxZoom={MAX_CAPACITY_ZOOM} maxzoom={MAX_CAPACITY_ZOOM+1}>
 <Layer id={capacityLayerIds(status)[0]} type="circle" layout={{visibility:selected?'none':'visible'}} filter={['has','point_count']} paint={{'circle-radius':29,'circle-opacity':0}}/>
 <Layer id={capacityLayerIds(status)[1]} type="circle" layout={{visibility:selected?'none':'visible'}} filter={['!',['has','point_count']]} paint={{'circle-radius':27,'circle-opacity':0}}/>
 </GeoJSONSource>)}
 {capacityStatuses.map(status=><GeoJSONSource key={`own-${status}`} ref={status==='EMPTY'?ownEmptySource:ownPartialSource} id={ownSourceId(status)} data={ownData[status]} cluster clusterRadius={64} clusterMaxZoom={MAX_CAPACITY_ZOOM} maxzoom={MAX_CAPACITY_ZOOM+1}>
 <Layer id={ownLayerIds(status)[0]} type="circle" layout={{visibility:selected?'none':'visible'}} filter={['has','point_count']} paint={{'circle-radius':29,'circle-opacity':0}}/>
 <Layer id={ownLayerIds(status)[1]} type="circle" layout={{visibility:selected?'none':'visible'}} filter={['!',['has','point_count']]} paint={{'circle-radius':27,'circle-opacity':0}}/>
 </GeoJSONSource>)}
   {displayPoints.map(point=>{
    const item=selected||items.find(candidate=>candidate.id===point.itemId);
    if(point.cluster===null&&!item)return null;
    const status=point.status||item!.status;
    const isOwn=point.mine||Boolean(item&&ownIds.has(item.id));
    const percent=point.cluster===null&&item?availableSpacePercent(item.status,item.availablePercent,item.availablePercentReportedAt):null;
    const load=emptyShipmentPreferenceLabel(percent,item?.acceptedLoads);
    const pointLabel=point.cluster!==null
      ? (zoom<MAX_CAPACITY_ZOOM
        ? `${isOwn?t('Your vehicles')+'. ':''}${t('{count} {status} vehicles. Zoom in.',{count:point.count,status:t(status==='EMPTY'?'Empty':'Partial')})}`
        : clusterLabel(status,point.count,isOwn))
      : `${isOwn?t('Your vehicle')+', ':''}${item!.truck}, ${item!.driver}, ${percent===null?t('Available space not reported'):t('Available space: {percent}%',{percent})}${load?', '+t(load):''}${locationSourceLabel(item!.locationSource)?', '+t(locationSourceLabel(item!.locationSource)):''}${item!.locationIsDemo?', '+t('Demo location'):''}`;
    return <Marker key={point.key} id={point.key} lngLat={point.coordinate} offset={!selected?(offsets[point.key]||[0,0]):[0,0]} onPress={()=>void showPoint(point)}>
     <View accessible accessibilityRole="button" accessibilityLabel={pointLabel} style={point.cluster!==null?[styles.cluster,{backgroundColor:capacityColors[status]},isOwn&&styles.ownCluster]:styles.markerContents}>
      {point.cluster!==null?<>
       <Text style={[styles.count,{color:'#fff'}]}>{point.count}</Text>
       <Text style={[styles.clusterStatus,{color:'#fff'}]}>{t(status==='EMPTY'?'Empty':'Partial')}</Text>
       {isOwn&&<View pointerEvents="none" style={styles.ownBadge}><Text style={styles.ownBadgeText}>★</Text></View>}
      </>:<View style={[styles.truckWrap,isOwn&&styles.ownTruckWrap]}>
       {selectedId===item!.id&&<View pointerEvents="none" style={styles.selectedOutline}/>}
       <View style={[styles.truck,selectedId===item!.id&&styles.selected,{borderColor:capacityColors[status]}]}>
        <Image source={{uri:apiOrigin+vehicleConfigurationImage(item!.configuration)}} resizeMode="contain" style={styles.image}/>
       </View>
       {item!.latitude!==null&&item!.longitude!==null&&locationSourceKind(item!.locationSource)&&<View pointerEvents="none" style={[styles.sourceBadge,{borderColor:locationSourceColor(item!.locationSource)}]}>
        <AppIcon name={locationSourceKind(item!.locationSource)==='GPS'?'gps':'phone'} size={13} color={locationSourceColor(item!.locationSource)}/>
       </View>}
       {isOwn&&<View pointerEvents="none" style={styles.ownBadge}><Text style={styles.ownBadgeText}>★</Text></View>}
       {percent!==null&&<View pointerEvents="none" aria-hidden style={styles.spaceBadge}><Text style={styles.spaceBadgeText}>{percent}%</Text></View>}
      </View>}
     </View>
    </Marker>;
   })}
 </Map>
 {!selected&&<View style={[styles.mapKey,{bottom:bottomInset+4,maxHeight:Math.max(80,windowSize.height-topInset-bottomInset-80)}]}>
  <Pressable accessibilityRole="button" accessibilityLabel={t('Map key')} accessibilityState={{expanded:legendOpen}} onPress={()=>setLegendOpen(open=>!open)} style={styles.mapKeyToggle}><Text style={styles.mapKeyTitle}>{t('Map key')}</Text><AppIcon name={legendOpen?'chevronDown':'chevronUp'} size={14} color={palette.ink}/></Pressable>
  {legendOpen&&<ScrollView style={{flexShrink:1}} contentContainerStyle={styles.mapKeyItems}>
   {ownSignalIds.length>0&&<View style={styles.mapKeyItem}><Text style={{width:16,textAlign:'center',color:palette.ink}}>★</Text><Text style={styles.mapKeyText}>{t('Your vehicle')}</Text></View>}
   <View style={styles.mapKeyItem}><View style={[styles.mapKeyDot,{backgroundColor:capacityStatusPresentation.EMPTY.color}]}/><Text style={styles.mapKeyText}>{t('Empty')}</Text></View>
   <View style={styles.mapKeyItem}><View style={[styles.mapKeyDot,{backgroundColor:capacityStatusPresentation.PARTIAL.color}]}/><Text style={styles.mapKeyText}>{t('Partial')}</Text></View>
   <View style={styles.mapKeyItem}><View style={styles.mapKeyLocation}/><Text style={styles.mapKeyText}>{t('Approximate location')}</Text></View>
   <View style={styles.mapKeyItem}><View style={styles.mapKeyRoute}/><Text style={styles.mapKeyText}>{t('Planned route')}</Text></View>
   <View style={styles.mapKeyItem}><View style={styles.mapKeyPreferredArea}/><Text style={styles.mapKeyText}>{t('Preferred area')}</Text></View>
   <View style={styles.mapKeyItem}><View style={styles.mapKeyPreferred}/><Text style={styles.mapKeyText}>{t('Preferred route')}</Text></View>
  </ScrollView>}
 </View>}
 {!!selected&&<ScrollView style={[styles.infoControls,{top:topInset,bottom:bottomInset}]} contentContainerStyle={{gap:6}} showsVerticalScrollIndicator={false}>{choices.map(choice=><Pressable key={`${choice.kind}:${choice.index}`} accessibilityRole="button" accessibilityLabel={t(actionLabel(choice.kind))} accessibilityState={{selected:active?.kind===choice.kind}} onPress={()=>setInfo({id:selectedIdentity!,...choice})} style={[styles.infoControl,{borderLeftColor:colors[choice.kind]},(choice.kind==='truck'||choice.kind==='location')&&styles.neutralControl,active?.kind===choice.kind&&{backgroundColor:palette.blueSoft,borderColor:colors[choice.kind]}]}><Text style={styles.controlLabel}>{t(actionLabel(choice.kind))}</Text>{choice.kind==='truck'?<AppIcon name="truck" size={16} color={palette.ink}/>:choice.kind==='location'?<AppIcon name="location" size={16} color={colors.location}/>:<Text style={{fontSize:18,fontWeight:'700',color:colors[choice.kind]}}>…</Text>}</Pressable>)}</ScrollView>}
 {/* Android resolves overlapping native marker rectangles before React handlers. */}
 {!!selected&&<Pressable accessibilityRole="button" accessibilityLabel={t('Back to map')} onPress={()=>{setInfo(null);onDeselect();}} style={[styles.selectionExit,{position:'absolute',left:12,top:topInset}]}><Text style={{fontSize:28,color:'#155eef'}}>×</Text></Pressable>}
 {!!error&&<Text accessibilityRole="alert" style={[styles.error,{top:topInset+(selected?50:0),right:selected?INFO_CONTROL_CLEARANCE:16}]}>{error}</Text>}
 {picker&&!selected&&<Modal transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={()=>setPicker(null)}>
  <View style={styles.modalBackdrop}>
   <Pressable accessibilityRole="button" accessible={false} importantForAccessibility="no" style={StyleSheet.absoluteFill} onPress={()=>setPicker(null)}/>
   <View pointerEvents="box-none" style={[styles.modalPosition,modalFrame]}>
    <View accessibilityViewIsModal style={styles.infoCard}>
     <View style={styles.infoHeader}>
      <Text accessibilityRole="header" style={styles.infoTitle}>{picker.label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t('Close')} onPress={()=>setPicker(null)} style={styles.close}>
       <Text style={{fontSize:25,color:palette.ink}}>×</Text>
      </Pressable>
     </View>
     <FlatList data={picker.vehicles} keyExtractor={item=>item.id} style={styles.pickerList} renderItem={({item})=>
      <Pressable accessibilityRole="button" onPress={()=>selectVehicle(item)} style={styles.pickerRow}>
       <View style={styles.pickerIdentity}>
        <Text style={styles.infoTitle}>{item.truck}</Text>
        <Text style={styles.pickerProvider}>{item.provider}</Text>
       </View>
       <AppIcon name="next" size={16} color={palette.ink}/>
      </Pressable>
     }/>
    </View>
   </View>
  </View>
 </Modal>}
 {selected&&active&&<Modal transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={()=>setInfo(null)}><View style={styles.modalBackdrop}><Pressable accessibilityRole="button" accessibilityLabel={t('Close map signal details')} style={StyleSheet.absoluteFill} onPress={()=>setInfo(null)}/><View pointerEvents="box-none" style={[styles.modalPosition,detailFrame]}><View accessibilityViewIsModal style={[styles.infoCard,active.kind==='truck'&&{maxWidth:540}]}><View style={styles.infoHeader}><View style={styles.infoHeading}><View style={[styles.infoAccent,{backgroundColor:colors[active.kind]}]}/><Text accessibilityRole="header" style={styles.infoTitle}>{t(label(active.kind))}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={t('Close map signal details')} onPress={()=>setInfo(null)} style={styles.close}><Text style={{fontSize:25,color:'#0b1d3a'}}>×</Text></Pressable></View><ScrollView testID={active.kind==='truck'?'vehicle-overview-content':undefined} style={{flexGrow:0,flexShrink:1}} contentContainerStyle={active.kind==='truck'?{padding:10,gap:7}:{padding:14,gap:12}}>
 {active.kind==='truck'?<CapacityTruckDetails truck={selected} privatePhoto={privatePhotoWorkspaceId&&selected.vehicleId?<BusinessCargoSpacePhoto key={`${privatePhotoWorkspaceId}:${selected.vehicleId}`} workspaceId={privatePhotoWorkspaceId} vehicleId={selected.vehicleId}/>:null}/>:active.kind==='location'?<><Text style={styles.summary}>{t('Within {distance} km',{distance:selected.precisionKm})}</Text><Text style={styles.infoText}>{t('Approximate, not live')}</Text>{locationSourceLabel(selected.locationSource)&&<Text style={styles.infoText}>{t(locationSourceLabel(selected.locationSource))}</Text>}<Text style={styles.update}>{selected.locationIsDemo?t('Demo location')+' · ':''}{localizedUpdateLabel(selected.locationAge,t,'location')}</Text></>:<>
 {regular&&!area&&<Text style={styles.summary}>{t('Both directions')}</Text>}
 {active?.kind==='current'&&selected?.journeyStartAt?<Text style={styles.infoText}>{t('Departs {time} EAT',{time:capacityJourneyInput(selected.journeyStartAt).replace('T',' ')})}</Text>:null}
 {active?.kind==='current'&&selected?.journeyEndAt?<Text style={styles.infoText}>{t('Arrives {time} EAT',{time:capacityJourneyInput(selected.journeyEndAt).replace('T',' ')})}</Text>:null}
 {!regular&&<Text style={styles.infoText}>{selectedSpace===null?t('Available space not reported'):t('Available space: {percent}%',{percent:selectedSpace})}</Text>}
 {regular&&!area?<Text style={styles.infoText}>{routeNames?.map(point=>point.label).join(' ↔ ')}</Text>:<View style={area?styles.areaPlaces:undefined}>{routeNames?.map((point,index)=>area?<Text key={index} style={styles.areaPlace}>{point.label}</Text>:<View key={index}><View style={styles.stop}><Text style={[styles.stopNumber,{borderColor:colors[active.kind]}]}>{index+1}</Text><Text style={[styles.infoText,{flex:1,fontWeight:'600'}]}>{point.label}</Text></View>{index<(routeNames?.length||0)-1&&<Text style={[styles.direction,{color:colors[active.kind]}]}>↓</Text>}</View>)}</View>}
 <Text style={styles.update}>{regular?t('Confirm availability'):localizedUpdateLabel(selected.capacityAge,t)}</Text>
 </>}

 </ScrollView>{active.kind==='truck'&&<CapacityTruckContact truck={selected}/>}</View></View></View></Modal>}
 </View>;
}
const styles=StyleSheet.create({
 mapKey:{position:'absolute',left:12,maxWidth:230,borderWidth:1,borderColor:palette.borderSoft,borderRadius:10,backgroundColor:'#fff',overflow:'hidden'},
 mapKeyToggle:{minHeight:44,paddingHorizontal:10,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10},mapKeyTitle:{fontSize:12,fontWeight:'700',color:palette.ink},
 mapKeyItems:{gap:8,paddingHorizontal:10,paddingBottom:10},mapKeyItem:{flexDirection:'row',alignItems:'center',gap:8},mapKeyText:{fontSize:11,lineHeight:16,color:palette.ink,flexShrink:1},
 mapKeyDot:{width:13,height:13,borderRadius:7},mapKeyLocation:{width:16,height:16,borderRadius:8,borderWidth:1,backgroundColor:palette.blueSoft,borderColor:colors.location},
 mapKeyArea:{width:16,height:13,borderWidth:2,borderColor:colors.current},mapKeyRoute:{width:18,height:0,borderTopWidth:3,borderColor:colors.current},mapKeyPreferredArea:{width:16,height:13,borderWidth:2,borderStyle:'dashed',borderColor:colors.regular},mapKeyPreferred:{width:18,height:0,borderTopWidth:3,borderStyle:'dashed',borderColor:colors.regular},
 truckWrap:{position:'relative'},ownTruckWrap:{borderWidth:3,borderColor:'#0b1d3a',borderRadius:38,padding:2,backgroundColor:'#fff'},ownBadge:{position:'absolute',top:-8,right:-8,width:22,height:22,borderRadius:11,borderWidth:2,borderColor:'#fff',backgroundColor:'#0b1d3a',alignItems:'center',justifyContent:'center'},ownBadgeText:{color:'#fff',fontSize:12,lineHeight:16},sourceBadge:{position:'absolute',top:-4,left:-4,width:22,height:22,borderRadius:11,borderWidth:1.5,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},
 markerContents:{alignItems:'center',width:96},clusterStatus:{fontSize:10,lineHeight:14,fontWeight:'700'},
 spaceBadge:{position:'absolute',right:-9,bottom:-3,minWidth:28,minHeight:20,paddingHorizontal:4,borderRadius:6,borderWidth:1,borderColor:capacityColors.PARTIAL,backgroundColor:'#fff',alignItems:'center',justifyContent:'center',elevation:2},
 spaceBadgeText:{fontSize:11,lineHeight:15,fontWeight:'800',color:palette.ink,fontVariant:['tabular-nums']},
 truckStatusLine:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:6},truckLoadPreference:{fontSize:11,lineHeight:16,fontWeight:'700',color:'#243b63',backgroundColor:'#edf3ff',borderRadius:6,paddingHorizontal:7,paddingVertical:4},truckFacts:{flexDirection:'row',flexWrap:'wrap',gap:6},truckFact:{fontSize:12,lineHeight:18,color:palette.muted,backgroundColor:palette.canvas,borderRadius:6,paddingHorizontal:8,paddingVertical:5},
 truckHero:{flexDirection:'row',alignItems:'center',gap:14},truckIllustration:{width:70,height:66,borderRadius:8,borderWidth:1,borderColor:palette.borderSoft,backgroundColor:palette.canvas,justifyContent:'center'},truckStatus:{alignSelf:'flex-start',fontSize:11,fontWeight:'700',paddingHorizontal:7,paddingVertical:4,borderRadius:6},truckConfiguration:{fontSize:12,lineHeight:17,color:'#526875'},
 truckPeople:{flexDirection:'column',gap:10,paddingVertical:10,borderTopWidth:1,borderBottomWidth:1,borderColor:palette.borderSoft},truckPerson:{flexDirection:'row',alignItems:'center',gap:10,minHeight:36},personIdentity:{flex:1,flexDirection:'row',alignItems:'flex-start',gap:7},personLabel:{fontSize:11,lineHeight:15,color:'#526875'},personName:{fontSize:14,lineHeight:19,fontWeight:'600',color:'#0b1d3a'},profileAction:{minHeight:44,minWidth:82,borderWidth:1,borderColor:'#cbd5e1',borderRadius:8,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,padding:8},profileActionText:{color:'#155eef',fontSize:13,fontWeight:'700'},
 truckUpdates:{gap:8},truckUpdate:{flexDirection:'row',gap:6,alignItems:'flex-start'},truckUpdateText:{flex:1,fontSize:12,lineHeight:17,color:'#526875'},
 summary:{fontSize:18,lineHeight:24,fontWeight:'700',color:'#0b1d3a'},update:{fontSize:13,lineHeight:19,color:'#526875',paddingTop:10,borderTopWidth:1,borderTopColor:palette.borderSoft},stop:{flexDirection:'row',alignItems:'center',gap:10},stopNumber:{width:28,height:28,borderRadius:14,borderWidth:1,textAlign:'center',lineHeight:26,color:'#0b1d3a',fontSize:12},direction:{width:28,textAlign:'center',fontSize:20,lineHeight:24},areaPlaces:{flexDirection:'row',flexWrap:'wrap',gap:6},areaPlace:{borderWidth:1,borderColor:palette.borderSoft,borderRadius:6,padding:7,color:'#0b1d3a'},
 infoControls:{position:'absolute',right:INFO_CONTROL_RIGHT,top:68,width:INFO_CONTROL_WIDTH,bottom:8},infoControl:{minHeight:44,paddingHorizontal:8,paddingVertical:6,borderWidth:1,borderColor:palette.borderSoft,borderLeftWidth:4,borderRadius:8,backgroundColor:'#fff',flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:4},neutralControl:{borderLeftWidth:1,borderLeftColor:palette.borderSoft},controlLabel:{fontSize:11,fontWeight:'700',color:'#0b1d3a',flex:1},
 selectionExit:{width:44,height:44,borderRadius:22,borderWidth:2,borderColor:'#155eef',backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},
 modalBackdrop:{flex:1,backgroundColor:'rgba(23,44,70,0.22)'},modalPosition:{position:'absolute',alignItems:'center',justifyContent:'center',padding:16},
 infoCard:{width:'100%',maxWidth:430,maxHeight:'100%',borderWidth:1,borderColor:'#cbd5e1',borderRadius:12,backgroundColor:'#fff',overflow:'hidden'},infoHeader:{minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingLeft:14,borderBottomWidth:1,borderBottomColor:palette.borderSoft},infoHeading:{flex:1,flexDirection:'row',alignItems:'center',gap:8},infoAccent:{width:4,height:18,borderRadius:2},infoTitle:{fontSize:14,lineHeight:20,fontWeight:'700',color:'#0b1d3a',flexShrink:1},infoText:{fontSize:15,lineHeight:22,color:'#526875'},close:{width:44,height:44,alignItems:'center',justifyContent:'center'},profile:{color:'#155eef',fontWeight:'700',minHeight:44,paddingVertical:12},
 pickerList:{flexGrow:0,flexShrink:1,maxHeight:280},
 pickerRow:{minHeight:48,paddingHorizontal:14,paddingVertical:8,flexDirection:'row',alignItems:'center',gap:8,borderBottomWidth:1,borderBottomColor:palette.borderSoft},
 pickerIdentity:{flex:1},pickerProvider:{fontSize:12,lineHeight:17,color:palette.muted},
 map:{flex:1,overflow:'hidden'},error:{position:'absolute',top:62,left:16,right:16,padding:12,backgroundColor:'#fff',color:'#8b2525',borderRadius:12},cluster:{width:58,height:58,borderRadius:29,backgroundColor:'#155eef',alignItems:'center',justifyContent:'center',borderWidth:3,borderColor:'#fff'},ownCluster:{borderColor:'#0b1d3a',borderWidth:4},count:{fontSize:15,fontWeight:'700',color:'#fff'},truck:{width:54,height:54,borderRadius:27,borderWidth:3,backgroundColor:'#fff',alignItems:'center',justifyContent:'center',overflow:'hidden'},selected:{width:70,height:70,borderRadius:35,borderWidth:4},selectedOutline:{borderRadius:40,backgroundColor:'#fff',position:'absolute',top:-4,right:-4,bottom:-4,left:-4,borderColor:capacityMapColors.selection,borderWidth:2},image:{width:'95%',height:'90%'},legend:{position:'absolute',bottom:12,left:12,right:12,alignItems:'center'},legendText:{backgroundColor:'#ffffffee',color:'#334b58',fontSize:11,padding:7,borderRadius:8}});

// Draft typing and opening unrelated controls do not rebuild native map layers.
export default memo(CapacityMap);
