import {useLanguage} from '../localization/provider';
import { useState } from 'react';
import { Image,Pressable,Text,View } from 'react-native';
import * as Linking from 'expo-linking';
import { apiOrigin } from '../api/http';
import { externalDestination,type PublicBadge } from '../api/public-content';
import { Button,Copy,ErrorText,palette } from './ui';
export function ExternalButton({label,url}:{label:string;url:string}){
 const [error,setError]=useState('');const destination=externalDestination(url);
 if(!destination)return null;
 return <><Button secondary label={label} onPress={()=>{setError('');void Linking.openURL(destination).catch(()=>setError('This phone could not open that contact. Please try another contact method.'));}}/><ErrorText message={error}/></>;
}
export function PublicImage({path,label,portrait=false}:{path:string;label:string;portrait?:boolean}){
 const [failed,setFailed]=useState('');
 if(!path||path===failed)return portrait?<View accessibilityLabel={label} style={{width:88,height:88,borderRadius:44,backgroundColor:'#eaf5f4',alignItems:'center',justifyContent:'center'}}><View style={{width:18,height:18,borderRadius:9,backgroundColor:palette.teal,marginBottom:3}}/><View style={{width:40,height:22,borderTopLeftRadius:20,borderTopRightRadius:20,backgroundColor:palette.teal}}/><View style={{position:"absolute",bottom:12,width:29,height:29,borderRadius:15,borderWidth:3,borderColor:"#fff",alignItems:"center",justifyContent:"center"}}><View style={{width:3,height:23,backgroundColor:"#fff"}}/><View style={{position:"absolute",width:23,height:3,backgroundColor:"#fff"}}/></View></View>:null;
 return <Image accessibilityLabel={label} source={{uri:apiOrigin+path}} onError={()=>setFailed(path)} resizeMode={portrait?'cover':'contain'} style={portrait?{width:88,height:88,borderRadius:44}:{width:160,height:110}}/>;
}
const labels:Record<string,string>={IDENTITY:'National ID',BUSINESS_LICENSE:'Business license',BUSINESS_ADDRESS:'Business address',DRIVER_IDENTITY:'Driver license',VEHICLE_OWNERSHIP:'Truck ownership',VEHICLE_AUTHORIZATION:'Permission to use truck',VEHICLE_AUTHORITY:'Ownership or permission to use',TRUCK_AUTHORIZATION:'Permission to use truck'};
export function PublicBadges({items}:{items:PublicBadge[]}){
 const {t}=useLanguage();
 const [expanded,setExpanded]=useState<number|null>(null);
 return <View style={{gap:8}}>{items.map((item,index)=><View key={`${item.type}-${index}`}><Pressable accessibilityRole="button" accessibilityState={{expanded:expanded===index}} onPress={()=>setExpanded(expanded===index?null:index)} style={{minHeight:48,padding:12,borderRadius:10,backgroundColor:item.reviewed?'#eaf5f4':'#f4f5f6'}}><Text style={{color:palette.ink,fontWeight:'600'}}>{t(labels[item.type]||item.type)}</Text><Copy>{t(item.reviewed?'Loadgistic reviewed':item.expired?'Review expired':'Not reviewed')}</Copy></Pressable>{expanded===index&&<Copy>{item.reviewedAt?t('Reviewed {date}.',{date:item.reviewedAt.slice(0,10)})+' ':''}{item.expiresOn?t('Expires {date}.',{date:item.expiresOn})+' ':''}{t('Confirm current originals and operating authority directly.')}</Copy>}</View>)}</View>;
}
