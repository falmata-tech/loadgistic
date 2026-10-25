import {ContentSafety} from '../components/content-safety';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { usePublicQuery } from '../hooks/public-query';
import type { PublicProvider } from '../api/public-content';
import { Page, Copy, Button, ErrorText, palette, LoadingSpinner } from '../components/ui';
import { PublicBadges,ExternalButton } from '../components/public-details';
import {PublicCard,PublicCardAction,PublicCardFact,PublicCardHeading,PublicCardImage} from '../components/public-card';
import {useLanguage} from '../localization/provider';
import {publicFleetRowKey} from '../../../../src/lib/public-fleet-row.js';
import {ProviderTruckSummary,TruckAuthorityBadges} from '../components/truck-authority';
export default function TransporterScreen(){const {handle}=useLocalSearchParams<{handle:string}>();return <Profile key={String(handle)} handle={typeof handle==='string'?handle:''}/>;}
function Profile({handle}:{handle:string}){
 const {t}=useLanguage();
 const [page,setPage]=useState(1),[showFleet,setShowFleet]=useState(false),query=usePublicQuery<PublicProvider>(`/api/mobile/public/providers/${encodeURIComponent(handle)}?page=${page}`),provider=query.data;
 return <Page><View style={styles.workspace}><ErrorText message={query.error}/>{query.loading&&!provider&&<LoadingSpinner accessibilityLabel="Loading transporter"/>}{!!query.error&&<Button message="Try again" onPress={()=>{void query.reload();}}/>}
 {provider&&<ContentSafety handle={provider.handle}><View style={styles.identity}><PublicCardImage path={provider.image} label={provider.accountName||provider.name} portrait identity={provider.isCompany?'company':'person'}/><View style={styles.identityText}><Text accessibilityRole="header" style={styles.title}>{provider.accountName||provider.name}</Text><Text style={styles.caption}>@{provider.handle}</Text><Text style={styles.caption}>{t('Transport Provider')}{provider.city?` · ${provider.city}`:''}</Text>{!!provider.managerName&&<Text style={styles.caption}>{t('Account manager')} · {provider.managerName}</Text>}</View></View>
 <ProviderTruckSummary summary={provider.authoritySummary}/>
 {!!provider.headline&&<Text style={styles.introduction}>{provider.headline}</Text>}
 <View style={styles.contacts}>
 {!!provider.contacts.phone&&<View style={styles.contact}><ExternalButton label={t('Call transporter')} url={`tel:${provider.contacts.phone}`}/></View>}
 {!!provider.contacts.whatsapp&&<View style={styles.contact}><ExternalButton label={t('WhatsApp')} url={`https://wa.me/${provider.contacts.whatsapp.replace(/\D/g,'')}`}/></View>}
 {!!provider.contacts.email&&<View style={styles.contact}><ExternalButton label={t('Email transporter')} url={`mailto:${provider.contacts.email}`}/></View>}
 {!!provider.contacts.website&&<View style={styles.contact}><ExternalButton label={t('Website')} url={provider.contacts.website}/></View>}
 </View>
 {!!provider.about&&<PublicCard><PublicCardHeading message="About this transporter"/><Copy>{provider.about}</Copy></PublicCard>}
 {!!provider.youtubeId&&<ExternalButton label={t('Watch introduction')} url={`https://www.youtube.com/watch?v=${provider.youtubeId}`}/>}
 <PublicCard><PublicCardHeading message="Documents"/><PublicBadges items={provider.badges}/><Text style={styles.caption}>{t('A review applies to the named document, not a service guarantee.')}</Text></PublicCard>
 <PublicCard><PublicCardHeading message="Verified shipment reviews"/>{provider.reviewCount>0&&<Text style={styles.rating}>{t('{rating} / 5 · {count} reviews',{rating:provider.averageRating??'—',count:provider.reviewCount})}</Text>}{!provider.reviews.length&&<Copy message="No verified shipment reviews yet."/>}{provider.reviews.map((review,index)=><View key={index} style={styles.review}><Text style={styles.caption}>{review.rating} / 5 · {review.createdAt.slice(0,10)}{review.disputed?' · '+t('Under dispute'):''}</Text><Copy>{review.note}</Copy>{!!review.id&&<ContentSafety handle={handle} reviewId={review.id}/>}</View>)}</PublicCard>
 {provider.fleet.total>0&&<PublicCardAction href={{pathname:'/',params:{provider:provider.handle}}} message="See vehicles on the map" icon="map"/>}
 {provider.fleet.total>1&&<Button secondary label={showFleet?t('Hide vehicles and drivers'):`${t('View vehicles and drivers')} (${provider.fleet.total})`} onPress={()=>setShowFleet(!showFleet)}/>}
 {(showFleet||provider.fleet.total<=1)&&<><PublicCardHeading message="Vehicles and drivers"/>{!provider.trucks.length&&<Copy message="No vehicles listed."/>}{provider.trucks.map((truck,index)=><PublicCard key={publicFleetRowKey(truck.number,(provider.fleet.page-1)*12+index)}>
  <View style={styles.truckIdentity}><PublicCardImage path={truck.image} label={t(truck.configuration)}/><View style={styles.identityText}><PublicCardHeading>{truck.name}</PublicCardHeading><Text style={styles.caption}>{t(truck.configuration)}</Text>{!!truck.number&&<Text style={styles.number}>{truck.number}</Text>}</View></View>
  <View style={styles.truckIdentity}><PublicCardImage path={truck.portrait} label={truck.driver||t('Driver not named')} portrait identity="person"/><View style={styles.identityText}><PublicCardFact icon="user">{truck.driver?`${truck.driver} · ${t(truck.driverKind)}`:t('Driver not named')}</PublicCardFact>{!!truck.phone&&<ExternalButton label={t('Call driver')} url={`tel:${truck.phone}`}/>}</View></View>
  <TruckAuthorityBadges authority={truck.authority}/><View style={styles.sectionFacts}><Text style={styles.capacity}>{truck.capacity?`${t(truck.capacity.status==='EMPTY'?'Empty':'Partial capacity')} · ${truck.capacity.updated}`:t('No current capacity published')}</Text>{truck.capacity&&<><PublicCardFact icon="route">{[truck.capacity.origin,truck.capacity.destination].filter(Boolean).join(' → ')}</PublicCardFact><PublicCardFact icon="location">{truck.capacity.locationUpdated}</PublicCardFact>{!!truck.capacity.mapHref&&<PublicCardAction href={truck.capacity.mapHref} message="View capacity on map" icon="map"/>}</>}</View>
  {!!truck.regular&&<View style={styles.sectionFacts}><Text style={styles.label}>{t(truck.regular.kind==='ROUTE'?'Preferred corridor':'Preferred service area')}</Text><PublicCardFact icon="route">{truck.regular.places.join(truck.regular.kind==='ROUTE'?' ↔ ':' · ')}</PublicCardFact><Text style={styles.caption}>{t('Confirm availability')}</Text></View>}
  <View style={styles.sectionFacts}><Text style={styles.label}>{t('Driver documents')}</Text><PublicBadges items={truck.driverBadges}/></View><View style={styles.sectionFacts}><Text style={styles.label}>{t('Vehicle documents')}</Text><PublicBadges items={truck.truckBadges}/></View>
 </PublicCard>)}
 {provider.fleet.pages>1&&<><Copy>{t('Page {page} of {pages}',{page:provider.fleet.page,pages:provider.fleet.pages})}</Copy><View style={styles.contacts}><View style={styles.contact}><Button secondary message="Previous vehicles" disabled={page<=1||query.loading} onPress={()=>setPage(value=>value-1)}/></View><View style={styles.contact}><Button secondary message="Next vehicles" disabled={page>=provider.fleet.pages||query.loading} onPress={()=>setPage(value=>value+1)}/></View></View></>}</>}
 </ContentSafety>}
 </View></Page>;
}
const styles=StyleSheet.create({
 workspace:{width:'100%',maxWidth:820,alignSelf:'center',gap:14},identity:{flexDirection:'row',gap:12,alignItems:'center'},identityText:{flex:1,gap:4},title:{fontSize:21,lineHeight:27,fontWeight:'700',color:palette.ink},introduction:{fontSize:14,lineHeight:21,color:palette.muted},caption:{fontSize:12,lineHeight:18,color:palette.muted},
 contacts:{flexDirection:'row',flexWrap:'wrap',gap:10},contact:{flexBasis:'45%',flexGrow:1},sectionFacts:{gap:8,paddingTop:10,borderTopWidth:1,borderTopColor:palette.borderSoft},label:{fontSize:13,lineHeight:19,fontWeight:'600',color:palette.ink},rating:{fontSize:14,lineHeight:20,fontWeight:'600',color:palette.ink},review:{gap:7,paddingVertical:10,borderTopWidth:1,borderTopColor:palette.borderSoft},truckIdentity:{flexDirection:'row',alignItems:'center',gap:12},number:{fontSize:11,lineHeight:16,color:palette.muted},capacity:{fontSize:13,lineHeight:19,fontWeight:'600',color:palette.ink},
});
