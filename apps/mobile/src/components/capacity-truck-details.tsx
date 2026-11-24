import {useState,type ReactNode} from 'react';
import {Image,Pressable,StyleSheet,Text,View} from 'react-native';
import {Link} from 'expo-router';
import * as Linking from 'expo-linking';
import type {CapacitySignal} from '../api/public-capacity';
import {externalDestination,type PublicBadge} from '../api/public-content';
import {apiOrigin} from '../api/http';
import {useLanguage} from '../localization/provider';
import {capacitySharingLabel} from '../../../../src/lib/capacity-sharing';
import {availableSpacePercent,emptyShipmentPreferenceLabel} from '../../../../src/lib/capacity-space-estimate.js';
import {vehicleConfigurationImage} from '../../../../src/lib/vehicle-configurations';
import {capacityStatusPresentation} from '../theme/capacity-status-presentation';
import {AppIcon} from './app-icon';
import {PublicCardImage} from './public-card';
import {TruckAuthorityBadges} from './truck-authority';
import {ErrorText,palette} from './ui';
import {localizedUpdateLabel} from '../../../../src/lib/i18n/update-label.js';
import {capacityCoverageLabel} from '../../../../src/lib/capacity-coverage-label.js';
import {CapacityCoverageIndicators} from './capacity-coverage-indicators';

