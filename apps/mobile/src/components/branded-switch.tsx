import {Pressable,StyleSheet,View} from 'react-native';
import {useLanguage} from '../localization/provider';
import {palette} from './ui';

/** One accessible blue control for native and Expo web settings. */
export function Switch({accessibilityLabel,value,onValueChange,disabled=false}:{accessibilityLabel:string;value:boolean;onValueChange:(value:boolean)=>void;disabled?:boolean}){
 const {t}=useLanguage();
 return <Pressable accessibilityRole="switch" accessibilityLabel={t(accessibilityLabel)} accessibilityState={{checked:value,disabled}} aria-checked={value}
  disabled={disabled} onPress={()=>onValueChange(!value)} style={[styles.hit,disabled&&styles.disabled]}>
  <View style={[styles.track,value&&styles.trackOn]}><View style={[styles.thumb,value&&styles.thumbOn]}/></View>
 </Pressable>;
}
const styles=StyleSheet.create({hit:{width:52,minHeight:44,alignItems:'center',justifyContent:'center'},disabled:{opacity:.55},track:{width:44,height:26,borderRadius:99,borderWidth:1,borderColor:palette.border,backgroundColor:'#d7dfeb',justifyContent:'center',paddingHorizontal:3,alignItems:'flex-start'},trackOn:{borderColor:palette.blue,backgroundColor:palette.blueSoft,alignItems:'flex-end'},thumb:{width:18,height:18,borderRadius:99,backgroundColor:'#fff',shadowColor:'#0b1d3a',shadowOpacity:.16,shadowRadius:2,shadowOffset:{width:0,height:1}},thumbOn:{backgroundColor:palette.blue}});
