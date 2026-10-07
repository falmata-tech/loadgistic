import { useEffect,useState } from 'react';
import { Animated,View } from 'react-native';
export function LoadingBar({label}:{label:string}) {
 const [progress]=useState(()=>new Animated.Value(0));
 useEffect(()=>{const animation=Animated.loop(Animated.sequence([Animated.timing(progress,{toValue:1,duration:900,useNativeDriver:true}),Animated.timing(progress,{toValue:0,duration:900,useNativeDriver:true})]));animation.start();return()=>animation.stop();},[progress]);
 return <View accessibilityRole="progressbar" accessibilityLabel={label} style={{height:4,overflow:'hidden',backgroundColor:'#dceeee',borderRadius:2}}><Animated.View style={{height:4,width:'100%',backgroundColor:'#0c7275',transform:[{scaleX:progress.interpolate({inputRange:[0,1],outputRange:[.12,1]})}],opacity:progress.interpolate({inputRange:[0,1],outputRange:[.45,1]})}}/></View>;
}
