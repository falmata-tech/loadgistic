import {useEffect,useRef,useState} from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {useAccount} from '../session/provider';
import {useLanguage} from '../localization/provider';
import { Button, Copy, ErrorText, Field, palette, LoadingSpinner } from './ui';
import {AppIcon} from './app-icon';
import type {BusinessDirectoryPage,BusinessDocumentBadge} from '../../../../src/lib/business-directory/contracts';
import {businessDocumentLabel,businessDocumentState,parseBusinessDirectoryPage} from '../../../../src/lib/business-directory/client-contract.js';

export function BusinessDocumentBadges({documents}:{documents:BusinessDocumentBadge[]}){
 const {t}=useLanguage();
 return <View style={styles.badges}>{documents.map(badge=><View key={badge.type} style={styles.badge}><Text style={styles.label}>{t(businessDocumentLabel(badge.type))}</Text><Text style={[styles.state,badge.verified&&styles.reviewed]}>{t(businessDocumentState(badge))}</Text></View>)}</View>;
}
export function BusinessDirectory(){
 const account=useAccount(),{t}=useLanguage(),[query,setQuery]=useState(''),[page,setPage]=useState(1),[data,setData]=useState<BusinessDirectoryPage|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(true),[retry,setRetry]=useState(0);
 const generation=useRef(0),lock=useRef(false),pending=useRef<{q:string;page:number;generation:number}|null>(null),request=account.request;
 useEffect(()=>{
  const version=++generation.current;
  const timer=setTimeout(()=>{pending.current={q:query.trim(),page,generation:version};void drain();},300);
  async function drain(){
   if(lock.current)return;lock.current=true;
   try{while(pending.current){const work=pending.current;pending.current=null;
    try{const value=await request(`/api/business-directory?${new URLSearchParams({q:work.q,page:String(work.page)})}`),parsed=parseBusinessDirectoryPage(value);if(parsed.page!==work.page&&!(work.page>1&&parsed.page===1))throw Error('Could not load workspace details. Please try again.');if(generation.current===work.generation){setData(parsed);setError('');}}
    catch(problem){if(generation.current===work.generation)setError(problem instanceof Error?problem.message:'Could not load workspace details. Please try again.');}
    finally{if(generation.current===work.generation)setBusy(false);}
   }}finally{lock.current=false;}
  }
  return()=>{clearTimeout(timer);generation.current=version+1;pending.current=null;};
 },[query,page,retry,request]);
 function resetSearch(value:string){setQuery(value);setPage(1);setData(null);setError('');setBusy(true);}
 return <View style={{gap:18}}><Field message="Account name, manager or @handle" value={query} maxLength={120} autoCapitalize="none" autoCorrect={false} onChangeText={resetSearch}/>{!!query&&<Button secondary message="Clear search" onPress={()=>resetSearch('')}/>}
  {busy&&<LoadingSpinner/>}<ErrorText message={error}/>{!!error&&<Button secondary message="Retry" onPress={()=>{setError('');setBusy(true);setRetry(retry+1);}}/>}
  {data?.items.map(business=>{const reviewed=business.documents.filter(document=>document.verified);return <View key={business.id} style={styles.business}><View style={styles.header}><AppIcon name="network" size={26} color={palette.blue}/><View style={{flex:1,minWidth:0,gap:4}}><Text style={styles.name}>{business.name}</Text><Text style={styles.handle}>@{business.handle}</Text></View></View>{!!business.managerName&&<Copy>{t('Account manager')} · {business.managerName}</Copy>}{!!business.city&&<Copy>{business.city}</Copy>}{!!reviewed.length&&<View style={styles.reviewedSection}><Text style={styles.reviewedHeading}>{t('Reviewed documents')}</Text><BusinessDocumentBadges documents={reviewed}/></View>}</View>;})}
  {data&&!data.items.length&&<Copy message="No shippers or brokers match this search."/>}
  {!!data&&data.pageCount>1&&<View style={styles.pager}><Button secondary message="Previous" disabled={data.page===1||busy} onPress={()=>{setData(null);setError('');setBusy(true);setPage(data.page-1);}}/><Text>{data.page} / {data.pageCount}</Text><Button secondary message="Next" disabled={data.page>=data.pageCount||busy} onPress={()=>{setData(null);setError('');setBusy(true);setPage(data.page+1);}}/></View>}
 </View>;
}
const styles=StyleSheet.create({business:{borderWidth:1,borderColor:palette.border,borderRadius:14,padding:18,gap:8,backgroundColor:'#fff'},header:{flexDirection:'row',gap:12,alignItems:'flex-start',marginBottom:5},name:{fontSize:18,fontWeight:'700',color:palette.ink},handle:{fontSize:13,color:palette.muted},badges:{gap:13,marginTop:15},badge:{flexDirection:'row',gap:12,alignItems:'flex-start'},label:{flex:1,fontSize:13,lineHeight:18,color:palette.muted},state:{maxWidth:'45%',fontSize:12,lineHeight:18,fontWeight:'600',textAlign:'right',color:palette.muted},reviewed:{color:palette.blue},reviewedSection:{gap:5},reviewedHeading:{fontSize:12,fontWeight:'700',color:palette.muted},pager:{flexDirection:'row',gap:10,alignItems:'center',justifyContent:'space-between'}});
