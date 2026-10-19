import {type PropsWithChildren,useCallback,useEffect,useRef,useState} from 'react';
import {AppState,Image,Modal,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {Link,useFocusEffect} from 'expo-router';
import {useLanguage} from '../localization/provider';
import {TrackingMap} from './tracking-map';
import {AppIcon} from './app-icon';
import {statusLabel,type TrackingLocation,type TrackingPublicTruck,type TrackingRoutePoint} from '../api/tracking';
import {TRACKING_JOURNEY,trackingNextStatuses,trackingProgress} from '../../../../src/lib/tracking-progress.js';
import {vehicleConfigurationImage} from '../../../../src/lib/vehicle-configurations';
import {apiOrigin} from '../api/http';
import {blockChatReading} from '../session/chat-visibility';
import {TruckAuthorityBadges} from './truck-authority';
type Props=PropsWithChildren<{code:string;status:string;route:TrackingRoutePoint[];location:TrackingLocation|null;truck:TrackingPublicTruck|null;recordedStatuses?:string[];canViewLocation?:boolean}>;
export function TrackingWorkspace({code,status,route,location,truck,recordedStatuses,children,canViewLocation=true}:Props){
 const {t}=useLanguage(),[expanded,setExpanded]=useState(false),[truckOpen,setTruckOpen]=useState(false);
 const overlay=useRef({});
 useEffect(()=>{const source=overlay.current;blockChatReading(source,truckOpen);return()=>blockChatReading(source,false);},[truckOpen]);
 useEffect(()=>{const subscription=AppState.addEventListener('change',state=>{if(state!=='active'){setTruckOpen(false);setExpanded(false);}});return()=>subscription.remove();},[]);
 useFocusEffect(useCallback(()=>()=>{setTruckOpen(false);setExpanded(false);},[]));
 const next=trackingNextStatuses(status).filter(value=>value!=='ISSUE')[0];
 const nextLabel=status==='UNLOADING'?'Waiting for shipment owner approval':status==='ISSUE'?'Choose an available step.':next?statusLabel(next):['COMPLETED','CANCELLED'].includes(status)?'This shipment is closed.':'Choose an available step.';
 return <View testID="tracking-native-map-workspace" style={styles.screen}>
  <TrackingMap fill route={route} location={location} truck={truck} onTruckPress={()=>setTruckOpen(true)}/>
  <View pointerEvents="box-none" style={styles.heading}><View style={styles.identity}><Text style={styles.code}>{code}</Text><Text numberOfLines={2} style={styles.route}>{route.map(point=>point.label).join(' → ')}</Text><Text style={styles.route}>{location?`${location.demo?t('Demo location'):t('Approximate location')} · ${t('Within {distance} km',{distance:location.radius})}`:t('Planned city route · not driving directions')}</Text></View>{truck&&<Pressable accessibilityRole="button" accessibilityLabel={t('Vehicle details')} onPress={()=>setTruckOpen(true)} style={styles.truckControl}><AppIcon name="truck" color="#0c7275"/></Pressable>}</View>
  <View style={styles.progress}>
   <Pressable accessibilityRole="button" accessibilityLabel={t(expanded?'Close shipment progress':'Open shipment progress')} accessibilityState={{expanded}} onPress={()=>setExpanded(!expanded)} style={styles.progressControl}><AppIcon name="route" color="#0c7275"/><View style={{flex:1,gap:3}}><Text style={styles.current}>{t('Current')} · {t(statusLabel(status))}</Text><Text style={styles.next}>{t('Next')} · {t(nextLabel)}</Text></View><AppIcon name={expanded?'close':'more'} color="#0c7275"/></Pressable>
   {expanded&&<ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} style={styles.scroll}><Text style={styles.notice}>{t('Planned city route · not driving directions')}</Text>{location?<Text style={styles.notice}>{t('Within {distance} km',{distance:location.radius})} · {new Date(location.updatedAt).toLocaleString()}</Text>:canViewLocation?<Text style={styles.notice}>{t('No current Driver location is shared.')}</Text>:null}{recordedStatuses&&TRACKING_JOURNEY.map(step=><View key={step} style={{paddingVertical:8,borderBottomWidth:1,borderBottomColor:'#e2ece9'}}><Text style={styles.current}>{t(statusLabel(step))}</Text><Text style={styles.notice}>{t(trackingProgress(step,status,recordedStatuses,trackingNextStatuses(status)))}</Text></View>)}{children}</ScrollView>}
  </View>
  {truck&&<Modal visible={truckOpen} transparent animationType="fade" onRequestClose={()=>setTruckOpen(false)}><View style={styles.backdrop}><Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel={t('Close vehicle details')} onPress={()=>setTruckOpen(false)}/><View accessibilityViewIsModal style={styles.modal}><View style={styles.modalHeading}><Text style={styles.current}>{t('Vehicle details')}</Text><Pressable accessibilityRole="button" accessibilityLabel={t('Close vehicle details')} onPress={()=>setTruckOpen(false)} style={styles.truckControl}><AppIcon name="close"/></Pressable></View><ScrollView contentContainerStyle={styles.content}>
   <View style={{flexDirection:'row',alignItems:'center',gap:12}}><Image source={{uri:apiOrigin+vehicleConfigurationImage(truck.configuration)}} resizeMode="contain" style={{width:90,height:70}}/><View style={{flex:1,gap:5}}><Text style={styles.current}>{truck.make} {truck.model}</Text><Text style={styles.notice}>{truck.platformNumber} · {t(truck.configuration)}</Text></View></View>
   <TruckAuthorityBadges authority={truck.authority}/>
   <Text style={styles.current}>{t('Transport Provider')} · {truck.providerName}</Text>{!!truck.providerHandle&&<Link href={{pathname:'/transporter',params:{handle:truck.providerHandle}}} onPress={()=>setTruckOpen(false)} style={styles.link}>{t('Profile')}</Link>}
   <Text style={styles.current}>{t('Driver')} · {truck.driverName||t('Driver not named')}</Text>
   {truck.driverPhone?<Link href={`tel:${truck.driverPhone}`} style={styles.link}>{t('Call driver')} · {truck.driverPhone}</Link>:truck.contactPhone?<Link href={`tel:${truck.contactPhone}`} style={styles.link}>{t('Call transporter')} · {truck.contactPhone}</Link>:<Text style={styles.notice}>{t('Phone not published')}</Text>}
  </ScrollView></View></View></Modal>}
 </View>;
}
const styles=StyleSheet.create({
 screen:{flex:1,minHeight:300,backgroundColor:'#eaf0ee'},heading:{position:'absolute',top:10,left:10,right:10,flexDirection:'row',alignItems:'flex-start',gap:8},identity:{flex:1,maxWidth:620,padding:12,borderRadius:12,borderWidth:1,borderColor:'#cbded9',backgroundColor:'#fff'},code:{fontSize:15,fontWeight:'700',color:'#172c46'},route:{fontSize:12,lineHeight:17,color:'#526875',marginTop:4},truckControl:{width:46,height:46,alignItems:'center',justifyContent:'center',backgroundColor:'#fff',borderRadius:10},
 progress:{position:'absolute',bottom:14,left:10,right:10,maxWidth:440,maxHeight:'78%',borderWidth:1,borderColor:'#bad0cd',borderRadius:14,overflow:'hidden',backgroundColor:'#fff'},progressControl:{minHeight:66,flexDirection:'row',alignItems:'center',gap:10,padding:12},current:{fontSize:15,lineHeight:21,fontWeight:'600',color:'#172c46'},next:{fontSize:12,lineHeight:18,color:'#526875'},scroll:{flexGrow:0,flexShrink:1,borderTopWidth:1,borderTopColor:'#e2ece9'},content:{padding:16,gap:14},notice:{fontSize:13,lineHeight:19,color:'#526875'},link:{fontSize:15,color:'#0c7275',paddingVertical:12,minHeight:44},
 backdrop:{flex:1,backgroundColor:'rgba(23,44,70,.25)',justifyContent:'center',alignItems:'center',padding:18},modal:{width:'100%',maxWidth:500,maxHeight:'85%',backgroundColor:'#fff',borderWidth:2,borderColor:'#0c7275',borderRadius:14,overflow:'hidden'},modalHeading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingLeft:16,borderBottomWidth:1,borderBottomColor:'#e2ece9'},
});
