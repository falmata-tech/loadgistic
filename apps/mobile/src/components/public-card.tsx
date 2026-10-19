import {useState,type PropsWithChildren,type ComponentProps} from 'react';
import {Image,Pressable,StyleSheet,Text,View} from 'react-native';
import {Link} from 'expo-router';
import {apiOrigin} from '../api/http';
import {useLanguage} from '../localization/provider';
import {AppIcon,type IconName} from './app-icon';
import {palette} from './ui';

/** Presentation only: callers retain the existing data and destinations. */
export function PublicCard({children}:PropsWithChildren){return <View testID="public-summary-card" style={styles.card}>{children}</View>;}
export function PublicCardHeading({children,message}:PropsWithChildren<{message?:string}>){const {t}=useLanguage();return <Text accessibilityRole="header" style={styles.heading}>{message===undefined?children:t(message)}</Text>;}
export function PublicCardFact({icon,children}:PropsWithChildren<{icon:IconName}>){return <View style={styles.fact}><AppIcon name={icon} size={16}/><Text style={styles.factText}>{children}</Text></View>;}
export function PublicCardAction({href,message,icon='external'}:{href:ComponentProps<typeof Link>['href'];message:string;icon?:IconName}){const {t}=useLanguage();return <Link href={href} asChild><Pressable accessibilityRole="link" style={styles.action}><AppIcon name={icon} size={16} color={palette.teal}/><Text style={styles.actionText}>{t(message)}</Text></Pressable></Link>;}
export function PublicCardImage({path,label,portrait=false,identity}:{path:string;label:string;portrait?:boolean;identity?:'company'|'person'}){
 const [failed,setFailed]=useState(''),hasImage=Boolean(path&&failed!==path);
 return <View accessible={hasImage?undefined:true} accessibilityRole={hasImage?undefined:'image'} accessibilityLabel={hasImage?undefined:label} style={[styles.image,portrait&&styles.portrait]}>{hasImage?<Image source={{uri:apiOrigin+path}} accessibilityLabel={label} onError={()=>setFailed(path)} resizeMode={portrait?'cover':'contain'} style={styles.picture}/>:<AppIcon name={identity==='company'?'profile':identity==='person'||portrait?'user':'truck'} size={32} color="#789294"/>}</View>;
}
const styles=StyleSheet.create({
 card:{borderWidth:1,borderColor:'#dce5e5',borderRadius:12,padding:14,gap:12,backgroundColor:'#fff'},
 heading:{fontSize:17,lineHeight:23,fontWeight:'700',color:palette.ink},
 fact:{flexDirection:'row',alignItems:'flex-start',gap:8},factText:{flex:1,fontSize:13,lineHeight:19,color:palette.muted},
 action:{minHeight:44,maxWidth:'100%',paddingVertical:10,paddingHorizontal:12,borderWidth:1,borderColor:'#c5dada',borderRadius:8,flexDirection:'row',alignItems:'center',justifyContent:'center',gap:7},actionText:{fontSize:13,lineHeight:18,fontWeight:'700',color:palette.teal,flexShrink:1},
 image:{width:88,height:64,alignItems:'center',justifyContent:'center',backgroundColor:'#f5f8f7',borderRadius:8,overflow:'hidden'},portrait:{width:64,height:72,backgroundColor:'#e5efec'},picture:{width:'100%',height:'100%'},
});
