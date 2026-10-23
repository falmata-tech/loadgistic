import {useRef,useState} from 'react';
import {Pressable,StyleSheet,Text,View} from 'react-native';
import {useLanguage} from '../localization/provider';
import {useAccount} from '../session/provider';
import {AppIcon,type IconName} from './app-icon';
import {Button,Copy,ErrorText,palette} from './ui';

type Fact={verified:boolean;reviewedAt:string|null;expiresOn:string|null};
export type TruckAuthority={ownership:Fact;permission:Fact;operatingLicence:Fact&{holderBasis?:'OWNED'|'FINANCED'|null};qualifiesProvider:boolean};
export type ProviderPublication={canPublish:boolean;liveTruckCount:number;qualifyingTruckCount:number;qualifyingOwnershipCount:number;qualifyingLicenceCount:number};
export type ProviderAuthoritySummary={total:number;ownershipVerified:number;operatingLicenceVerified:number;permissionVerified:number;notYetVerified:number;financedVerified:number};
export function ProviderTruckSummary({summary}:{summary?:ProviderAuthoritySummary|null}){
 const {t}=useLanguage();
 if(!summary)return null;
 const rows=[{count:summary.ownershipVerified,message:'{count} ownership verified',color:'#174c92',background:'#edf4ff'},{count:summary.operatingLicenceVerified,message:'{count} operating licence reviewed',color:'#375572',background:'#f0f5f9'},{count:summary.permissionVerified,message:'{count} permission verified',color:palette.success,background:palette.successSoft},{count:summary.notYetVerified,message:'{count} not yet verified',color:palette.muted,background:palette.canvas}];
 return <View style={{gap:10}}><Text style={styles.title}>{t(summary.total===1?'{count} vehicle':'{count} vehicles',{count:summary.total})}</Text><View style={styles.badges}>{rows.filter(row=>row.count>0).map(row=><View key={row.message} style={[styles.badge,{backgroundColor:row.background,borderColor:row.color}]}><Text style={[styles.label,{color:row.color}]}>{t(row.message,{count:row.count})}</Text></View>)}</View></View>;
}
export function TruckAuthorityBadges({authority}:{authority?:TruckAuthority|null}){
 const {t}=useLanguage(),[expanded,setExpanded]=useState('');
 const facts:{key:string;label:string;icon:IconName;color:string;background:string;fact?:Fact}[]=[
  {key:'ownership',label:'Ownership verified',icon:'key',color:'#174c92',background:'#edf4ff',fact:authority?.ownership},
  {key:'permission',label:'Permission verified',icon:'shield',color:palette.success,background:palette.successSoft,fact:authority?.permission},
  {key:'licence',label:authority?.operatingLicence?.holderBasis==='FINANCED'?'Financed · licence reviewed':'Operating licence reviewed',icon:'documents',color:'#375572',background:'#f0f5f9',fact:authority?.operatingLicence}
 ];
 const reviewed=facts.filter(item=>item.fact?.verified===true);
 return <View style={styles.badges}>{reviewed.length?reviewed.map(item=><View key={item.key} style={{maxWidth:'100%'}}><Pressable accessibilityRole="button" accessibilityLabel={t(item.label)} accessibilityState={{expanded:expanded===item.key}} onPress={()=>setExpanded(expanded===item.key?'':item.key)} style={[styles.badge,{backgroundColor:item.background,borderColor:item.color}]}><AppIcon name={item.icon} size={16} color={item.color}/><Text style={[styles.label,{color:item.color}]}>{t(item.label)}</Text></Pressable>{expanded===item.key&&<View style={styles.details}>{!!item.fact?.reviewedAt&&<Copy>{t('Reviewed ')+item.fact.reviewedAt.slice(0,10)}</Copy>}{!!item.fact?.expiresOn&&<Copy>{t('Expires ')+item.fact.expiresOn}</Copy>}<Copy message="Reviewed for this provider and vehicle."/></View>}</View>):<View style={[styles.badge,{backgroundColor:palette.canvas,borderColor:palette.borderSoft}]}><AppIcon name="shield" size={16} color={palette.muted}/><Text style={[styles.label,{color:palette.muted}]}>{t('Not yet verified. Confirm details directly.')}</Text></View>}</View>;
}
export function ProviderPublicationNotice({publication}:{publication:ProviderPublication}){
 const {t}=useLanguage();
 if(publication.canPublish)return null;
 return <View style={styles.notice}><AppIcon name="shield" size={20}/><View style={{flex:1,gap:5}}><Text style={styles.title}>{t('Publish more vehicles')}</Text><Copy message="One vehicle can go live without reviewed documents. To publish more, verify ownership or an operating licence in your name for a vehicle you own or are financing."/></View></View>;
}
export function TruckPublicationControl({vehicleId,state,publication,onSaved}:{vehicleId:string;state:string;publication:ProviderPublication;onSaved:()=>Promise<void>}){
 const {t}=useLanguage(),account=useAccount(),lock=useRef(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const live=state==='LIVE',paused=publication.qualifyingTruckCount===0&&publication.liveTruckCount>1;
 async function save(){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await account.request('/api/mobile/fleet/publication',{vehicleId,state:live?'DRAFT':'LIVE'});await onSaved();}catch(error){setError(error instanceof Error?error.message:'Could not confirm this change. Refresh before retrying.');}finally{lock.current=false;setBusy(false);}}
 return <View style={styles.publication}><Text style={styles.title}>{t(live?'Live':'Draft')}</Text><Copy message={live?(paused?'Visibility is paused. Keep one vehicle live or complete verification.':'Capacity follows the sharing settings you choose.'):'This vehicle is saved privately. Take it live when you are ready.'}/><ErrorText message={error}/><Button secondary={live} message={live?'Move to draft':'Go live'} busy={busy} disabled={!live&&!publication.canPublish} onPress={()=>{void save();}}/></View>;
}
const styles=StyleSheet.create({badges:{flexDirection:'row',flexWrap:'wrap',gap:8},badge:{maxWidth:'100%',minHeight:42,borderWidth:1,borderRadius:9,paddingHorizontal:10,paddingVertical:8,flexDirection:'row',alignItems:'center',gap:7},label:{fontSize:12,lineHeight:18,fontWeight:'600',flexShrink:1},details:{gap:5,paddingVertical:9,maxWidth:300},notice:{flexDirection:'row',gap:10,padding:14,borderWidth:1,borderColor:palette.border,borderRadius:12,backgroundColor:palette.canvas},title:{fontSize:15,fontWeight:'700',color:palette.ink},publication:{gap:8,paddingTop:10,borderTopWidth:1,borderTopColor:palette.border}});
