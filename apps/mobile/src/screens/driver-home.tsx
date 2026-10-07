import {useRef,useState} from 'react';
import {ActivityIndicator,Modal,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import type {CapacityTruck,CapacityWorkspace} from '../api/capacity';
import {useAccountQuery} from '../hooks/account-query';
import {useCapacityLocation} from '../hooks/capacity-location';
import {useLanguage} from '../localization/provider';
import {locationAreaLabel} from '../localization/location-copy';
import {useAccount} from '../session/provider';
import {AppIcon,type IconName} from '../components/app-icon';
import {AppLink} from '../components/app-link';
import {Button,Copy,ErrorText,Title,palette} from '../components/ui';
import {TrackingMap} from '../components/tracking-map';
import {Map,Camera} from '../components/map-platform';
import {mapStyle} from '../components/map-style';
import {CapacityEditor} from './manage-capacity';
import RegularService,{type Service} from './regular-service';
import type {MapCoverage} from '../components/tracking-map';

export function DriverHome(){
 const {t}=useLanguage(),account=useAccount();
 const {data,error,reload}=useAccountQuery<CapacityWorkspace>('/api/mobile/capacity');
 const [selected,setSelected]=useState(''),[choosing,setChoosing]=useState(false);
 const truck=data?.vehicles.find(item=>item.id===selected)||data?.vehicles[0];
 return <View style={styles.home}>
  {truck?<HomeTruck key={truck.id} truck={truck} canPublish={!!data?.canPublish} canRegular={account.session?.user.operatingModel!=='COMPANY_DRIVER'} refresh={reload} multiple={(data?.vehicles.length||0)>1} onChoose={()=>setChoosing(true)} loadError={error}/>:<>
   <View testID="driver-home-map" style={styles.map}><EmptyMap/></View>
   <View style={styles.empty}>
    {!!error?<><ErrorText message={t(error)}/><Button message="Refresh" onPress={()=>{void reload();}}/></>:!data?<ActivityIndicator accessibilityLabel={t('Loading truck capacity')}/>:<><Copy message="Add your truck, or ask your fleet owner to assign one, before sharing capacity."/>{account.session?.user.operatingModel!=='COMPANY_DRIVER'&&<AppLink href="/fleet" message="Trucks and drivers" style={styles.link}/>}</>}
   </View>
  </>}
  <Modal visible={choosing} transparent animationType="fade" onRequestClose={()=>setChoosing(false)}>
   <SafeAreaView style={styles.backdrop}><View style={styles.sheet}><View style={styles.sheetHeader}><Title message="Trucks and drivers"/><Button secondary message="Close" onPress={()=>setChoosing(false)}/></View><ScrollView contentContainerStyle={styles.editor}>{data?.vehicles.map(item=><Button key={item.id} secondary={item.id!==truck?.id} label={`${item.label} · ${item.plate}`} onPress={()=>{setSelected(item.id);setChoosing(false);}}/>)}</ScrollView></View></SafeAreaView>
  </Modal>
 </View>;
}

type HomeTruckProps={truck:CapacityTruck;canPublish:boolean;canRegular:boolean;refresh:()=>Promise<void>;multiple:boolean;onChoose:()=>void;loadError:string};
function HomeTruck(props:HomeTruckProps){return props.canRegular?<ProviderTruck {...props}/>:<DriverTruck {...props}/>;}
function ProviderTruck(props:HomeTruckProps){
 const regular=useAccountQuery<{services:Service[]}>('/api/mobile/regular-service');
 const shapes:MapCoverage[]=regular.data?.services.map(item=>({kind:item.geometry,places:item.geometry==='ROUTE'?item.route:item.boundary,partial:false}))||[];
 return <DriverTruck {...props} loadError={props.loadError||regular.error} regular={shapes} refresh={async()=>{await Promise.all([props.refresh(),regular.reload()]);}}/>;
}

function DriverTruck({truck,canPublish,canRegular,refresh,multiple,onChoose,loadError,regular=[]}:HomeTruckProps&{regular?:MapCoverage[]}){
 const {t,locale}=useLanguage(),[section,setSection]=useState<'CAPACITY'|'REGULAR'|'LOCATION'|null>(null),[saving,setSaving]=useState(false),savingRef=useRef(false);
 const editing=section!==null;
 const location=useCapacityLocation(truck,editing,refresh),current=truck.current;
 const status=current?t(current.status==='EMPTY'?'Empty':current.status==='PARTIAL'?'Partial':'Off Duty'):t('No capacity published yet');
 const color=current?.status==='PARTIAL'?'#a06e00':current?.status==='EMPTY'?'#16845b':palette.muted;
 const close=()=>{if(savingRef.current)return;setSection(null);void refresh();};
 return <>
  <View style={styles.truckBar} aria-hidden={editing} importantForAccessibility={editing?'no-hide-descendants':'auto'} accessibilityElementsHidden={editing}>
   <View style={styles.truckIcon}><AppIcon name="truck" color={palette.teal}/></View>
   <View style={{flex:1,minWidth:0}}><Text numberOfLines={1} style={styles.truckName}>{truck.label}</Text><Text numberOfLines={1} style={styles.small}>{truck.plate} · {truck.driver||t('No driver assigned')}</Text><Text numberOfLines={2} style={[styles.status,{color}]}>{status}{current?` · ${t(current.visibility==='OPEN'?'Open to the public':'Private network')}`:''}</Text></View>
   {multiple&&<Pressable accessibilityRole="button" accessibilityLabel={t('Trucks and drivers')} onPress={onChoose} style={styles.iconButton}><AppIcon name="next" color={palette.teal}/></Pressable>}
  </View>
  <View testID="driver-home-map" style={styles.map} aria-hidden={editing} importantForAccessibility={editing?'no-hide-descendants':'auto'} accessibilityElementsHidden={editing}>
   {truck.location?.coordinate?<TrackingMap fill regular={regular} location={{latitude:truck.location.coordinate[1],longitude:truck.location.coordinate[0],radius:truck.location.radius,area:truck.location.area,updatedAt:truck.location.updatedAt}} coverage={current&&current.status!=='OFF_DUTY'?{kind:current.availabilityGeometry,places:current.availabilityGeometry==='ROUTE'?current.route:current.boundary,partial:current.status==='PARTIAL'}:undefined}/>:<EmptyMap/>}
   <View pointerEvents="box-none" style={styles.mapOverlay}>
    <View style={styles.locationNote}><View style={{flexDirection:'row',gap:7,alignItems:'center'}}><AppIcon name="location" size={16} color="#1976ed"/><Text numberOfLines={2} style={[styles.small,{flex:1}]}>{truck.location?locationAreaLabel(truck.location.area,t):t('No driver location shared yet')}</Text></View>{truck.location&&<Text style={styles.updated}>{t('{radius} km radius',{radius:truck.location.radius})} · {t('Location updated {date}',{date:new Date(truck.location.updatedAt).toLocaleString(locale==='om'?'en-ET':locale,{dateStyle:'short',timeStyle:'short'})})}</Text>}</View>
    {truck.canLocate&&<Pressable accessibilityRole="button" accessibilityLabel={t('Share truck location')} accessibilityState={{busy:location.busy,disabled:location.busy}} disabled={location.busy} onPress={()=>{void location.shareLocation();}} style={styles.locate}>{location.busy?<ActivityIndicator color={palette.teal}/>:<AppIcon name="location" color={palette.teal}/>}</Pressable>}
    <View style={styles.actions} pointerEvents="box-none"><ScrollView style={styles.rail} contentContainerStyle={styles.railContent} showsVerticalScrollIndicator>
      <GroupButton label="Available space" hint={canPublish?'Update capacity':'Location and availability'} icon="truck" color={color} onPress={()=>setSection('CAPACITY')}/>
      {canRegular&&<GroupButton label="Usual routes" icon="repeat" color="#b56326" onPress={()=>setSection('REGULAR')}/>}
      {truck.canLocate&&<GroupButton label="Truck location" icon="pin" color="#1976ed" onPress={()=>setSection('LOCATION')}/>}
     </ScrollView></View>
    {!!(loadError||location.error)&&<View style={styles.dock}><View style={styles.error}><ErrorText message={t(loadError||location.error)}/>{!!loadError&&<Button secondary message="Refresh" onPress={()=>{void refresh();}}/>}</View></View>}
   </View>
  </View>
  <Modal visible={editing} transparent animationType="slide" onRequestClose={close}>
   <SafeAreaView style={styles.backdrop}><View style={styles.sheet} accessibilityViewIsModal><View style={styles.sheetHeader}><View style={{flex:1}}><Text style={styles.truckName}>{t(section==='REGULAR'?'Usual routes or area':section==='LOCATION'?'Truck location':canPublish?'Update capacity':'Location and availability')}</Text><Text numberOfLines={1} style={styles.small}>{truck.label} · {truck.plate}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={t('Close')} accessibilityState={{disabled:saving}} disabled={saving} onPress={close} style={styles.iconButton}><AppIcon name="close" color={palette.teal}/></Pressable></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.editor}>{section==='REGULAR'?<RegularService embedded onBusy={value=>{savingRef.current=value;setSaving(value);}} onSaved={()=>{setSection(null);void refresh();}}/>:section&&<CapacityEditor section={section==='CAPACITY'?'HOME':section} truck={truck} canPublish={canPublish} onBusy={value=>{savingRef.current=value;setSaving(value);}} onSaved={()=>{setSection(null);void refresh();}} onCancel={close}/>}</ScrollView></View></SafeAreaView>
  </Modal>
 </>;
}
function GroupButton({label,hint,icon,color=palette.teal,onPress}:{label:string;hint?:string;icon:IconName;color?:string;onPress:()=>void}){const {t}=useLanguage();return <Pressable accessibilityRole="button" accessibilityLabel={t(hint||label)} onPress={onPress} style={styles.group}><AppIcon name={icon} size={20} color={color}/><Text style={styles.groupText}>{t(label)}</Text></Pressable>;}
function EmptyMap(){return <Map style={{flex:1}} androidView="texture" mapStyle={mapStyle} attribution><Camera initialViewState={{center:[38.74,9.03],zoom:5}}/></Map>;}
const styles=StyleSheet.create({
 rail:{flexGrow:0,flexShrink:1,width:78},railContent:{gap:7,padding:3},group:{width:72,minHeight:53,paddingHorizontal:4,paddingVertical:7,backgroundColor:'rgba(255,255,255,.97)',borderRadius:13,borderWidth:1,borderColor:palette.border,flexDirection:'column',alignItems:'center',justifyContent:'center',gap:3,boxShadow:'0px 2px 8px rgba(23,44,70,.13)'},groupText:{fontSize:10,fontWeight:'700',color:palette.ink,textAlign:'center'},
 home:{flex:1,backgroundColor:'#fff'},map:{flex:1,minHeight:0,position:'relative'},truckBar:{paddingHorizontal:14,paddingVertical:10,flexDirection:'row',gap:10,alignItems:'center',borderBottomWidth:1,borderColor:palette.border},truckIcon:{width:40,height:40,backgroundColor:'#eaf5f4',borderRadius:12,alignItems:'center',justifyContent:'center'},truckName:{fontSize:17,fontWeight:'700',color:palette.ink},small:{fontSize:12,lineHeight:18,color:palette.muted},status:{fontSize:12,lineHeight:18,fontWeight:'600'},
 mapOverlay:{...StyleSheet.absoluteFill,padding:12,justifyContent:'space-between'},locationNote:{alignSelf:'flex-start',maxWidth:'80%',backgroundColor:'rgba(255,255,255,.96)',padding:9,borderRadius:12,borderWidth:1,borderColor:palette.border},updated:{fontSize:10,lineHeight:16,color:palette.muted,marginLeft:23},dock:{gap:8,paddingBottom:12},actions:{position:'absolute',right:9,top:88,bottom:12,justifyContent:'center',alignItems:'flex-end'},locate:{position:'absolute',right:12,top:12,width:48,height:48,borderRadius:16,borderWidth:1,borderColor:palette.border,backgroundColor:'#fff',alignItems:'center',justifyContent:'center',boxShadow:'0px 3px 12px rgba(23,44,70,.12)'},error:{backgroundColor:'#fff',padding:10,borderRadius:12,gap:8},empty:{position:'absolute',bottom:20,left:16,right:16,backgroundColor:'#fff',borderRadius:16,padding:16,gap:12,borderWidth:1,borderColor:palette.border},link:{color:palette.teal,fontSize:16,fontWeight:'700',paddingVertical:12},
 backdrop:{flex:1,backgroundColor:'rgba(23,44,70,.16)',justifyContent:'flex-end',paddingHorizontal:8,paddingTop:16},sheet:{maxHeight:'94%',width:'100%',maxWidth:640,alignSelf:'center',backgroundColor:'#fff',borderRadius:20,overflow:'hidden',flexShrink:1},sheetHeader:{flexDirection:'row',alignItems:'center',gap:10,padding:16,borderBottomWidth:1,borderColor:palette.border},iconButton:{minWidth:48,minHeight:48,alignItems:'center',justifyContent:'center'},editor:{padding:18,gap:14,paddingBottom:28}
});
