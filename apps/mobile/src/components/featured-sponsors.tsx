import {useCallback,useEffect,useState} from 'react';
import {AccessibilityInfo,AppState,Image,Platform,Pressable,StyleSheet,Text,View} from 'react-native';
import {Link,useFocusEffect} from 'expo-router';
import {apiOrigin} from '../api/http';
import type {Featured} from '../api/public-content';
import {useLanguage} from '../localization/provider';
import {ExternalButton} from './public-details';
import {palette} from './ui';

export function FeaturedSponsors({items}:{items:Featured['sponsors']}){
 const {t}=useLanguage(),[index,setIndex]=useState(0),[paused,setPaused]=useState(false);
 const [reduced,setReduced]=useState(true),[reader,setReader]=useState(Platform.OS!=='web');
 useEffect(()=>{
  let mounted=true;
  void AccessibilityInfo.isReduceMotionEnabled().then(x=>{if(mounted)setReduced(Boolean(x));}).catch(()=>{});
  // React Native Web reports a screen reader for every browser. Its motion
  // preference remains available, as do the manual rotation controls.
  if(Platform.OS!=='web')void AccessibilityInfo.isScreenReaderEnabled().then(x=>{if(mounted)setReader(Boolean(x));}).catch(()=>{});
  const motion=AccessibilityInfo.addEventListener('reduceMotionChanged',setReduced);
  const speech=Platform.OS==='web'?undefined:AccessibilityInfo.addEventListener('screenReaderChanged',setReader);
  return ()=>{mounted=false;motion?.remove();speech?.remove();};
 },[]);
 const count=items.length;
 useFocusEffect(useCallback(()=>{
  if(count<2||paused||reduced||reader)return;
  const timer=setInterval(()=>{if(AppState.currentState==='active')setIndex(i=>(i+1)%count);},8000);
  return ()=>clearInterval(timer);
 },[count,paused,reduced,reader]));
 if(!count)return null;
 const current=index%count,sponsor=items[current];
 const step=(n:number)=>{setIndex((current+n+count)%count);setPaused(true);};
 return <View style={styles.panel}><View style={styles.header}><Text accessibilityRole="header" style={styles.title}>{t('Sponsors')}</Text>
  {count>1&&<View style={styles.controls}>
   <Pressable accessibilityRole="button" accessibilityLabel={t('Previous sponsor')} onPress={()=>step(-1)} style={styles.control}><Text>‹</Text></Pressable>
   <Text>{current+1} / {count}</Text>
   {!reduced&&!reader&&<Pressable accessibilityRole="button" accessibilityLabel={t(paused?'Resume rotation':'Pause rotation')} onPress={()=>setPaused(!paused)} style={styles.control}><Text>{paused?'▶':'Ⅱ'}</Text></Pressable>}
   <Pressable accessibilityRole="button" accessibilityLabel={t('Next sponsor')} onPress={()=>step(1)} style={styles.control}><Text>›</Text></Pressable>
  </View>}</View>
  <View style={styles.card}>{!!sponsor.image&&<Image accessible={false} source={{uri:apiOrigin+sponsor.image}} style={styles.image}/>}
   <View style={styles.copy}><Text style={styles.title}>{sponsor.name}</Text>{!!sponsor.description&&<Text>{sponsor.description}</Text>}
   {sponsor.kind==='TRANSPORTER'?<Link href={{pathname:'/transporter',params:{handle:sponsor.handle}}} style={styles.link}>{t('Transporter profile')}</Link>:<View style={styles.links}>{!!sponsor.phone&&<ExternalButton label={t('Call sponsor')} url={`tel:${sponsor.phone}`}/>}
   {!!sponsor.website&&<ExternalButton label={t('Visit page')} url={sponsor.website}/>}</View>}</View></View>
 </View>;
}
const styles=StyleSheet.create({
 panel:{gap:8,borderWidth:1,borderColor:palette.border,borderRadius:12,padding:12,backgroundColor:'#f4f7fa'},
 header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap'},controls:{flexDirection:'row',alignItems:'center'},
 control:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'},title:{fontSize:17,fontWeight:'700',color:palette.ink},
 card:{flexDirection:'row',backgroundColor:'#fff',borderRadius:8,overflow:'hidden'},image:{width:'30%',minHeight:120},copy:{flex:1,padding:10,gap:6},
 links:{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:8},link:{minHeight:44,color:palette.blue,paddingVertical:10}
});
