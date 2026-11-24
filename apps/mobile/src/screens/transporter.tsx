import {useEffect,useState} from 'react';
import {coverPlayerTimeoutMs,coverPosterPath} from '../../../../src/lib/provider-cover-video.js';
import {apiOrigin} from '../api/http';
import {ProviderFleetMap} from './capacity';
import {ContentSafety} from '../components/content-safety';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ImageBackground, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { usePublicQuery } from '../hooks/public-query';
import type { PublicProvider } from '../api/public-content';
import { Page, Copy, Button, ErrorText, palette, LoadingSpinner } from '../components/ui';
import { PublicBadges,ExternalButton } from '../components/public-details';
import {PublicCard,PublicCardHeading,PublicCardImage} from '../components/public-card';
import {useLanguage} from '../localization/provider';
import {CoverVideoPlayer} from '../components/cover-video-player';

function CoverVideo({videoId,poster}:{videoId:string;poster:string}){
 const {t}=useLanguage();
 const [stage,setStage]=useState<'poster'|'loading'|'ready'|'failed'>('poster');
 const active=stage==='loading'||stage==='ready';
 const start=()=>setStage('loading');
 useEffect(()=>{
  if(stage!=='loading')return;
  const timeout=setTimeout(()=>setStage('failed'),coverPlayerTimeoutMs);
  return ()=>clearTimeout(timeout);
 },[stage]);
 return <View style={[styles.film,styles.cover]}>
  {active&&<View style={StyleSheet.absoluteFill}>
   <CoverVideoPlayer videoId={videoId} title={t('Cover video')} loading={stage==='loading'} onResult={setStage}/>
  </View>}
  {stage!=='ready'&&<ImageBackground source={{uri:poster.startsWith('/')?apiOrigin+poster:poster}}
    resizeMode="cover" style={styles.poster}>
   {stage==='poster'&&<Pressable accessibilityRole="button" accessibilityLabel={t('Play cover video')} onPress={start} style={styles.play}>
    <Text style={styles.playIcon}>▶</Text>
   </Pressable>}
   {stage==='loading'&&<View style={[styles.feedback,styles.loading]} accessibilityLiveRegion="polite">
    <ActivityIndicator color="#fff"/><Text style={styles.feedbackText}>{t('Loading video…')}</Text>
   </View>}
   {stage==='failed'&&<View style={styles.feedback}>
    <Text style={styles.feedbackText} accessibilityLiveRegion="polite">{t('Video couldn’t load.')}</Text>
    <View style={styles.coverActions}>
     <Button message="Try again" secondary onPress={start}/>
     <ExternalButton label={t('Watch on YouTube')} url={`https://www.youtube.com/watch?v=${videoId}`} failureMessage={t('Video couldn’t load.')}/>
    </View>
   </View>}
  </ImageBackground>}
 </View>;
}

