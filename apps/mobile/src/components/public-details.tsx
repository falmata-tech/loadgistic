import {useLanguage} from '../localization/provider';
import { useState } from 'react';
import { Image,Pressable,Text,View } from 'react-native';
import * as Linking from 'expo-linking';
import { apiOrigin } from '../api/http';
import { externalDestination,type PublicBadge } from '../api/public-content';
import { Button,Copy,ErrorText,palette } from './ui';
import {AppIcon,type IconName} from './app-icon';
export function ExternalButton({label,url,failureMessage='This phone could not open that contact. Please try another contact method.'}:{label:string;url:string;failureMessage?:string}){
 const [error,setError]=useState('');const destination=externalDestination(url);
 if(!destination)return null;
 return <><Button secondary label={label} onPress={()=>{setError('');void Linking.openURL(destination).catch(()=>setError(failureMessage));}}/><ErrorText message={error}/></>;
}
export function PublicImage({path,label,portrait=false,identity}:{path:string;label:string;portrait?:boolean;identity?:'company'|'person'}){
 const [failed,setFailed]=useState('');
 if(!path||path===failed)return portrait||identity?<View accessible accessibilityRole="image" accessibilityLabel={label} style={{width:88,height:88,borderRadius:identity==='company'?12:44,backgroundColor:'#eaf1ff',alignItems:'center',justifyContent:'center'}}><AppIcon name={identity==='company'?'profile':'user'} size={42} color={palette.blue}/></View>:null;
 return <Image accessibilityLabel={label} source={{uri:apiOrigin+path}} onError={()=>setFailed(path)} resizeMode={portrait?'cover':'contain'} style={portrait?{width:88,height:88,borderRadius:44}:{width:160,height:110}}/>;
}
const labels:Record<string,string>={IDENTITY:'National ID',BUSINESS_LICENSE:'Business license',BUSINESS_ADDRESS:'Business address',DRIVER_IDENTITY:'Driver license',VEHICLE_OWNERSHIP:'Vehicle ownership',VEHICLE_OPERATING_LICENSE:'Vehicle operating licence',VEHICLE_AUTHORIZATION:'Permission to use vehicle',VEHICLE_AUTHORITY:'Ownership or permission to use',TRUCK_AUTHORIZATION:'Permission to use vehicle'};
const badgeIcons:Record<string,IconName>={IDENTITY:'user',BUSINESS_LICENSE:'profile',BUSINESS_ADDRESS:'pin',DRIVER_IDENTITY:'documents',VEHICLE_OWNERSHIP:'key',VEHICLE_OPERATING_LICENSE:'documents',VEHICLE_AUTHORIZATION:'shield',VEHICLE_AUTHORITY:'shield',TRUCK_AUTHORIZATION:'shield'};
const vehicleRowLabels:Record<string,string>={VEHICLE_OWNERSHIP:'Ownership',VEHICLE_AUTHORIZATION:'Permission',VEHICLE_OPERATING_LICENSE:'Operating licence'};
export function PublicBadges({items,rows=false}:{items:PublicBadge[];rows?:boolean}){
 const {t}=useLanguage();
 const [expanded,setExpanded]=useState<number|null>(null);
 return <View style={{gap:rows?0:8}}>{items.map((item,index)=>{
  const label=t(rows?vehicleRowLabels[item.type]||labels[item.type]||item.type:labels[item.type]||item.type);
  const state=t(item.reviewed?(rows?'Verified':'Loadgistic reviewed'):item.expired?'Expired':'Not verified');
  const color=item.reviewed?'#174c92':'#344054';
  return <View key={`${item.type}-${index}`} style={rows?{borderBottomWidth:1,borderBottomColor:'#e5eaf1'}:undefined}>
   <Pressable accessibilityRole="button" accessibilityLabel={`${label} · ${state}`} accessibilityState={{expanded:expanded===index}} onPress={()=>setExpanded(expanded===index?null:index)} style={rows?{minHeight:48,paddingVertical:8,flexDirection:'row',alignItems:'center',gap:8}:{minHeight:48,padding:12,borderRadius:10,borderWidth:1,borderColor:item.reviewed?'#155eef':'#aab7c8',backgroundColor:item.reviewed?'#eaf1ff':'#fff',flexDirection:'row',alignItems:'center',gap:9}}>
    <AppIcon name={badgeIcons[item.type]||'shield'} size={18} color={color}/>
    <Text style={{flex:1,minWidth:0,color:palette.ink,fontWeight:'700',fontSize:13,lineHeight:18}}>{label}</Text>
    {rows?<View style={{minHeight:28,paddingHorizontal:7,paddingVertical:4,borderRadius:999,borderWidth:1,borderColor:item.reviewed?'#155eef':'#aab7c8',backgroundColor:item.reviewed?'#155eef':'#fff',flexDirection:'row',alignItems:'center',gap:3}}>{item.reviewed?<AppIcon name="check" size={12} color="#fff"/>:<Text style={{color:'#344054',fontSize:13,lineHeight:14}}>−</Text>}<Text style={{color:item.reviewed?'#fff':'#344054',fontSize:11,lineHeight:15,fontWeight:'700'}}>{state}</Text></View>:<View style={{flexDirection:'row',alignItems:'center',gap:4}}>{item.reviewed&&<AppIcon name="check" size={13} color={color}/>}<Text style={{color,fontSize:12}}>{state}</Text></View>}
   </Pressable>
   {expanded===index&&<Copy>{item.reviewedAt?t('Reviewed {date}.',{date:item.reviewedAt.slice(0,10)})+' ':''}{item.expiresOn?t('Expires {date}.',{date:item.expiresOn})+' ':''}{t('Confirm current originals and operating authority directly.')}</Copy>}
  </View>;
 })}</View>;
}
