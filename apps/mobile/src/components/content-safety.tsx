import {useRef,useState,type PropsWithChildren} from 'react';
import {Modal,ScrollView,View} from 'react-native';
import {useLanguage} from '../localization/provider';
import {apiRequest} from '../api/http';
import * as Storage from '../session/storage';
import {useBlockedProviders} from '../hooks/content-blocks';
import {Button,Card,Copy,ErrorText,Field,Title} from './ui';
export function ContentSafety({handle,reviewId,children}:PropsWithChildren<{handle:string;reviewId?:string}>){
 const {t}=useLanguage();const prefs=useBlockedProviders(),blocked=prefs.blocked.includes(handle),[open,setOpen]=useState(false),[detail,setDetail]=useState(''),[category,setCategory]=useState(reviewId?'REVIEW':'PROFILE'),[busy,setBusy]=useState(false),[sent,setSent]=useState(false),[error,setError]=useState('');const lock=useRef(false);
 const report=async()=>{if(lock.current)return;lock.current=true;setBusy(true);setError('');try{
  const key='loadgistic.content-reporter.v1';let reporter=await Storage.getItemAsync(key);if(!reporter){const {randomUUID}=await import('expo-crypto');reporter=randomUUID();await Storage.setItemAsync(key,reporter,{keychainAccessible:Storage.WHEN_UNLOCKED_THIS_DEVICE_ONLY});}
  const result=await apiRequest('/api/mobile/public/content-report',{body:{handle,reporter,category,detail,...(reviewId?{reviewId}:{})}}) as {recorded:boolean};if(!result.recorded)throw Error('Your report could not be sent. Try again.');setSent(true);
 }catch(caught){setError(caught instanceof Error?caught.message:'Your report could not be sent. Try again.');}finally{lock.current=false;setBusy(false);}};
 return <>{blocked?<Card><Title message="Transporter blocked"/><Copy message="This profile and its trucks are hidden on this device. You can unblock it at any time."/></Card>:children}
 <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}><Button secondary label={t(reviewId?'Report review':'Report content')} onPress={()=>{setOpen(true);setSent(false);setError('');}}/>{!reviewId?<Button secondary label={t(blocked?'Unblock transporter':'Block transporter')} onPress={()=>{void prefs.set(handle,!blocked).catch(()=>setError('Your preference could not be saved. Try again.'));}}/>:null}</View><ErrorText message={error}/>
 <Modal visible={open} transparent animationType="fade" onRequestClose={()=>{if(!busy)setOpen(false);}}><View style={{flex:1,backgroundColor:'rgba(23,44,70,0.3)',justifyContent:'center',padding:20}}><ScrollView accessibilityViewIsModal style={{maxHeight:'90%',flexGrow:0,maxWidth:480,width:'100%',alignSelf:'center',backgroundColor:'#fff',borderRadius:18}} contentContainerStyle={{padding:20,gap:12}}><Title message="Report content"/>{sent?<Copy message="Report received. Our team will review the content."/>:<>{!reviewId?<View style={{flexDirection:'row',gap:6,flexWrap:'wrap'}}>{(['PROFILE','PICTURE','REVIEW','OTHER'] as const).map(value=><Button key={value} secondary={category!==value} label={t({PROFILE:'Profile',PICTURE:'Picture',REVIEW:'Review',OTHER:'Other'}[value])} disabled={busy} onPress={()=>setCategory(value)}/>)}</View>:null}<Field message="Tell us what needs attention" value={detail} onChangeText={setDetail} multiline maxLength={1000} editable={!busy}/><Copy message="Do not include passwords, tracking codes or private documents."/><Button message="Send report" busy={busy} disabled={detail.trim().length<5} onPress={()=>void report()}/></>}<ErrorText message={error}/><Button secondary message="Close" disabled={busy} onPress={()=>setOpen(false)}/></ScrollView></View></Modal>
 </>;
}
