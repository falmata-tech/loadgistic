import {useCallback,useRef,useState} from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import type {CameraRef} from './map-platform';
import {Map,Camera,Marker} from './map-platform';
import {mapStyle} from './map-style';
import {AppIcon} from './app-icon';
import { Button, Copy, ErrorText, palette, LoadingSpinner } from './ui';
import {useLanguage} from '../localization/provider';
import {useAccountQuery} from '../hooks/account-query';
import {useAccount} from '../session/provider';
import {privacyRadii} from '../location/privacy';
import {captureCapacityLocation} from '../location/capture';
import type {CapacityTruck} from '../api/capacity';

type Point={latitude:number;longitude:number};
type Source='GPS'|'MOBILE'|'MANUAL';
type Selection={vehicleId:string;source:Source;precisionKm:number;revision:string;manualPoint:Point|null;canSetManualLocation:boolean;canSetPhoneLocation:boolean};

export function DriverLocationEditor({truck,onSaved,onBusy}:{truck:CapacityTruck;onSaved:()=>void;onBusy?:(busy:boolean)=>void}){
 const {t}=useLanguage();
 const {data,error,loading,reload}=useAccountQuery<Selection>(`/api/mobile/capacity/manual-location?vehicleId=${encodeURIComponent(truck.id)}`);
 return <View style={{gap:14}}>
  {loading&&<LoadingSpinner accessibilityLabel={t('Loading location settings')}/>}
  <ErrorText message={error?t(error):''}/>
  {!!error&&<Button secondary message="Refresh" onPress={()=>{void reload();}}/>}
  {data?.vehicleId===truck.id&&<LocationForm key={`${data.vehicleId}:${data.revision}`} truck={truck} selection={data} onSaved={onSaved} onBusy={onBusy} reload={reload}/>}
 </View>;
}

