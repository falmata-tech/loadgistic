import {useCallback,useEffect,useRef,useState} from 'react';
import {AppState,Platform,Pressable,Text,View} from 'react-native';
import * as Location from 'expo-location';
import {useAccount} from '../session/provider';
import {useLanguage} from '../localization/provider';
import {deviceTrackingId,readTrackingLeases,replaceTrackingLeases,revokeTrackingLease,startBackgroundTracking,stopBackgroundTracking} from '../location/background-task';
import {trackingLeases,type TrackingLease} from '../location/background-state';
import {AppIcon} from './app-icon';
// Global lifecycle: returning to Home is not necessary for an agreed shipment to report.
export function BackgroundTracking(){
 const account=useAccount(),{t}=useLanguage(),[needed,setNeeded]=useState(false),[error,setError]=useState('');
 const generation=useRef(0),busy=useRef(false),last=useRef(0),actorId=account.session?.user.id||'';
 const request=account.request;
 const synchronize=useCallback(async(prompt=false)=>{
  if(Platform.OS==='web'||!actorId||busy.current||AppState.currentState!=='active')return;
  if(!prompt&&Date.now()-last.current<60000)return;
  busy.current=true;last.current=Date.now();const version=generation.current;
  try{
   const result=await request('/api/mobile/shipments/location-leases') as {shipments:{shipmentId:string;radius:number}[]};
   if(version!==generation.current)return;
   if(!result.shipments.length){await stopBackgroundTracking();setNeeded(false);setError('');return;}
   let foreground=await Location.getForegroundPermissionsAsync(),background=await Location.getBackgroundPermissionsAsync();
   if(prompt){if(!foreground.granted)foreground=await Location.requestForegroundPermissionsAsync();if(foreground.granted&&!background.granted)background=await Location.requestBackgroundPermissionsAsync();}
   if(version!==generation.current||AppState.currentState!=='active')return;
   if(!foreground.granted||!background.granted){setNeeded(true);setError('');return;}
   const stored=await readTrackingLeases(),next:TrackingLease[]=[],deviceId=await deviceTrackingId();
   for(const target of result.shipments){if(version!==generation.current)return;
    const previous=stored.find(item=>item.actorId===actorId&&item.shipmentId===target.shipmentId&&item.radius===target.radius);
    if(previous&&Date.parse(previous.expiresAt)>Date.now()+3600000){next.push(previous);continue;}
    const issued=await request('/api/mobile/shipments/location-leases',{shipmentId:target.shipmentId,deviceId,radius:target.radius});
    const fresh=trackingLeases([{...(issued as object),actorId,lastAttempt:0}])[0];if(!fresh)throw Error('Location reporting could not be confirmed.');
    if(version!==generation.current){await revokeTrackingLease(fresh);return;}next.push(fresh);
   }
   if(version!==generation.current)return;
   if(next.length!==stored.length||next.some(item=>!stored.some(previous=>previous.token===item.token&&previous.actorId===item.actorId)))await replaceTrackingLeases(next);
   for(const lease of stored.filter(item=>!next.some(current=>current.token===item.token)))await revokeTrackingLease(lease);
   await startBackgroundTracking({title:t('Loadgistic shipment tracking'),body:t('Sharing approximate location until unloading is approved')});setNeeded(false);setError('');
  }catch{if(version===generation.current)setError('Location reporting needs attention. Open Tracking to check your last update.');}
  finally{busy.current=false;}
 },[actorId,request,t]);
 useEffect(()=>{generation.current++;last.current=0;if(Platform.OS==='web')return;
  if(!actorId)return;
  const initial=setTimeout(()=>void synchronize(),0);const listener=AppState.addEventListener('change',state=>{if(state==='active')void synchronize();});const interval=setInterval(()=>void synchronize(),60000);
  const operationEpoch=generation;
  return()=>{operationEpoch.current++;clearTimeout(initial);listener.remove();clearInterval(interval);};
 },[actorId,synchronize]);
 if(Platform.OS==='web'||(!needed&&!error))return null;
 return <View style={{backgroundColor:'#fff7df',paddingHorizontal:12,paddingVertical:8}}><Pressable accessibilityRole="button" onPress={()=>void synchronize(true).then(()=>{last.current=0;void synchronize();})} style={{flexDirection:'row',alignItems:'center',gap:8,minHeight:36}}><AppIcon name="location" color="#805c00" size={20}/><Text style={{color:'#493600',flex:1,fontSize:13}}>{t(error||'Allow location updates for your active shipment')}</Text></Pressable></View>;
}
