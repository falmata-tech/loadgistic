import {useLanguage} from '../localization/provider';
import {useBlockedProviders} from '../hooks/content-blocks';
import { AppLink } from '../components/app-link';
import { useCallback,useMemo,useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator,View } from 'react-native';
import { usePublicQuery } from '../hooks/public-query';
import { useForegroundRefresh } from '../hooks/foreground-refresh';
import { type Featured,programmeState } from '../api/public-content';
import { Page,Title,Copy,Card,Button,ErrorText } from '../components/ui';
import { PublicImage,ExternalButton } from '../components/public-details';
export default function FeaturedScreen(){
 const {t}=useLanguage();
 const query=usePublicQuery<Featured>('/api/mobile/public/featured'),{blocked}=useBlockedProviders();
 const feature=useMemo(()=>{if(!query.data)return null;const trucks=query.data.trucks.filter(truck=>!blocked.includes(truck.handle));const slots=new Set(trucks.map(truck=>truck.slot));return {...query.data,trucks,programme:query.data.programme.filter(entry=>entry.slot===null||slots.has(entry.slot)),sponsors:query.data.sponsors.filter(sponsor=>!blocked.includes(sponsor.handle))};},[query.data,blocked]);
 const [now,setNow]=useState(Date.now),[schedule,setSchedule]=useState(false),[week,setWeek]=useState(false);
 useForegroundRefresh(query.refresh,Boolean(feature),60000);
 useFocusEffect(useCallback(()=>{setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),15000);return()=>clearInterval(timer);},[]));
 return <Page><Title>{feature?.headline||t('Daily Featured Trucks')}</Title><ErrorText message={query.error}/>{query.loading&&!feature&&<ActivityIndicator accessibilityLabel="Loading Featured"/>}{!!query.error&&<Button message="Try again" onPress={()=>{void query.reload();}}/>}
 {feature&&<><Copy>{feature.introduction}</Copy><Copy>{feature.date} · {feature.theme} · {feature.start}–{feature.end} EAT</Copy><Copy message={"A rotating showcase, not a ranking. Programme times are not truck availability."}/>
 <View style={{flexDirection:'row',gap:10}}><View style={{flex:1}}><Button secondary label={t(week?'Hide weekly themes':'Weekly themes')} onPress={()=>setWeek(!week)}/></View><View style={{flex:1}}><Button secondary label={t(schedule?'Hide schedule':'View schedule')} onPress={()=>setSchedule(!schedule)}/></View></View>
 {week&&<Card>{feature.week.map(day=><Copy key={day.date}>{day.day} · {day.dateLabel} — {day.label}</Copy>)}</Card>}
 {schedule&&<Card>{feature.programme.length===0?<Copy message={"No programme scheduled."}/>:feature.programme.map((entry,index)=><Copy key={index}>{entry.timeLabel} EAT · {entry.kind==='TRUCK'?feature.trucks.find(truck=>truck.slot===entry.slot)?.driver||'Truck showcase':entry.label}</Copy>)}</Card>}
 {!!feature.tiktokUrl&&<ExternalButton label="Watch on TikTok" url={feature.tiktokUrl}/>}
 {!feature.trucks.length&&<Card><Title message={"No trucks are scheduled today."}/><Copy message={"You can still explore trucks with published capacity."}/><AppLink href="/" style={{color:'#0c7275',paddingVertical:12}} message={"Find capacity"}/></Card>}
 {feature.trucks.map(truck=>{const slot=feature.programme.find(entry=>entry.slot===truck.slot);return <Card key={truck.slot}><View style={{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:12}}><PublicImage path={truck.portrait} label={truck.driver} portrait/><PublicImage path={truck.image} label={truck.configuration}/></View><Title>{truck.driver}</Title><Copy>{truck.driverKind} · {truck.name}</Copy><Copy>{truck.truck} · {truck.configuration}</Copy><Copy>{truck.place}</Copy>{slot&&<Copy>{slot.timeLabel} EAT · {t(programmeState(slot.startsAt,slot.endsAt,now))}</Copy>}<AppLink href={{pathname:'/transporter',params:{handle:truck.handle}}} style={{color:'#0c7275',paddingVertical:12}} message={"Transporter profile"}/>{truck.available&&<AppLink href={{pathname:'/',params:{q:truck.handle}}} style={{color:'#0c7275',paddingVertical:12}} message={"View available trucks"}/>}</Card>;})}
 {!!feature.sponsors.length&&<><Title message={"Sponsored"}/>{feature.sponsors.map((sponsor,index)=><Card key={index}><Title>{sponsor.name}</Title><Copy>{sponsor.description}</Copy>{sponsor.kind==='TRANSPORTER'?<AppLink href={{pathname:'/transporter',params:{handle:sponsor.handle}}} style={{color:'#0c7275',paddingVertical:12}} message={"Transporter profile"}/>:<>{!!sponsor.website&&<ExternalButton label="Website" url={sponsor.website}/>}
 {!!sponsor.phone&&<ExternalButton label="Call sponsor" url={`tel:${sponsor.phone}`}/>}</>}</Card>)}</>}
 <Copy message={"Confirm current documents, capacity, cargo fit, price and timing directly."}/></>}
 </Page>;
}