const documentLabels:Record<string,string>={IDENTITY:'National ID',BUSINESS_LICENSE:'Business License',BUSINESS_ADDRESS:'Business Address',DRIVER_IDENTITY:'Driver license',VEHICLE_OWNERSHIP:'Vehicle ownership',VEHICLE_OPERATING_LICENSE:'Vehicle operating licence',VEHICLE_AUTHORIZATION:'Permission to use vehicle',VEHICLE_AUTHORITY:'Vehicle document',TRUCK_AUTHORIZATION:'Permission to use vehicle'};
export function CapacityDocumentGroups({truck}:{truck:CapacitySignal}){
 const {t}=useLanguage(),[expanded,setExpanded]=useState<string|null>(null);
 const groups=[{key:'driver',label:'Driver documents',badges:truck.driverBadges},{key:'vehicle',label:'Vehicle documents',badges:truck.truckBadges}];
 const active=groups.find(group=>group.key===expanded);
 return <View style={styles.documents}>
  <View style={styles.documentSummaries}>{groups.map(group=>{
   const reviewed=group.badges.filter(badge=>badge.reviewed&&!badge.expired).length;
   return <Pressable key={group.key} accessibilityRole="button" accessibilityLabel={t(group.label)} aria-expanded={expanded===group.key} onPress={()=>setExpanded(expanded===group.key?null:group.key)} style={styles.documentSummary}>
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

/** Keep the two main actions reachable while the evidence is expanded. */
export function CapacityTruckContact({truck}:{truck:CapacitySignal}){
 const {t}=useLanguage(),[error,setError]=useState('');
 const destination=externalDestination(`tel:${truck.driverPhone||truck.providerPhone}`);
 if(!destination&&!truck.handle)return null;
 return <View style={styles.contact}>
  <View style={styles.contactRow}>
   {!!truck.handle&&<Link href={{pathname:'/transporter',params:{handle:truck.handle}}} asChild>
    <Pressable accessibilityRole="link" style={styles.profile}><Text style={styles.actionText}>{t('Profile')}</Text><AppIcon name="external" size={16} color={palette.blue}/></Pressable>
   </Link>}
   {!!destination&&<Pressable accessibilityRole="button" onPress={()=>{setError('');void Linking.openURL(destination).catch(()=>setError('This phone could not open that contact. Please try another contact method.'));}} style={styles.call}>
    <AppIcon name="phone" size={18} color="#fff"/><Text style={styles.callText}>{t(truck.driverPhone?'Call driver':'Call')}</Text>
   </Pressable>}
  </View><ErrorText message={error?t(error):''}/>
 </View>;
}

export function CapacityTruckDetails({truck,privatePhoto}:{truck:CapacitySignal;privatePhoto?:ReactNode}){
 const {t}=useLanguage();
 const percent=availableSpacePercent(truck.status,truck.availablePercent,truck.availablePercentReportedAt);
 const load=emptyShipmentPreferenceLabel(percent,truck.acceptedLoads);
 const planned=truck.currentVisible?capacityCoverageLabel('planned',truck.geometry,truck.currentPoints):null;
 const regular=truck.regular?.[0];
 const preferred=capacityCoverageLabel('preferred',regular?.geometry,regular?.points);
 return <>
  <View style={styles.hero}><View style={styles.illustration}><Image source={{uri:apiOrigin+vehicleConfigurationImage(truck.configuration)}} resizeMode="contain" style={{width:'100%',height:50}}/></View><View style={styles.identity}>
   <Text style={styles.name}>{truck.truck}</Text>
   <View style={styles.vehicleTags}>
    <Text style={styles.meta}>{t(truck.configuration)}</Text>
    {!!truck.sharingMode&&<Text style={styles.meta}>{t(capacitySharingLabel(truck.sharingMode))}</Text>}
   </View>
   <View style={styles.statusLine}>
    <Text style={[styles.status,{backgroundColor:capacityStatusPresentation[truck.status].soft,color:capacityStatusPresentation[truck.status].text}]}>{percent===null?t('Available space not reported'):t('Available space: {percent}%',{percent})}</Text>
    {load?<Text style={styles.loads}>{t(load)}</Text>:null}
   </View>
  </View></View>
  <View style={styles.flags}><TruckAuthorityBadges authority={truck.authority}/><CapacityCoverageIndicators planned={planned} preferred={preferred}/></View>
  <View style={styles.people}>
   <View style={styles.person}>
    <AppIcon name="profile" size={18} color={palette.blue}/>
    <View style={styles.identity}>
     <Text style={styles.personLabel}>{t('Transport Provider')}</Text><Text style={styles.personName}>{truck.provider}</Text>
     {truck.accountIsDemo===true&&<Text style={styles.personLabel}>{t('Example account')}</Text>}
     {!truck.driverPhone&&!!truck.providerPhone&&<Text selectable style={styles.meta}>{truck.providerPhone}</Text>}
    </View>
   </View>
   <View style={styles.person}>
    <PublicCardImage path={truck.portrait} label={truck.driver} portrait compact identity="person"/>
    <View style={styles.identity}>
     <Text style={styles.personLabel}>{t(truck.driverKind)}</Text><Text style={styles.personName}>{truck.driver}</Text>
     <Text selectable={!!truck.driverPhone} style={styles.meta}>{truck.driverPhone||t('Phone not published')}</Text>
    </View>
   </View>
  </View>
  <View style={styles.updates}>
   <View style={styles.update}><AppIcon name="truck" size={15}/><Text style={[styles.meta,styles.identity]}>{localizedUpdateLabel(truck.capacityAge,t)}</Text></View>
   {truck.currentVisible&&<View style={styles.update}><AppIcon name="location" size={15} color="#1a73e8"/><Text style={[styles.meta,styles.identity]}>{localizedUpdateLabel(truck.locationAge,t,'location')}</Text></View>}
  </View>
  <Text style={styles.confirm}>{t('Confirm availability directly.')}</Text>
  {privatePhoto}
  <CapacityDocumentGroups truck={truck}/>
 </>;
}

const styles=StyleSheet.create({
 hero:{flexDirection:'row',alignItems:'center',gap:10},
 illustration:{width:64,height:56,borderRadius:8,borderWidth:1,borderColor:palette.borderSoft,backgroundColor:palette.canvas,justifyContent:'center'},
 name:{fontSize:17,lineHeight:21,fontWeight:'700',color:palette.ink},
 vehicleTags:{flexDirection:'row',flexWrap:'wrap',columnGap:8},
 statusLine:{flexDirection:'row',flexWrap:'wrap',gap:4,marginTop:3},
 status:{alignSelf:'flex-start',fontSize:11,lineHeight:15,fontWeight:'700',paddingHorizontal:7,paddingVertical:3,borderRadius:6},
 loads:{fontSize:11,lineHeight:15,fontWeight:'700',color:'#243b63',backgroundColor:'#edf3ff',borderRadius:6,paddingHorizontal:7,paddingVertical:3,flexShrink:1},
 flags:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:5},
 people:{flexDirection:'row',gap:8,paddingVertical:8,borderTopWidth:1,borderBottomWidth:1,borderColor:palette.borderSoft},
 person:{flex:1,minWidth:0,flexDirection:'row',alignItems:'flex-start',gap:5},
 identity:{flex:1,minWidth:0,gap:1},
 personLabel:{fontSize:11,lineHeight:15,color:palette.muted},
 personName:{fontSize:14,lineHeight:18,fontWeight:'600',color:palette.ink},
 meta:{fontSize:12,lineHeight:16,color:palette.muted},
 updates:{flexDirection:'row',gap:6},
 update:{flex:1,minWidth:0,flexDirection:'row',gap:4,alignItems:'flex-start'},
 confirm:{fontSize:12,lineHeight:16,color:palette.muted},
 documents:{gap:6},
 documentSummaries:{flexDirection:'row',gap:6},
 documentSummary:{flex:1,minWidth:0,flexDirection:'row',alignItems:'center',minHeight:46,borderWidth:1,borderColor:palette.border,borderRadius:8,padding:6,gap:4,backgroundColor:palette.blueSoft},
 documentCopy:{flex:1,minWidth:0,gap:1},
 documentHeading:{fontSize:12,lineHeight:15,fontWeight:'700',color:palette.ink},
 documentState:{fontSize:11,lineHeight:15,color:palette.muted},
 documentEvidence:{padding:10,gap:10,borderWidth:1,borderColor:palette.borderSoft,borderRadius:8},
 documentBadge:{gap:3},
 contact:{paddingHorizontal:12,paddingVertical:6,borderTopWidth:1,borderColor:palette.borderSoft,backgroundColor:'#fff'},
 contactRow:{flexDirection:'row',gap:8},
 profile:{flex:1,minHeight:44,minWidth:44,borderWidth:1,borderColor:palette.border,borderRadius:8,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6,padding:6},
 actionText:{color:palette.blue,fontSize:13,lineHeight:18,fontWeight:'700',flexShrink:1,textAlign:'center'},
 call:{flex:1,minHeight:44,minWidth:44,padding:6,borderRadius:8,backgroundColor:palette.blue,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:6},
 callText:{fontSize:13,lineHeight:18,fontWeight:'700',color:'#fff',flexShrink:1,textAlign:'center'},
});
