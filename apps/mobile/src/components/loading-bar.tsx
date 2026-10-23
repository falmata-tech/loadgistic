import { useEffect,useState } from 'react';
import { Animated,View } from 'react-native';
import {useLanguage} from '../localization/provider';
import {palette} from './ui';
export function LoadingBar({label}:{label:string}) {
 const {t}=useLanguage();
 const [progress]=useState(()=>new Animated.Value(0));
 useEffect(()=>{const animation=Animated.loop(Animated.sequence([Animated.timing(progress,{toValue:1,duration:900,useNativeDriver:true}),Animated.timing(progress,{toValue:0,duration:900,useNativeDriver:true})]));animation.start();return()=>animation.stop();},[progress]);
 return <View accessibilityRole="progressbar" accessibilityLabel={t(label)} style={{height:4,overflow:'hidden',backgroundColor:palette.blueSoft,borderRadius:2}}><Animated.View style={{height:4,width:'100%',backgroundColor:palette.blue,transform:[{scaleX:progress.interpolate({inputRange:[0,1],outputRange:[.12,1]})}],opacity:progress.interpolate({inputRange:[0,1],outputRange:[.45,1]})}}/></View>;
}