function LocationForm({truck,selection,onSaved,onBusy,reload}:{truck:CapacityTruck;selection:Selection;onSaved:()=>void;onBusy?:(busy:boolean)=>void;reload:()=>Promise<void>}){
 const {t}=useLanguage(),account=useAccount();
 const [source,setSource]=useState<Source>(selection.source),[radius,setRadius]=useState(privacyRadii.includes(selection.precisionKm)?selection.precisionKm:10);
 const [point,setPoint]=useState<Point|null>(selection.manualPoint),[busy,setBusy]=useState(false),[error,setError]=useState(''),[sourceSaved,setSourceSaved]=useState(false);
 const camera=useRef<CameraRef|null>(null);
 const [initialPoint]=useState<Point|null>(()=>selection.manualPoint||(truck.location?.coordinate?{latitude:truck.location.coordinate[1],longitude:truck.location.coordinate[0]}:null));
 const cameraRef=useCallback((value:CameraRef|null)=>{camera.current=value;if(value&&initialPoint)value.jumpTo({center:[initialPoint.longitude,initialPoint.latitude],zoom:10});},[initialPoint]);
 const canManual=selection.canSetManualLocation,canPhone=selection.canSetPhoneLocation;
 const sourceName=(value:Source)=>t(value==='GPS'?'GPS device':value==='MOBILE'?'Driver’s phone':'Manually entered');
 async function save(){
  if(busy)return;
  if(source==='MANUAL'&&(!canManual||!point))return setError(t('Choose a point on the map first.'));
  if(source==='MOBILE'&&!canPhone)return setError(t('This vehicle is no longer assigned to you.'));
  if(source==='GPS')return;
  setBusy(true);onBusy?.(true);setError('');
  try{
   // Capture first, so denying phone permission leaves the current manual/GPS
   // capacity source intact. Tracking has its own independently saved source.
   const fix=source==='MOBILE'?await captureCapacityLocation(radius,true):null;
   if(AppState.currentState!=='active')throw new Error(t('Location sharing paused. Return to this screen and try again.'));
   if(!sourceSaved){await account.request('/api/mobile/fleet/devices',{action:'SOURCE',input:{vehicleId:truck.id,source,expectedRevision:selection.revision,precisionKm:radius,...(source==='MANUAL'&&point?{manualLatitude:point.latitude,manualLongitude:point.longitude}:{})}});setSourceSaved(true);}
   if(fix){
    try{await account.request('/api/mobile/capacity',{action:'LOCATION',vehicleId:truck.id,...fix});}
    catch{throw new Error(t('Phone source saved, but the location was not shared. Try again.'));}
   }
   onSaved();
  }catch(error){setError(error instanceof Error?error.message:t('Could not update location. Try again.'));}
  finally{setBusy(false);onBusy?.(false);}
 }
 return <View style={{gap:14}}>
  <View style={{padding:12,borderRadius:12,backgroundColor:palette.canvas,gap:3}}><Text style={{fontSize:12,color:palette.muted}}>{t('Capacity map location')}</Text><Text style={{fontSize:16,fontWeight:'700',color:palette.ink}}>{sourceName(selection.source)}</Text>{!!truck.location?.updatedAt&&<Text style={{fontSize:12,color:palette.muted}}>{t('Location updated {date}',{date:new Date(truck.location.updatedAt).toLocaleString()})}</Text>}</View>
  <Text style={{fontSize:15,fontWeight:'700',color:palette.ink}}>{t('Location source')}</Text>
  {canManual&&<SourceChoice label={t('Manual capacity location')} detail={t('A manual point stays until you update it. Update it when the vehicle moves.')} icon="manual" selected={source==='MANUAL'} disabled={busy} onPress={()=>{if(sourceSaved)setError(t('Refresh location settings before changing the source.'));else setSource('MANUAL');}}/>}
  {canPhone&&<SourceChoice label={t('Driver’s phone')} detail={t('Phone location updates while Home is open.')} icon="phone" selected={source==='MOBILE'} disabled={busy} onPress={()=>{if(sourceSaved)setError(t('Refresh location settings before changing the source.'));else setSource('MOBILE');}}/>}
  {source==='MANUAL'&&canManual&&<>
   <Copy message="Tap the map to choose the vehicle’s location."/>
   <View style={{height:270,borderRadius:12,overflow:'hidden',borderWidth:1,borderColor:palette.border}}><Map style={{flex:1}} mapStyle={mapStyle} attribution onDidFinishLoadingMap={()=>{if(initialPoint)camera.current?.jumpTo({center:[initialPoint.longitude,initialPoint.latitude],zoom:10});}} onPress={event=>{const [longitude,latitude]=event.nativeEvent.lngLat;if(Number.isFinite(latitude)&&Math.abs(latitude)<=90&&Number.isFinite(longitude)){setPoint({latitude,longitude:Math.abs(longitude)<=180?longitude:((longitude+180)%360+360)%360-180});setError('');}}}><Camera ref={cameraRef} initialViewState={{center:initialPoint?[initialPoint.longitude,initialPoint.latitude]:[0,0],zoom:initialPoint?10:2}}/>{point&&<Marker id="driver-manual-location" lngLat={[point.longitude,point.latitude]}><View style={{width:32,height:32,borderRadius:16,backgroundColor:'#fff',borderWidth:2,borderColor:palette.blue,alignItems:'center',justifyContent:'center'}}><AppIcon name="pin" size={18} color={palette.blue}/></View></Marker>}</Map></View>
  </>}
  {source!=='GPS'&&(canManual||canPhone)&&<><Text style={{fontSize:14,fontWeight:'700',color:palette.ink}}>{t('Shared location accuracy')}</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:7}}>{privacyRadii.map(value=><Pressable key={value} accessibilityRole="radio" accessibilityLabel={`${value} km`} accessibilityState={{checked:radius===value,disabled:busy||sourceSaved}} disabled={busy||sourceSaved} onPress={()=>setRadius(value)} style={{minWidth:56,minHeight:44,borderRadius:10,borderWidth:1,borderColor:radius===value?palette.blue:palette.border,backgroundColor:radius===value?'#eaf1ff':'#fff',alignItems:'center',justifyContent:'center'}}><Text style={{color:palette.ink,fontWeight:radius===value?'700':'500'}}>{value} km</Text></Pressable>)}</View></>}
  <Copy message="Capacity shows an approximate area. Active shipment Tracking and the provider’s GPS can continue separately."/>
  <ErrorText message={error}/>{!!error&&<Button secondary message="Refresh location settings" disabled={busy} onPress={()=>{void reload();}}/>}
  {source!=='GPS'&&(canManual||canPhone)&&<Button message={source==='MANUAL'?'Update location':'Use phone location'} busy={busy} disabled={source==='MANUAL'&&!point} onPress={()=>{void save();}}/>}
 </View>;
}

function SourceChoice({label,detail,icon,selected,disabled,onPress}:{label:string;detail:string;icon:'manual'|'phone';selected:boolean;disabled:boolean;onPress:()=>void}){
 return <Pressable accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{checked:selected,disabled}} disabled={disabled} onPress={onPress} style={{minHeight:68,padding:12,borderWidth:1.5,borderColor:selected?palette.blue:palette.border,borderRadius:12,backgroundColor:selected?palette.blueSoft:'#fff',flexDirection:'row',alignItems:'center',gap:12}}><AppIcon name={icon} size={20} color={selected?palette.blue:palette.muted}/><View style={{flex:1,gap:3}}><Text style={{fontSize:15,fontWeight:'700',color:palette.ink}}>{label}</Text><Text style={{fontSize:12,lineHeight:17,color:palette.muted}}>{detail}</Text></View></Pressable>;
}
