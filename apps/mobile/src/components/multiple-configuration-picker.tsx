import {useState} from 'react';
import {Image,Modal,Pressable,ScrollView,Text,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {capacityFilterValues,capacityFilterValue} from '../api/discovery';
import {apiOrigin} from '../api/http';
import {useLanguage} from '../localization/provider';
import {AppIcon} from './app-icon';
import {Page,Title,Button,palette} from './ui';
import type {Configuration} from './configuration-picker';

/** Filter-only picker; editing a truck still uses the single configuration picker. */
export function MultipleConfigurationPicker({value,options,onChange}:{value:string;options:Configuration[];onChange:(value:string)=>void}){
 const {t}=useLanguage(),[open,setOpen]=useState(false),selected=capacityFilterValues('vehicleCategory',value);
 const title=t('Vehicle type');
 const summary=selected.length===1?t(selected[0]):selected.length?t('{count} configurations selected').replace('{count}',String(selected.length)):t('Any configuration');
 const toggle=(name:string)=>onChange(capacityFilterValue('vehicleCategory',selected.includes(name)?selected.filter(item=>item!==name):[...selected,name]));
 return <View style={{gap:8}}><Text style={{color:palette.ink,fontWeight:'700'}}>{title}</Text>
 {selected.length>0&&<ScrollView horizontal contentContainerStyle={{gap:8}}>{options.filter(item=>selected.includes(item.name)).map(item=><Image key={item.name} source={{uri:apiOrigin+item.image}} accessibilityLabel={t(item.name)} style={{width:78,height:58}} resizeMode="contain"/>)}</ScrollView>}
 <Button secondary label={summary} onPress={()=>setOpen(true)}/>
 <Modal visible={open} animationType="slide" onRequestClose={()=>setOpen(false)}><SafeAreaView style={{flex:1,backgroundColor:'#fff'}}><Page>
 <Title>{title}</Title><Button secondary message="Close" onPress={()=>setOpen(false)}/><Button secondary message="Any configuration" onPress={()=>onChange('')}/>
 {options.map(item=>{const checked=selected.includes(item.name);return <Pressable key={item.name} accessibilityRole="checkbox" accessibilityLabel={t(item.name)} accessibilityState={{checked}} aria-checked={checked} onPress={()=>toggle(item.name)} style={{flexDirection:'row',alignItems:'center',gap:12,padding:12,minHeight:70,borderWidth:1,borderColor:checked?palette.teal:palette.border,backgroundColor:checked?'#eaf5f4':'#fff',borderRadius:12}}><Image source={{uri:apiOrigin+item.image}} style={{width:90,height:70}} resizeMode="contain"/><Text style={{flex:1,color:palette.ink}}>{t(item.name)}</Text><View style={{width:24,height:24,borderWidth:1,borderColor:checked?palette.teal:palette.border,borderRadius:5,alignItems:'center',justifyContent:'center'}}>{checked&&<AppIcon name="check" size={18} color={palette.teal}/>}</View></Pressable>;})}
 </Page></SafeAreaView></Modal></View>;
}
