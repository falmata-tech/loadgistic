import {useState} from 'react';
import {Image,Pressable,StyleSheet,Text,View} from 'react-native';
import {Link} from 'expo-router';
import * as Linking from 'expo-linking';
import type {CapacitySignal} from '../api/public-capacity';
import {externalDestination,type PublicBadge} from '../api/public-content';
import {apiOrigin} from '../api/http';
import {useLanguage} from '../localization/provider';
import {capacitySharingLabel} from '../../../../src/lib/capacity-sharing';
import {capacityLoadLabel} from '../../../../src/lib/capacity-load-preferences';
import {vehicleConfigurationImage} from '../../../../src/lib/vehicle-configurations';
import {capacityStatusPresentation} from '../theme/capacity-status-presentation';
import {AppIcon} from './app-icon';
import {PublicCardImage} from './public-card';
import {TruckAuthorityBadges} from './truck-authority';
import {ErrorText,palette} from './ui';

const documentLabels:Record<string,string>={IDENTITY:'National ID',BUSINESS_LICENSE:'Business License',BUSINESS_ADDRESS:'Business Address',DRIVER_IDENTITY:'Driver license',VEHICLE_OWNERSHIP:'Vehicle ownership',VEHICLE_OPERATING_LICENSE:'Vehicle operating licence',VEHICLE_AUTHORIZATION:'Permission to use vehicle',VEHICLE_AUTHORITY:'Vehicle document',TRUCK_AUTHORIZATION:'Permission to use vehicle'};
export function CapacityDocumentGroups({truck}:{truck:CapacitySignal}){
 const {t}=useLanguage(),[expanded,setExpanded]=useState<string|null>(null);
 const groups=[{key:'owner',label:truck.ownerDocumentsLabel,badges:truck.ownerBadges},{key:'driver',label:'Driver documents',badges:truck.driverBadges},{key:'vehicle',label:'Vehicle documents',badges:truck.truckBadges}];
 const active=groups.find(group=>group.key===expanded);
 return <View style={styles.documents}>
  <View style={styles.documentSummaries}>{groups.map(group=>{
   const reviewed=group.badges.filter(badge=>badge.reviewed&&!badge.expired).length;
   return <Pressable key={group.key} accessibilityRole="button" accessibilityLabel={t(group.label)} accessibilityState={{expanded:expanded===group.key}} onPress={()=>setExpanded(expanded===group.key?null:group.key)} style={styles.documentSummary}>
    <AppIcon name={reviewed?'shield':'documents'} size={16} color={reviewed?palette.blue:palette.muted}/>
    <View style={styles.documentCopy}><Text style={styles.documentHeading}>{t(group.label)}</Text>
     <Text style={styles.documentState}>{group.badges.length?t('{reviewed} of {total} reviewed',{reviewed,total:group.badges.length}):t('Not verified')}</Text></View>
    <AppIcon name={expanded===group.key?'chevronUp':'chevronDown'} size={14}/>
   </Pressable>;
  })}</View>
  {active&&<View accessibilityLabel={t(active.label)} style={styles.documentEvidence}>
   {active.badges.length?active.badges.map((badge:PublicBadge,index)=><View key={`${badge.type}:${index}`} style={styles.documentBadge}>
    <Text style={styles.personName}>{t(documentLabels[badge.type])}</Text>
    <Text style={styles.meta}>{t(badge.reviewed&&!badge.expired?'Loadgistic reviewed':badge.expired?'Expired':'Not verified')}</Text>
    {!!badge.reviewedAt&&<Text style={styles.meta}>{t('Reviewed {date}.',{date:badge.reviewedAt.slice(0,10)})}</Text>}
    {!!badge.expiresOn&&<Text style={styles.meta}>{t('Expires {date}.',{date:badge.expiresOn})}</Text>}
   </View>):<Text style={styles.meta}>{t('No current reviewed evidence.')}</Text>}
   <Text style={styles.meta}>{t('Confirm current originals and operating authority directly.')}</Text>
  </View>}
 </View>;
}

/** Remains outside the scrolling evidence so the published callback stays reachable. */
export function CapacityTruckContact({truck}:{truck:CapacitySignal}){
 const {t}=useLanguage(),[error,setError]=useState('');
 const destination=externalDestination(`tel:${truck.driverPhone||truck.providerPhone}`);
 if(!destination)return null;
 return <View style={styles.contact}>
  <View style={styles.contactRow}><Text selectable style={[styles.meta,{flex:1}]}>{truck.driverPhone||truck.providerPhone}</Text><Pressable accessibilityRole="button" onPress={()=>{setError('');void Linking.openURL(destination).catch(()=>setError('This phone could not open that contact. Please try another contact method.'));}} style={styles.call}>
   <AppIcon name="phone" size={18} color="#fff"/><Text style={styles.callText}>{t(truck.driverPhone?'Call driver':'Call')}</Text>
  </Pressable></View><ErrorText message={error?t(error):''}/>
 </View>;
}

