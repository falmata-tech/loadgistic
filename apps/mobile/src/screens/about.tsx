import {useState} from 'react';
import {Link} from 'expo-router';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {Page,ErrorText,palette} from '../components/ui';
import {AppIcon} from '../components/app-icon';
import * as Linking from 'expo-linking';
import {useLanguage} from '../localization/provider';
import {platformAbout} from '../../../../src/lib/platform-copy.js';

export default function About(){
  const {t}=useLanguage(),[selected,setSelected]=useState(0),[error,setError]=useState(''),audience=platformAbout.audiences[selected];
  return <Page><View style={styles.workspace}><View style={styles.introduction}><Text accessibilityRole="header" style={styles.title}>{t(platformAbout.title)}</Text><Text style={styles.body}>{t(platformAbout.body)}</Text></View>
    <View style={styles.choices}>{platformAbout.audiences.map((item,index)=><Pressable key={item.id} accessibilityRole="button" accessibilityState={{selected:selected===index}} onPress={()=>setSelected(index)} style={[styles.choice,selected===index&&styles.active]}><AppIcon name={index===0?'network':index===1?'truck':'profile'} size={21} color={selected===index?palette.blue:palette.muted}/><Text style={[styles.choiceLabel,selected===index&&styles.activeLabel]}>{t(item.label)}</Text></Pressable>)}</View>
    <View style={styles.panel}><Text accessibilityRole="header" style={styles.heading}>{t(audience.heading)}</Text>
      {audience.facts.map(([title,body])=><View key={title} style={styles.fact}><AppIcon name="check" size={18} color={palette.blue}/><View style={styles.factText}><Text style={styles.factTitle}>{t(title)}</Text><Text style={styles.body}>{t(body)}</Text></View></View>)}
      <Link href={selected===0?'/':'/account'} asChild><Pressable accessibilityRole="link" style={styles.action}><Text style={styles.actionLabel}>{t(audience.action)}</Text><AppIcon name="next" color="#fff" size={20}/></Pressable></Link>
    </View>
    <View style={styles.legal}><Link href="/privacy" style={styles.legalLink}>{t('Privacy')}</Link><Pressable accessibilityRole="link" onPress={()=>{setError('');void Linking.openURL('https://loadgistic.com/terms').catch(()=>setError('This phone could not open that contact. Please try another contact method.'));}}><Text style={styles.legalLink}>{t('Terms')}</Text></Pressable><Link href="/delete-account" style={styles.legalLink}>{t('Account and data deletion')}</Link></View><ErrorText message={error}/>
  </View></Page>;
}
const styles=StyleSheet.create({
  workspace:{width:'100%',maxWidth:680,alignSelf:'center',gap:16},
  introduction:{gap:8},title:{fontSize:25,lineHeight:31,fontWeight:'700',color:palette.ink},body:{fontSize:14,lineHeight:21,color:palette.muted},
  choices:{flexDirection:'row',gap:6},choice:{flex:1,minHeight:84,paddingHorizontal:5,paddingVertical:10,gap:7,alignItems:'center',justifyContent:'center',backgroundColor:'#fff',borderWidth:1,borderColor:palette.border,borderRadius:10},active:{backgroundColor:palette.blueSoft,borderColor:palette.blue},choiceLabel:{fontSize:12,lineHeight:17,fontWeight:'600',color:palette.muted,textAlign:'center'},activeLabel:{color:palette.blue},
  panel:{padding:18,borderWidth:1,borderColor:palette.border,borderRadius:14,backgroundColor:'#fff',gap:17},heading:{fontSize:19,lineHeight:25,fontWeight:'700',color:palette.ink},fact:{flexDirection:'row',alignItems:'flex-start',gap:10},factText:{flex:1,gap:4},factTitle:{fontSize:14,lineHeight:20,fontWeight:'700',color:palette.ink},action:{marginTop:3,minHeight:48,borderRadius:10,paddingHorizontal:14,paddingVertical:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10,backgroundColor:palette.blue},actionLabel:{color:'#fff',fontSize:15,lineHeight:21,fontWeight:'700',flexShrink:1},
  legal:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',columnGap:18,rowGap:0},legalLink:{color:palette.muted,fontSize:12,lineHeight:18,paddingVertical:13},
});
