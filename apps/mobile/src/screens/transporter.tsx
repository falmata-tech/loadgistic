import {coverPosterPath,exampleCover} from '../../../../src/lib/provider-cover-video.js';
import {apiOrigin} from '../api/http';
import {ProviderFleetMap} from './capacity';
import {ContentSafety} from '../components/content-safety';
import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ImageBackground, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { usePublicQuery } from '../hooks/public-query';
import type { PublicProvider } from '../api/public-content';
import { Page, Copy, Button, ErrorText, palette, LoadingSpinner } from '../components/ui';
import { PublicBadges,ExternalButton } from '../components/public-details';
import {PublicCard,PublicCardHeading,PublicCardImage} from '../components/public-card';
import {AppIcon} from '../components/app-icon';
import {useLanguage} from '../localization/provider';
export default function TransporterScreen(){const {handle}=useLocalSearchParams<{handle:string}>();return <Profile key={String(handle)} handle={typeof handle==='string'?handle:''}/>;}
function Profile({handle}:{handle:string}){
 const {t}=useLanguage();
 const {height}=useWindowDimensions();
 const [details,setDetails]=useState(false),[documents,setDocuments]=useState(false);
 const query=usePublicQuery<PublicProvider>(`/api/mobile/public/providers/${encodeURIComponent(handle)}?view=map`),provider=query.data;
 const poster=provider?.youtubeId?coverPosterPath(provider.youtubeId):null;
 return <Page><View style={styles.workspace}><ErrorText message={query.error}/>{query.loading&&!provider&&<LoadingSpinner accessibilityLabel="Loading transporter"/>}{!!query.error&&<Button message="Try again" onPress={()=>{void query.reload();}}/>}
 {provider&&<ContentSafety handle={provider.handle}> {!!poster&&<Link href={`https://www.youtube.com/watch?v=${provider.youtubeId}`} asChild><Pressable accessibilityRole="link" accessibilityLabel={t('Play cover video')} style={styles.cover}>
   <ImageBackground source={{uri:poster.startsWith('/')?apiOrigin+poster:poster}} resizeMode="cover" style={[styles.poster,{height:Math.max(160,Math.min(280,height*.24))}]}><Text style={styles.play}>▶  {t('Cover video')}{provider.youtubeId===exampleCover.id?' · '+exampleCover.credit:''}</Text></ImageBackground>
 </Pressable></Link>}
 <View style={styles.identity}><PublicCardImage path={provider.image} label={provider.accountName||provider.name} portrait identity={provider.isCompany?'company':'person'}/><View style={styles.identityText}><Text accessibilityRole="header" style={styles.title}>{provider.accountName||provider.name}</Text><Text style={styles.caption}>@{provider.handle}</Text><Text style={styles.caption}>{t('Transport Provider')}{provider.city?` · ${provider.city}`:''}</Text>{!!provider.managerName&&<Text style={styles.caption}>{t('Account manager')} · {provider.managerName}</Text>}</View></View>
 {!!provider.headline&&<Text style={styles.introduction}>{provider.headline}</Text>}
 <View style={styles.contacts}>
 {!!provider.contacts.phone&&<View style={styles.contact}><ExternalButton label={t('Call transporter')} url={`tel:${provider.contacts.phone}`}/></View>}
 {!!provider.contacts.whatsapp&&<View style={styles.contact}><ExternalButton label={t('WhatsApp')} url={`https://wa.me/${provider.contacts.whatsapp.replace(/\D/g,'')}`}/></View>}
 {!!provider.contacts.email&&<View style={styles.contact}><ExternalButton label={t('Email transporter')} url={`mailto:${provider.contacts.email}`}/></View>}
 {!!provider.contacts.website&&<View style={styles.contact}><ExternalButton label={t('Website')} url={provider.contacts.website}/></View>}
 </View>

 <View style={styles.switches}>
  <Pressable accessibilityRole="button" accessibilityState={{expanded:documents}} onPress={()=>setDocuments(!documents)} style={styles.switch}><Text style={styles.switchText}>{t('Account documents')}</Text><AppIcon name={documents?'chevronUp':'chevronDown'} size={16}/></Pressable>
  <Pressable accessibilityRole="button" accessibilityState={{expanded:details}} onPress={()=>setDetails(!details)} style={styles.switch}><Text style={styles.switchText}>{t('About this transporter')}</Text><AppIcon name={details?'chevronUp':'chevronDown'} size={16}/></Pressable>
 </View>
 {documents&&<PublicCard><PublicBadges items={provider.badges} rows/></PublicCard>}
 {details&&<>
 <PublicCard><PublicCardHeading message="Verified shipment reviews"/>{provider.reviewCount>0&&<Text style={styles.rating}>{t('{rating} / 5 · {count} reviews',{rating:provider.averageRating??'—',count:provider.reviewCount})}</Text>}{!provider.reviews.length&&<Copy message="No verified shipment reviews yet."/>}{provider.reviews.map((review,index)=><View key={index} style={styles.review}><Text style={styles.caption}>{review.rating} / 5 · {review.createdAt.slice(0,10)}{review.disputed?' · '+t('Under dispute'):''}</Text><Copy>{review.note}</Copy>{!!review.id&&<ContentSafety handle={handle} reviewId={review.id}/>}</View>)}</PublicCard>
 {!!provider.about&&<PublicCard><PublicCardHeading message="About this transporter"/><Copy>{provider.about}</Copy></PublicCard>}

 </>}
 <View testID="profile-fleet-map" style={[styles.map,{height:Math.max(360,Math.min(690,height*.62))}]}><ProviderFleetMap handle={provider.handle}/></View>
 </ContentSafety>}
 </View></Page>;
}
const styles=StyleSheet.create({
 cover:{borderRadius:10,overflow:'hidden',backgroundColor:palette.ink},poster:{height:108,alignItems:'flex-start',justifyContent:'flex-end',padding:8},play:{color:'#fff',backgroundColor:'#132b46',padding:7,borderRadius:6,fontWeight:'700'},
 map:{overflow:'hidden',borderRadius:12,borderWidth:1,borderColor:palette.border},switches:{flexDirection:'row',gap:8},switch:{flex:1,minHeight:44,borderColor:palette.border,borderWidth:1,borderRadius:9,alignItems:'center',justifyContent:'space-between',paddingHorizontal:9,flexDirection:'row'},switchText:{flex:1,color:palette.ink,fontWeight:'600'},
 workspace:{width:'100%',maxWidth:820,alignSelf:'center',gap:14},identity:{flexDirection:'row',gap:12,alignItems:'center'},identityText:{flex:1,gap:4},title:{fontSize:21,lineHeight:27,fontWeight:'700',color:palette.ink},introduction:{fontSize:14,lineHeight:21,color:palette.muted},caption:{fontSize:12,lineHeight:18,color:palette.muted},
 contacts:{flexDirection:'row',flexWrap:'wrap',gap:10},contact:{flexBasis:'45%',flexGrow:1},rating:{fontSize:14,lineHeight:20,fontWeight:'600',color:palette.ink},review:{gap:7,paddingVertical:10,borderTopWidth:1,borderTopColor:palette.borderSoft},
});
