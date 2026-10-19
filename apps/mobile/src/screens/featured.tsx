import {useLanguage} from '../localization/provider';
import {useBlockedProviders} from '../hooks/content-blocks';
import { useCallback,useMemo,useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator,StyleSheet,Text,View } from 'react-native';
import { usePublicQuery } from '../hooks/public-query';
import { useForegroundRefresh } from '../hooks/foreground-refresh';
import { type Featured,programmeState } from '../api/public-content';
import {parseFeatured} from '../api/runtime-content';
import { Page,Copy,Button,ErrorText,palette } from '../components/ui';
import { ExternalButton } from '../components/public-details';
import {PublicCard,PublicCardAction,PublicCardFact,PublicCardHeading,PublicCardImage} from '../components/public-card';
export default function FeaturedScreen(){
 const {t}=useLanguage();
 const query=usePublicQuery<Featured>('/api/mobile/public/featured',parseFeatured),{blocked}=useBlockedProviders();
 const feature=useMemo(()=>{if(!query.data)return null;const trucks=query.data.trucks.filter(truck=>!blocked.includes(truck.handle));const slots=new Set(trucks.map(truck=>truck.slot));return {...query.data,trucks,programme:query.data.programme.filter(entry=>entry.slot===null||slots.has(entry.slot)),sponsors:query.data.sponsors.filter(sponsor=>!blocked.includes(sponsor.handle))};},[query.data,blocked]);
 const [now,setNow]=useState(Date.now),[schedule,setSchedule]=useState(false),[week,setWeek]=useState(false);
 useForegroundRefresh(query.refresh,Boolean(feature),60000);
 useFocusEffect(useCallback(()=>{setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),15000);return()=>clearInterval(timer);},[]));
 return <Page><View style={styles.workspace}><Text accessibilityRole="header" style={styles.title}>{feature?.headline||t('Daily Featured Vehicles')}</Text><ErrorText message={query.error}/>{query.loading&&!feature&&<ActivityIndicator accessibilityLabel="Loading Featured"/>}{!!query.error&&<Button message="Try again" onPress={()=>{void query.reload();}}/>}
 {feature&&<><Text style={styles.introduction}>{feature.introduction}</Text><PublicCardFact icon="calendar">{feature.date} · {t(feature.theme)} · {feature.start}–{feature.end} EAT</PublicCardFact>
 <View style={styles.programmeControls}><View style={{flex:1}}><Button secondary label={t(week?'Hide weekly themes':'Weekly themes')} onPress={()=>setWeek(!week)}/></View><View style={{flex:1}}><Button secondary label={t(schedule?'Hide schedule':'View schedule')} onPress={()=>setSchedule(!schedule)}/></View></View>
 <Text style={styles.caption}>{t('A rotating showcase, not a ranking. Programme times are not vehicle availability.')}</Text>
 {week&&<PublicCard>{feature.week.map(day=><View key={day.date} style={styles.programmeRow}><Text style={styles.programmeDate}>{t(day.day)} · {day.dateLabel}</Text><Text style={styles.programmeName}>{t(day.label)}</Text></View>)}</PublicCard>}
 {schedule&&<PublicCard>{feature.programme.length===0?<Copy message="No programme scheduled."/>:feature.programme.map((entry,index)=><View key={index} style={styles.programmeRow}><Text style={styles.programmeDate}>{entry.timeLabel} EAT</Text><Text style={styles.programmeName}>{entry.kind==='TRUCK'?feature.trucks.find(truck=>truck.slot===entry.slot)?.driver||t('Vehicle showcase'):entry.label}</Text></View>)}</PublicCard>}
 {!!feature.tiktokUrl&&<ExternalButton label={t('Watch on TikTok')} url={feature.tiktokUrl}/>}
 {!feature.trucks.length&&<PublicCard><PublicCardHeading message="No vehicles are scheduled today."/><Copy message="You can still explore vehicles with published capacity."/><PublicCardAction href="/" message="Find capacity" icon="truck"/></PublicCard>}
 {feature.trucks.map(truck=>{const slot=feature.programme.find(entry=>entry.slot===truck.slot);return <PublicCard key={truck.slot}>
  <View style={styles.identity}><PublicCardImage path={truck.portrait} label={truck.driver} portrait identity="person"/><View style={styles.identityText}><Text style={styles.kind}>{t(truck.driverKind)}</Text><PublicCardHeading>{truck.driver}</PublicCardHeading><Text style={styles.transporter}>{truck.name}</Text></View></View>
  <View style={styles.truck}><PublicCardImage path={truck.image} label={t(truck.configuration)}/><View style={styles.identityText}><Text style={styles.truckName}>{truck.truck}</Text><Text style={styles.configuration}>{t(truck.configuration)}</Text></View></View>
  <PublicCardFact icon="pin">{truck.place}</PublicCardFact>{slot&&<PublicCardFact icon="calendar">{slot.timeLabel} EAT · {t(programmeState(slot.startsAt,slot.endsAt,now))}</PublicCardFact>}
  <View style={styles.actions}><PublicCardAction href={{pathname:'/transporter',params:{handle:truck.handle}}} message="Transporter profile" icon="profile"/>{truck.available&&<PublicCardAction href={{pathname:'/',params:{provider:truck.handle}}} message="View available vehicles" icon="truck"/>}</View>
 </PublicCard>;})}
 {!!feature.sponsors.length&&<><PublicCardHeading message="Sponsored"/>{feature.sponsors.map((sponsor,index)=><PublicCard key={index}><PublicCardHeading>{sponsor.name}</PublicCardHeading><Text style={styles.introduction}>{sponsor.description}</Text>{sponsor.kind==='TRANSPORTER'?<PublicCardAction href={{pathname:'/transporter',params:{handle:sponsor.handle}}} message="Transporter profile" icon="profile"/>:<>{!!sponsor.website&&<ExternalButton label={t('Website')} url={sponsor.website}/>}{!!sponsor.phone&&<ExternalButton label={t('Call sponsor')} url={`tel:${sponsor.phone}`}/>}</>}</PublicCard>)}</>}
 <Text style={styles.caption}>{t('Confirm current documents, capacity, cargo fit, price and timing directly.')}</Text></>}
 </View></Page>;
}
const styles=StyleSheet.create({
 workspace:{width:'100%',maxWidth:820,alignSelf:'center',gap:12},title:{fontSize:22,lineHeight:28,fontWeight:'700',color:palette.ink},introduction:{fontSize:14,lineHeight:21,color:palette.muted},caption:{fontSize:12,lineHeight:18,color:palette.muted},
 programmeControls:{flexDirection:'row',gap:10},programmeRow:{gap:3,paddingVertical:5,borderBottomWidth:1,borderBottomColor:'#edf1f1'},programmeDate:{fontSize:12,lineHeight:18,color:palette.muted},programmeName:{fontSize:14,lineHeight:20,fontWeight:'600',color:palette.ink},
 identity:{flexDirection:'row',alignItems:'center',gap:12},identityText:{flex:1,gap:3},kind:{fontSize:11,lineHeight:16,color:palette.teal,fontWeight:'600'},transporter:{fontSize:13,lineHeight:19,color:palette.muted},truck:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:10,borderTopWidth:1,borderBottomWidth:1,borderColor:'#e6eded'},truckName:{fontSize:15,lineHeight:21,fontWeight:'600',color:palette.ink},configuration:{fontSize:13,lineHeight:19,color:palette.muted},actions:{flexDirection:'row',flexWrap:'wrap',gap:8},
});
