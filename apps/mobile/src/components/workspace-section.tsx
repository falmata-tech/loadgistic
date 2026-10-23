import {useState,type PropsWithChildren} from 'react';
import {Keyboard,Pressable,StyleSheet,Text,View} from 'react-native';
import {useLanguage} from '../localization/provider';
import {AppIcon,type IconName} from './app-icon';
import {palette} from './ui';

// Lazy first mount; collapsing must not discard drafts or cancel pending saves.
export function WorkspaceSection({message,label,icon,children,initiallyOpen=false}:PropsWithChildren<({message:string;label?:never}|{label:string;message?:never})&{icon:IconName;initiallyOpen?:boolean}>){
 const {t}=useLanguage(),[open,setOpen]=useState(initiallyOpen),[visited,setVisited]=useState(initiallyOpen);
 const title=label===undefined?t(message):label;
 return <View style={styles.section}>
  <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{expanded:open}} onPress={()=>{Keyboard.dismiss();setVisited(true);setOpen(value=>!value);}} style={styles.heading}>
   <AppIcon name={icon} color={palette.blue}/><Text style={styles.label}>{title}</Text><View style={{transform:[{rotate:open?'90deg':'0deg'}]}}><AppIcon name="next" size={18}/></View>
  </Pressable>
  {visited&&<View style={[styles.body,!open&&styles.hidden]} accessibilityElementsHidden={!open} importantForAccessibility={open?'auto':'no-hide-descendants'}>{children}</View>}
 </View>;
}
const styles=StyleSheet.create({section:{borderWidth:1,borderColor:palette.border,borderRadius:14,backgroundColor:'#fff',overflow:'hidden'},heading:{minHeight:56,flexDirection:'row',alignItems:'center',gap:12,padding:14},label:{flex:1,fontSize:16,fontWeight:'700',color:palette.ink},body:{padding:14,paddingTop:4},hidden:{display:'none'}});
