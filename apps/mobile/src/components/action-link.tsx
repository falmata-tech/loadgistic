import {Link,type Href} from 'expo-router';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {useLanguage} from '../localization/provider';
import {AppIcon,type IconName} from './app-icon';
import {palette} from './ui';
// Same icon / label / chevron action-card structure as the web dashboard.
export function ActionLink({href,message,label,icon}:{href:Href;icon:IconName}&({message:string;label?:never}|{label:string;message?:never})){
 const {t}=useLanguage();
 return <Link href={href} asChild><Pressable accessibilityRole="link" style={styles.row}><View style={styles.icon}><AppIcon name={icon} color={palette.teal}/></View><Text style={styles.text}>{message===undefined?label:t(message)}</Text><AppIcon name="next" size={19}/></Pressable></Link>;
}
const styles=StyleSheet.create({row:{minHeight:66,borderWidth:1,borderColor:palette.border,borderRadius:14,padding:12,flexDirection:'row',alignItems:'center',gap:12,backgroundColor:'#fff'},icon:{width:40,height:40,borderRadius:11,backgroundColor:'#e7f5f2',alignItems:'center',justifyContent:'center'},text:{flex:1,color:palette.ink,fontSize:16,fontWeight:'700'}});
