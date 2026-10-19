import {useEffect,useState} from 'react';
import {Modal,Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {useAccount} from '../session/provider';
import {useLanguage} from '../localization/provider';
import {Button,Copy,ErrorText,Field,palette} from './ui';
import {AppIcon} from './app-icon';
import {ConfirmationButton} from './confirmation-button';

type Business={id:string;name:string;handle:string;city:string|null};
export type BusinessCapacityGrant={id:string;name:string;handle:string;revision:number;city:string|null};
export function BusinessCapacitySharing({vehicleId,exclusive,grants,reload}:{vehicleId:string;exclusive:boolean;grants:BusinessCapacityGrant[];reload:()=>Promise<boolean>}){
 const {t}=useLanguage(),account=useAccount();
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[items,setItems]=useState<Business[]>([]),[selected,setSelected]=useState<Business|null>(null),[searching,setSearching]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false);
 const actor=account.session?.user.id,request=account.request;
 useEffect(()=>{
  if(!open||query.trim().length<2)return;
  let current=true;
  const timer=setTimeout(()=>{setSearching(true);void request('/api/business-workspaces/search?q='+encodeURIComponent(query.trim())).then(data=>{
   if(!Array.isArray(data)||!data.every(item=>item&&typeof item==='object'&&typeof item.id==='string'&&typeof item.name==='string'&&typeof item.handle==='string'))throw Error('Search is temporarily unavailable.');
   if(current)setItems(data as Business[]);
  }).catch(error=>{if(current)setError(error instanceof Error?error.message:'Search is temporarily unavailable.');}).finally(()=>{if(current)setSearching(false);});},300);
  return()=>{current=false;clearTimeout(timer);};
 },[open,query,actor,request]);
 async function reread(){if(await reload()){setSaved(false);setOpen(false);setQuery('');setSelected(null);}else setError('Your change was saved. Reload to see the latest details.');}
 async function save(command:unknown){
  if(busy||saved)return;setBusy(true);setError('');
  try{await request('/api/business-capacity-shares',command);setSaved(true);await reread();}
  catch(error){setError(error instanceof Error?error.message:'Could not save changes.');}finally{setBusy(false);}
 }
 return <View style={styles.section}>
  {grants.length>0?<><Text style={styles.heading}>{t('Shared businesses')}</Text>{grants.map(grant=><View key={grant.id} style={styles.business}><AppIcon name="profile" color={palette.teal}/><View style={{flex:1,gap:3}}><Text style={styles.name}>{grant.name}</Text><Text style={styles.meta}>@{grant.handle}{grant.city?` · ${grant.city}`:''}</Text><Text style={styles.meta}>{t('Their permitted team members can view these signals.')}</Text></View><ConfirmationButton message="Remove" busy={busy} disabled={saved} title="Remove capacity access?" detail="Their permitted team members will no longer see this vehicle." cancel="Keep access" confirm="Remove access" onConfirm={()=>void save({action:'REVOKE',grantId:grant.id,revision:grant.revision})}/></View>)}</>:null}
  {!exclusive?<Button secondary message="Business account" disabled={busy||saved} onPress={()=>{setOpen(true);setQuery('');setItems([]);setSelected(null);setSearching(false);setError('');}}/>:null}
  {!open?<ErrorText message={error}/>:null}{saved&&!open?<Button secondary message="Reload saved change" onPress={()=>void reread()}/>:null}
  <Modal visible={open} transparent animationType="fade" onRequestClose={()=>{if(!busy&&!saved)setOpen(false);}}><View style={styles.backdrop}><View style={styles.sheet}><View style={styles.header}><Text style={styles.heading}>{t('Business account')}</Text><Pressable accessibilityRole="button" accessibilityLabel={t('Close')} disabled={busy||saved} style={styles.close} onPress={()=>setOpen(false)}><AppIcon name="close"/></Pressable></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{gap:12}}>
   <Field message="Search businesses" value={query} maxLength={80} editable={!busy&&!saved} autoCapitalize="none" onChangeText={value=>{setQuery(value);setSelected(null);setItems([]);setSearching(false);setError('');}}/>
   {query?<Button secondary message="Clear search" disabled={busy||saved} onPress={()=>{setQuery('');setSelected(null);setItems([]);setSearching(false);}}/>:null}
   {selected?<View style={styles.selected}><Text style={styles.name}>{selected.name}</Text><Text style={styles.meta}>@{selected.handle}{selected.city?` · ${selected.city}`:''}</Text></View>:searching?<Copy message="Searching…"/>:items.map(item=><Pressable key={item.id} accessibilityRole="button" disabled={busy||saved} style={styles.result} onPress={()=>setSelected(item)}><Text style={styles.name}>{item.name}</Text><Text style={styles.meta}>@{item.handle}{item.city?` · ${item.city}`:''}</Text></Pressable>)}
   {!selected&&!searching&&query.trim().length>=2&&!items.length?<Copy message="No matching businesses."/>:null}
   <Copy message="Their permitted team members can view these signals."/><ErrorText message={error}/>
   {saved?<Button secondary message="Reload saved change" busy={busy} onPress={()=>void reread()}/>:<Button message="Add access" busy={busy} disabled={!selected} onPress={()=>void save({action:'GRANT',vehicleId,workspaceId:selected?.id})}/>}
  </ScrollView></View></View></Modal>
 </View>;
}
const styles=StyleSheet.create({section:{gap:12,borderTopWidth:1,borderColor:'#dce7e7',paddingTop:14,marginTop:8},heading:{fontSize:18,fontWeight:'700',color:palette.ink},business:{flexDirection:'row',gap:10,alignItems:'flex-start'},name:{fontSize:16,fontWeight:'700',color:palette.ink},meta:{fontSize:13,lineHeight:19,color:palette.muted},backdrop:{flex:1,backgroundColor:'rgba(10,29,40,.24)',justifyContent:'center',padding:18},sheet:{backgroundColor:'white',borderRadius:18,padding:18,maxHeight:'85%',gap:16},header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},close:{padding:10},result:{borderWidth:1,borderColor:palette.border,borderRadius:10,padding:14,gap:4},selected:{borderWidth:1,borderColor:'#91c8c3',backgroundColor:'#ebf6f4',padding:14,borderRadius:10,gap:4}});