export function CapacityTruckDetails({truck}:{truck:CapacitySignal}){
 const {t}=useLanguage();
 return <>
  <View style={styles.hero}><View style={styles.illustration}><Image source={{uri:apiOrigin+vehicleConfigurationImage(truck.configuration)}} resizeMode="contain" style={{width:'100%',height:58}}/></View><View style={{flex:1,gap:4}}>
   <View style={styles.statusLine}><Text style={[styles.status,{backgroundColor:truck.status==='EMPTY'?palette.successSoft:'#fff7d6',color:truck.status==='EMPTY'?palette.success:capacityStatusPresentation.PARTIAL.text}]}>{t(truck.status==='EMPTY'?'Empty vehicle':'Partial capacity')}</Text>{truck.acceptedLoads&&<Text style={styles.loads}>{t(capacityLoadLabel(truck.acceptedLoads))}</Text>}</View>
   <Text style={styles.name}>{truck.truck}</Text><Text style={styles.meta}>{t(truck.configuration)}</Text>
  </View></View>
  {!!truck.sharingMode&&<Text style={styles.tag}>{t(capacitySharingLabel(truck.sharingMode))}</Text>}
  <TruckAuthorityBadges authority={truck.authority}/>
  <View style={styles.people}>
   <View style={styles.person}><View style={styles.identity}><AppIcon name="profile" size={19} color={palette.blue}/><View style={{flex:1,gap:3}}><Text style={styles.personLabel}>{t('Transport Provider')}</Text><Text style={styles.personName}>{truck.provider}</Text></View></View>{!!truck.handle&&<Link href={{pathname:'/transporter',params:{handle:truck.handle}}} asChild><Pressable accessibilityRole="link" style={styles.profile}><Text style={styles.actionText}>{t('Profile')}</Text><AppIcon name="external" size={16} color={palette.blue}/></Pressable></Link>}</View>
   <View style={styles.person}><PublicCardImage path={truck.portrait} label={truck.driver} portrait identity="person"/><View style={[styles.identity,{flexDirection:'column',gap:3}]}><Text style={styles.personLabel}>{t(truck.driverKind)}</Text><Text style={styles.personName}>{truck.driver}</Text>{!truck.driverPhone&&<Text style={styles.meta}>{t('Phone not published')}</Text>}</View></View>
  </View>
  <View style={styles.updates}><View style={styles.update}><AppIcon name="truck" size={16}/><Text style={[styles.meta,{flex:1}]}>{truck.capacityAge}</Text></View>{truck.currentVisible&&<View style={styles.update}><AppIcon name="location" size={16} color="#1a73e8"/><Text style={[styles.meta,{flex:1}]}>{truck.locationAge}</Text></View>}<Text style={styles.meta}>{t('Confirm availability directly.')}</Text></View>
  <CapacityDocumentGroups truck={truck}/>
 </>;
}

const styles=StyleSheet.create({
 hero:{flexDirection:'row',alignItems:'center',gap:12},illustration:{width:70,height:66,borderRadius:8,borderWidth:1,borderColor:palette.borderSoft,backgroundColor:palette.canvas,justifyContent:'center'},name:{fontSize:18,lineHeight:24,fontWeight:'700',color:palette.ink},
 statusLine:{flexDirection:'row',flexWrap:'wrap',gap:6},status:{alignSelf:'flex-start',fontSize:11,fontWeight:'700',paddingHorizontal:7,paddingVertical:4,borderRadius:6},loads:{fontSize:11,lineHeight:16,fontWeight:'700',color:'#243b63',backgroundColor:'#edf3ff',borderRadius:6,paddingHorizontal:7,paddingVertical:4},tag:{alignSelf:'flex-start',fontSize:12,lineHeight:18,color:palette.muted,backgroundColor:palette.canvas,borderRadius:6,paddingHorizontal:8,paddingVertical:5},
 people:{flexDirection:'column',gap:10,paddingVertical:10,borderTopWidth:1,borderBottomWidth:1,borderColor:palette.borderSoft},person:{flexDirection:'row',alignItems:'center',gap:10,minHeight:36},identity:{flex:1,flexDirection:'row',alignItems:'flex-start',gap:7,minWidth:0},personLabel:{fontSize:11,lineHeight:15,color:palette.muted},personName:{fontSize:14,lineHeight:19,fontWeight:'600',color:palette.ink},meta:{fontSize:12,lineHeight:17,color:palette.muted},
 profile:{minHeight:44,minWidth:82,borderWidth:1,borderColor:palette.border,borderRadius:8,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7,padding:8},actionText:{color:palette.blue,fontSize:13,lineHeight:18,fontWeight:'700'},
 updates:{gap:8},update:{flexDirection:'row',gap:6,alignItems:'flex-start'},documents:{gap:10},documentSummaries:{gap:6},documentSummary:{flexDirection:'row',alignItems:'center',minHeight:52,borderWidth:1,borderColor:palette.border,borderRadius:8,paddingHorizontal:10,paddingVertical:7,gap:10,backgroundColor:palette.blueSoft},documentCopy:{flex:1,minWidth:0,gap:2},documentHeading:{fontSize:13,lineHeight:18,fontWeight:'700',color:palette.ink},documentState:{fontSize:11,lineHeight:15,color:palette.muted},documentEvidence:{padding:10,gap:10,borderWidth:1,borderColor:palette.borderSoft,borderRadius:8},documentBadge:{gap:3},
 contact:{paddingHorizontal:14,paddingVertical:10,borderTopWidth:1,borderColor:palette.borderSoft,backgroundColor:'#fff'},contactRow:{flexDirection:'row',alignItems:'center',gap:8},call:{minHeight:44,minWidth:116,padding:10,borderRadius:8,backgroundColor:palette.blue,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,flexShrink:1},callText:{fontSize:13,lineHeight:18,fontWeight:'700',color:'#fff',flexShrink:1},
});
