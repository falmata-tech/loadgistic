import { useEffect,useState } from 'react';
import { AccessibilityInfo,Animated,View } from 'react-native';
import {useLanguage} from '../localization/provider';
import {palette} from './ui';
export function LoadingBar({label}:{label:string}) {
 const {t}=useLanguage();
 const [progress]=useState(()=>new Animated.Value(0));
 // Stay static until the preference is known, including on a failed read.
 const [reduceMotion,setReduceMotion]=useState(true);
 useEffect(()=>{
  let active=true,changed=false;
  const listener=AccessibilityInfo.addEventListener('reduceMotionChanged',value=>{changed=true;if(active)setReduceMotion(value);});
  void AccessibilityInfo.isReduceMotionEnabled().then(value=>{if(active&&!changed)setReduceMotion(value);}).catch(()=>{});
  return()=>{active=false;listener.remove();};
 },[]);
 useEffect(()=>{
  if(reduceMotion){progress.setValue(.5);return;}
  const animation=Animated.loop(Animated.sequence([Animated.timing(progress,{toValue:1,duration:900,useNativeDriver:true}),Animated.timing(progress,{toValue:0,duration:900,useNativeDriver:true})]));
  animation.start();return()=>animation.stop();
 },[progress,reduceMotion]);
 return <View accessibilityRole="progressbar" accessibilityLabel={t(label)} accessibilityState={{busy:true}} style={{height:4,overflow:'hidden',backgroundColor:palette.blueSoft,borderRadius:2}}><Animated.View style={{height:4,width:'100%',backgroundColor:palette.blue,transform:[{scaleX:progress.interpolate({inputRange:[0,1],outputRange:[.12,1]})}],opacity:progress.interpolate({inputRange:[0,1],outputRange:[.45,1]})}}/></View>;
}
