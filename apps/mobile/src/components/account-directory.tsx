import {useEffect,useRef,useState} from 'react';
import {StyleSheet,Text,View} from 'react-native';
import type {AccountConnection,AccountDirectoryPage,DirectoryAccount} from '../../../../src/lib/account-directory';
import {useAccount} from '../session/provider';
import {useLanguage} from '../localization/provider';
import {ActionLink} from './action-link';
import {AppIcon} from './app-icon';
import {ConfirmationButton} from './confirmation-button';
import {Button,Card,Copy,ErrorText,Field,LoadingSpinner,palette} from './ui';

type ViewKind='FIND'|'CONNECTIONS';
const kindLabels:Record<DirectoryAccount['kind'],string>={ORGANIZATION:'Transport Provider',PROVIDER_PROFILE:'Transport Provider',BUSINESS:'Shipper / broker',DRIVER:'Fleet driver'};
const statusLabels:Record<NonNullable<DirectoryAccount['statusBadge']>,string>={TRANSPORT_PROVIDER:'Transport Provider',FLEET_PROVIDER:'Fleet provider',OWNER_OPERATED:'Owner-operated',LICENSED_OPERATOR:'Licence holder',SELF_MANAGED:'Self-managed',ACCOUNT_MANAGED:'Account-managed',FLEET_DRIVER:'Fleet driver'};
function errorMessage(problem:unknown){return problem instanceof Error?problem.message:'Could not load connections. Try again.';}
export function AccountDirectoryNative({view,onShareVehicles}:{view:ViewKind;onShareVehicles?:()=>void}){
 const account=useAccount(),{t}=useLanguage(),request=account.request;
 const [query,setQuery]=useState(''),[page,setPage]=useState(1),[result,setResult]=useState<AccountDirectoryPage|null>(null),
  [connections,setConnections]=useState<AccountConnection[]>([]),[error,setError]=useState(''),[notice,setNotice]=useState(''),
  [busy,setBusy]=useState(false),[saving,setSaving]=useState(false),[version,setVersion]=useState(0),[historyOpen,setHistoryOpen]=useState(false);
 const actionLock=useRef(false);
 useEffect(()=>{
  let current=true;
  const timer=setTimeout(()=>{setBusy(true);setError('');void(async()=>{
   try{
    if(view==='FIND'){
     const value=await request(`/api/account-directory?${new URLSearchParams({q:query.trim(),page:String(page)})}`) as AccountDirectoryPage;
     if(current)setResult(value);
    }else{
     const value=await request('/api/account-connections') as {items:AccountConnection[]};
     if(current)setConnections(value.items);
    }
   }catch(problem){if(current)setError(errorMessage(problem));}
   finally{if(current)setBusy(false);}
  })();},view==='FIND'?300:0);
  return()=>{current=false;clearTimeout(timer);};
 },[view,query,page,version,request]);
 async function save(body:Record<string,string>){
  if(actionLock.current)return;actionLock.current=true;setSaving(true);setError('');setNotice('');
  try{await request('/api/account-connections',body);
   setNotice(t(body.action==='DECIDE'?body.decision==='ACCEPT'?'Connection accepted. Vehicle access is shared separately.':body.decision==='REVOKE'?'Connection removed. Its Network vehicle shares are no longer visible.':'Request updated.':'Request sent. Vehicle access begins only after it is shared.'));
   setVersion(value=>value+1);
  }catch(problem){setError(errorMessage(problem));}
  finally{actionLock.current=false;setSaving(false);}
 }
 function updateQuery(value:string){setQuery(value);setPage(1);setResult(null);}
 const active=connections.filter(item=>['PENDING','ACCEPTED'].includes(item.status));
 const history=connections.filter(item=>!['PENDING','ACCEPTED'].includes(item.status));
 return <View style={styles.body}>
  {!!notice&&<Copy>{notice}</Copy>}<ErrorText message={error}/>{!!error&&<Button secondary message="Retry" onPress={()=>setVersion(value=>value+1)}/>}
  {view==='FIND'?<>
   <Field message="Find transport accounts" value={query} onChangeText={updateQuery} placeholder={t('Account name, first name or @handle')} autoCapitalize="none" autoCorrect={false} maxLength={120}/>
   {!!query&&<Button secondary message="Clear search" onPress={()=>updateQuery('')}/>}
   {busy&&<LoadingSpinner/>}{!busy&&result&&!result.items.length&&<Copy message="No accounts match this search."/>}
   {result?.items.map(item=><Card key={`${item.kind}:${item.id}`}><View style={styles.head}><AppIcon name={item.kind==='BUSINESS'?'users':item.kind==='DRIVER'?'user':'truck'} size={23} color={palette.blue}/><View style={styles.identity}><Text style={styles.kind}>{t(kindLabels[item.kind])}</Text><Text style={styles.name}>{item.name}</Text>{!!item.handle&&<Text style={styles.handle}>@{item.handle}</Text>}</View></View>{item.statusBadge&&item.statusBadge!=='TRANSPORT_PROVIDER'&&item.statusBadge!=='FLEET_DRIVER'?<View style={styles.badge}><Text style={styles.badgeText}>{t(statusLabels[item.statusBadge])}</Text></View>:null}{!!item.managerName&&<Copy>{t('Account manager')} · {item.managerName}</Copy>}{!!item.city&&<Copy>{item.city}</Copy>}{item.networkSize!==null&&<Copy>{t('Vehicles in network')} · {item.networkSize}</Copy>}{item.connectionStatus?<Copy message={item.connectionStatus==='ACCEPTED'?'Connected':'Request pending'}/>:<Button message="Request connection" disabled={saving} onPress={()=>{void save({kind:item.kind,targetId:item.id});}}/>}</Card>)}
   {!!result&&result.pageCount>1&&<View style={styles.pager}><Button secondary message="Previous" disabled={busy||page===1} onPress={()=>setPage(page-1)}/><Text>{result.page} / {result.pageCount}</Text><Button secondary message="Next" disabled={busy||page>=result.pageCount} onPress={()=>setPage(page+1)}/></View>}
  </>:<>
   <Copy message="A connection does not share vehicles. The provider chooses which vehicles each account can see."/>
   {busy&&<LoadingSpinner/>}{!busy&&!active.length&&<Copy message="No connections yet. Find an account to send a request."/>}
   {active.map(item=><Card key={item.id}><View style={styles.head}><AppIcon name={item.account.kind==='BUSINESS'?'users':'truck'} size={23} color={palette.blue}/><View style={styles.identity}><Text style={styles.kind}>{t(item.status==='ACCEPTED'?'Connected':item.direction==='INCOMING'?'Incoming request':'Request sent')}</Text><Text style={styles.name}>{item.account.name}</Text>{!!item.account.handle&&<Text style={styles.handle}>@{item.account.handle}</Text>}</View></View>
    {item.canManage&&item.status==='PENDING'&&item.direction==='INCOMING'&&<><Button message="Accept" disabled={saving} onPress={()=>{void save({action:'DECIDE',id:item.id,decision:'ACCEPT'});}}/><Button secondary message="Decline" disabled={saving} onPress={()=>{void save({action:'DECIDE',id:item.id,decision:'DECLINE'});}}/></>}
    {item.canManage&&item.status==='PENDING'&&item.direction==='OUTGOING'&&<Button secondary message="Cancel request" disabled={saving} onPress={()=>{void save({action:'DECIDE',id:item.id,decision:'CANCEL'});}}/>}
    {item.status==='ACCEPTED'&&account.session?.user.role==='CUSTOMER'&&<ActionLink href="/?view=private" message="Shared with you" icon="map"/>}
    {item.status==='ACCEPTED'&&onShareVehicles&&<Button secondary message="Share vehicles" onPress={onShareVehicles}/>}
    {item.status==='ACCEPTED'&&item.canManage&&<ConfirmationButton message="Disconnect" disabled={saving} title="Disconnect?" detail="Vehicle access shared through this connection will stop." cancel="Keep connection" confirm="Disconnect" onConfirm={()=>{void save({action:'DECIDE',id:item.id,decision:'REVOKE'});}}/>}
   </Card>)}
   {!!history.length&&<><Button secondary message={historyOpen?'Hide past requests':'Past requests'} onPress={()=>setHistoryOpen(!historyOpen)}/>{historyOpen&&history.map(item=><Card key={item.id}><View style={styles.head}><AppIcon name={item.account.kind==='BUSINESS'?'users':'truck'} size={23} color={palette.blue}/><View style={styles.identity}><Text style={styles.kind}>{t(item.status==='REVOKED'?'Disconnected':item.status==='DECLINED'?'Declined':'Cancelled')}</Text><Text style={styles.name}>{item.account.name}</Text>{!!item.account.handle&&<Text style={styles.handle}>@{item.account.handle}</Text>}</View></View></Card>)}</>}
  </>}
 </View>;
}
const styles=StyleSheet.create({body:{gap:14},head:{flexDirection:'row',gap:12,alignItems:'flex-start'},identity:{flex:1,minWidth:0,gap:3},kind:{fontSize:12,fontWeight:'700',color:palette.blue},name:{fontSize:18,fontWeight:'700',color:palette.ink},handle:{fontSize:13,color:palette.muted},badge:{alignSelf:'flex-start',paddingHorizontal:9,paddingVertical:5,borderRadius:99,borderWidth:1,borderColor:'#b8ccf6',backgroundColor:palette.blueSoft},badgeText:{fontSize:12,fontWeight:'700',color:'#17468f'},pager:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8}});