export default function TransporterScreen(){const {handle}=useLocalSearchParams<{handle:string}>();return <Profile key={String(handle)} handle={typeof handle==='string'?handle:''}/>;}
function Profile({handle}:{handle:string}){
 const {t}=useLanguage();
 const {height,width}=useWindowDimensions();
 const query=usePublicQuery<PublicProvider>(`/api/mobile/public/providers/${encodeURIComponent(handle)}?view=map`),provider=query.data;
 const poster=provider?.youtubeId?coverPosterPath(provider.youtubeId):null;
 return <Page><View style={styles.workspace}><ErrorText message={query.error}/>{query.loading&&!provider&&<LoadingSpinner accessibilityLabel="Loading transporter"/>}{!!query.error&&<Button message="Try again" onPress={()=>{void query.reload();}}/>}
 {provider&&<ContentSafety handle={provider.handle}>
 <PublicCard>
  <View style={[styles.hero,poster&&width>=760?styles.heroWide:undefined]}>
   <View style={styles.main}>
    <View style={styles.identity}>
     <PublicCardImage path={provider.image} label={provider.accountName||provider.name} portrait identity={provider.isCompany?'company':'person'}/>
     <View style={styles.identityText}>
      <Text style={styles.kind}>{t('Transport Provider')}</Text>
      <Text accessibilityRole="header" style={styles.title}>{provider.accountName||provider.name}</Text>
      <Text style={styles.caption}>@{provider.handle}</Text>
      {provider.exampleAccount===true&&<Text style={styles.caption}>{t('Example account')}</Text>}
     </View>
    </View>
    {!!provider.headline&&<Text style={styles.introduction}>{provider.headline}</Text>}
    {!!provider.city&&<Text style={styles.caption}>{provider.city}</Text>}
    {!!provider.managerName&&<Text style={styles.caption}>{t('Account manager')} · {provider.managerName}</Text>}
    {(provider.contacts.phone||provider.contacts.whatsapp||provider.contacts.email||provider.contacts.website)?<View style={styles.contacts}>
     {!!provider.contacts.phone&&<View style={styles.contact}><ExternalButton label={t('Call transporter')} url={`tel:${provider.contacts.phone}`}/></View>}
     {!!provider.contacts.whatsapp&&<View style={styles.contact}><ExternalButton label={t('WhatsApp')} url={`https://wa.me/${provider.contacts.whatsapp.replace(/\D/g,'')}`}/></View>}
     {!!provider.contacts.email&&<View style={styles.contact}><ExternalButton label={t('Email transporter')} url={`mailto:${provider.contacts.email}`}/></View>}
     {!!provider.contacts.website&&<View style={styles.contact}><ExternalButton label={t('Website')} url={provider.contacts.website}/></View>}
    </View>:null}
   </View>
   {!!poster&&<CoverVideo key={provider.youtubeId} videoId={provider.youtubeId} poster={poster}/>}
  </View>
  <View style={styles.documents}>
   <PublicCardHeading message="Account documents"/>
   {provider.badges.length?<PublicBadges items={provider.badges} rows/>:<Copy message="No reviewed account documents yet."/>}
  </View>
 </PublicCard>
 <PublicCard>
  {!!provider.about&&<View style={styles.about}><PublicCardHeading message="About this transporter"/><Copy>{provider.about}</Copy></View>}
  <PublicCardHeading message="Verified shipment reviews"/>
  {provider.reviewCount>0&&<Text style={styles.rating}>{t('{rating} / 5 · {count} reviews',{rating:provider.averageRating??'—',count:provider.reviewCount})}</Text>}
  {!provider.reviews.length&&<Copy message="No verified shipment reviews yet."/>}
  {provider.reviews.map((review,index)=><View key={index} style={styles.review}>
   <Text style={styles.caption}>{review.rating} / 5 · {review.createdAt.slice(0,10)}{review.disputed?' · '+t('Under dispute'):''}</Text>
   <Copy>{review.note}</Copy>{!!review.id&&<ContentSafety handle={handle} reviewId={review.id}/>}
  </View>)}
 </PublicCard>
 <View testID="profile-fleet-map" style={[styles.map,{height:Math.max(360,Math.min(690,height*.62))}]}><ProviderFleetMap handle={provider.handle}/></View>
 </ContentSafety>}
 </View></Page>;
}
const styles=StyleSheet.create({
 workspace:{width:'100%',maxWidth:900,alignSelf:'center',gap:12},
 hero:{gap:12},heroWide:{flexDirection:'row',alignItems:'center'},
 main:{flex:1,minWidth:0,gap:6},film:{flex:1,minWidth:0},
 identity:{flexDirection:'row',gap:10,alignItems:'center'},
 identityText:{flex:1,minWidth:0,gap:2},
 kind:{color:palette.blue,fontSize:12,fontWeight:'700'},
 title:{fontSize:22,lineHeight:26,fontWeight:'700',color:palette.ink},
 introduction:{fontSize:14,lineHeight:19,color:palette.ink},
 caption:{fontSize:12,lineHeight:17,color:palette.muted},
 contacts:{flexDirection:'row',flexWrap:'wrap',gap:7},contact:{flexBasis:'45%',flexGrow:1},
 cover:{aspectRatio:16/9,minHeight:200,borderRadius:10,overflow:'hidden',backgroundColor:palette.ink},
 poster:{...StyleSheet.absoluteFill,alignItems:'center',justifyContent:'center',padding:10},
 play:{width:56,height:56,alignItems:'center',justifyContent:'center',borderRadius:28,backgroundColor:'#132b46'},
 playIcon:{color:'#fff',fontSize:22},
 feedback:{maxWidth:'100%',padding:10,borderRadius:10,backgroundColor:'#132b46',alignItems:'center',gap:7},
 feedbackText:{color:'#fff',fontSize:14,textAlign:'center'},
 coverActions:{flexDirection:'row',flexWrap:'wrap',justifyContent:'center',gap:6},
 loading:{flexDirection:'row'},
 documents:{gap:4,marginTop:8,paddingTop:10,borderTopWidth:1,borderTopColor:palette.borderSoft},
 about:{gap:4,marginBottom:8},
 rating:{fontSize:14,lineHeight:20,fontWeight:'600',color:palette.ink},
 review:{gap:7,paddingVertical:10,borderTopWidth:1,borderTopColor:palette.borderSoft},
 map:{overflow:'hidden',borderRadius:12,borderWidth:1,borderColor:palette.border},
});
