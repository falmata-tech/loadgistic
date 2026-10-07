import { useEffect,useRef,useState,type PropsWithChildren } from 'react';
import { Animated,Pressable,Text,View } from 'react-native';
import { palette } from './ui';
import {AppIcon} from './app-icon';
import {useLanguage} from '../localization/provider';
export function ResultsDrawer({children,onClose,top=68}:{onClose:()=>void;top?:number}&PropsWithChildren) {
 const {t}=useLanguage();
 const [position]=useState(()=>new Animated.Value(-380));
 const start=useRef<{x:number;y:number}|null>(null);
 useEffect(()=>{const animation=Animated.timing(position,{toValue:0,duration:180,useNativeDriver:true});animation.start();return()=>animation.stop();},[position]);
 const close=()=>Animated.timing(position,{toValue:-380,duration:140,useNativeDriver:true}).start(({finished})=>{if(finished)onClose();});
 return <Animated.View style={{position:'absolute',top,left:12,bottom:12,width:'88%',maxWidth:360,backgroundColor:'#fff',borderRadius:16,borderWidth:1,borderColor:palette.border,overflow:'hidden',transform:[{translateX:position}]}}>
 <View onTouchStart={event=>{start.current={x:event.nativeEvent.pageX,y:event.nativeEvent.pageY};}} onTouchEnd={event=>{const first=start.current;start.current=null;if(first&&event.nativeEvent.pageX-first.x< -55&&Math.abs(event.nativeEvent.pageY-first.y)<40)close();}} style={{minHeight:44,borderBottomWidth:1,borderColor:palette.border,paddingHorizontal:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={{color:palette.ink,fontWeight:'600'}}>{t('Transporters')}</Text><Pressable accessibilityRole="button" accessibilityLabel={t('Close transporter results')} onPress={close} style={{minHeight:44,minWidth:44,justifyContent:'center'}}><AppIcon name="close" color={palette.teal}/></Pressable></View>
 {children}</Animated.View>;
}
