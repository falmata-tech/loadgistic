import {useState,type ReactNode,type PropsWithChildren} from 'react';
import {Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {useLanguage} from '../localization/provider';
import {AppIcon,type IconName} from './app-icon';
import {palette} from './ui';

export type WorkspaceTab={id:string;message:string;count?:number};
// Keep a visited task mounted so a tab change cannot discard a draft or pending save.
export function WorkspaceTaskPane({active,children}:PropsWithChildren<{active:boolean}>){
 const [visited,setVisited]=useState(active);
 if(active&&!visited)setVisited(true);
 return active||visited?<View style={[{gap:16},!active&&{display:'none'}]} aria-hidden={!active} accessibilityElementsHidden={!active} importantForAccessibility={active?'auto':'no-hide-descendants'}>{children}</View>:null;
}
export function WorkspaceTabs({value,items,onChange}:{value:string;items:WorkspaceTab[];onChange:(value:string)=>void}){
 const {t}=useLanguage();
 return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabs} accessibilityRole="tablist">{items.map(item=><Pressable key={item.id} accessibilityRole="tab" accessibilityLabel={t(item.message)} accessibilityState={{selected:value===item.id}} onPress={()=>onChange(item.id)} style={[styles.tab,value===item.id&&styles.activeTab]}><Text style={[styles.tabText,value===item.id&&styles.activeText]}>{t(item.message)}</Text>{item.count!==undefined&&<Text style={styles.count}>{item.count}</Text>}</Pressable>)}</ScrollView>;
}
export function WorkspaceTaskHeader({title,subtitle,onBack,backMessage,actions}:{title:string;subtitle?:string;onBack:()=>void;backMessage:string;actions?:ReactNode}){
 const {t}=useLanguage();
 return <View style={styles.taskHeader}><Pressable accessibilityRole="button" accessibilityLabel={t(backMessage)} onPress={onBack} style={styles.back}><AppIcon name="back" color={palette.teal}/><Text style={styles.backText}>{t(backMessage)}</Text></Pressable><View style={styles.titleRow}><View style={styles.titleCopy}><Text style={styles.title}>{title}</Text>{!!subtitle&&<Text style={styles.subtitle}>{subtitle}</Text>}</View>{actions}</View></View>;
}
export function WorkspaceFact({message,value}:{message:string;value:string}){
 const {t}=useLanguage();return <View style={styles.fact}><Text style={styles.factLabel}>{t(message)}</Text><Text style={styles.factValue}>{value||'—'}</Text></View>;
}
export function WorkspaceAction({message,detail,icon,onPress}:{message:string;detail?:string;icon:IconName;onPress:()=>void}){
 const {t}=useLanguage();return <Pressable accessibilityRole="button" accessibilityLabel={t(message)} onPress={onPress} style={styles.action}><View style={styles.actionIcon}><AppIcon name={icon} color={palette.teal}/></View><View style={styles.titleCopy}><Text style={styles.actionLabel}>{t(message)}</Text>{!!detail&&<Text style={styles.subtitle}>{t(detail)}</Text>}</View><AppIcon name="next" size={18}/></Pressable>;
}
const styles=StyleSheet.create({tabScroll:{height:52,flexGrow:0,flexShrink:0},tabs:{minWidth:'100%',borderBottomWidth:1,borderBottomColor:palette.border,gap:18},tab:{minHeight:48,flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:2,borderBottomWidth:3,borderBottomColor:'transparent'},activeTab:{borderBottomColor:palette.teal},tabText:{fontSize:14,fontWeight:'600',color:palette.muted},activeText:{color:palette.teal},count:{fontSize:11,fontWeight:'700',color:palette.muted,backgroundColor:'#edf3f3',paddingHorizontal:6,paddingVertical:3,borderRadius:6},taskHeader:{gap:12},back:{alignSelf:'flex-start',minHeight:44,flexDirection:'row',alignItems:'center',gap:7},backText:{fontSize:14,fontWeight:'600',color:palette.teal},titleRow:{flexDirection:'row',alignItems:'center',gap:12},titleCopy:{flex:1,minWidth:0},title:{fontSize:23,lineHeight:29,fontWeight:'700',color:palette.ink},subtitle:{fontSize:13,lineHeight:20,color:palette.muted,marginTop:3},fact:{paddingVertical:10,borderBottomWidth:1,borderBottomColor:'#edf1f2',gap:4},factLabel:{fontSize:12,color:palette.muted},factValue:{fontSize:15,lineHeight:22,fontWeight:'600',color:palette.ink},action:{flexDirection:'row',alignItems:'center',gap:12,minHeight:68,paddingVertical:10,borderBottomWidth:1,borderBottomColor:'#edf1f2'},actionIcon:{width:40,height:40,alignItems:'center',justifyContent:'center',backgroundColor:'#edf6f5',borderRadius:10},actionLabel:{fontSize:16,fontWeight:'600',color:palette.ink}});
