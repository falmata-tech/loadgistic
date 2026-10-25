import {useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import type {AccountConnection} from '../../../../src/lib/account-directory';
import {useAccount} from '../session/provider';
import {useLanguage} from '../localization/provider';
import {ConfirmationButton} from './confirmation-button';
import {Button,Copy,ErrorText,palette} from './ui';

export type AccountVehicleGrant={id:string;name:string;connectionId:string;revision:number};
export function AccountVehicleSharing({vehicleId,exclusive,connections,grants,reload}:{vehicleId:string;exclusive:boolean;connections:AccountConnection[];grants:AccountVehicleGrant[];reload:()=>Promise<boolean>}){
 const account=useAccount(),{t}=useLanguage(),[open,setOpen]=useState(false),[selected,setSelected]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const available=connections.filter(item=>item.status==='ACCEPTED'&&item.account.kind==='BUSINESS'&&item.account.id&&!grants.some(grant=>grant.connectionId===item.id));
 async function save(body:Record<string,string|number>){
  if(busy)return;setBusy(true);setError('');setNotice('');
  try{await account.request('/api/account-vehicle-shares',body);const confirmed=await reload();
   setNotice(t(confirmed?'Sharing updated.':'Your change was saved. Reload to see the latest details.'));
   if(confirmed){setOpen(false);setSelected('');}
  }catch(problem){setError(problem instanceof Error?problem.message:t('Could not save changes.'));}
  finally{setBusy(false);}
 }
 return <View style={{gap:9,marginTop:12}}>
  <Button secondary message={open?'Close connection sharing':'Share with connection'} onPress={()=>setOpen(!open)} disabled={busy}/>
  {!open&&grants.map(grant=><Copy key={grant.id}>{grant.name}</Copy>)}
  {open&&<View style={{gap:9}}>
   {!exclusive&&available.length>0&&<Copy message="Choose a connected shipper or broker. Only this vehicle will be shared."/>}
   {exclusive?<Copy message="This vehicle uses an older sharing setting. In Capacity, choose Private network before sharing with an account."/>:available.length?<>
    {available.map(item=><Pressable key={item.id} accessibilityRole="radio" accessibilityState={{selected:selected===item.id,disabled:busy}} accessibilityLabel={item.account.name} onPress={()=>setSelected(item.id)} disabled={busy} style={{minHeight:44,borderRadius:10,borderWidth:1,borderColor:selected===item.id?palette.blue:palette.border,paddingHorizontal:12,paddingVertical:10,flexDirection:'row',alignItems:'center',gap:9}}><Text style={{flex:1,color:palette.ink,fontWeight:selected===item.id?'700':'500'}}>{item.account.name}</Text>{selected===item.id?<Text style={{color:palette.blue,fontWeight:'700'}}>✓</Text>:null}</Pressable>)}
    <Button message="Share vehicle" disabled={!selected||busy} busy={busy} onPress={()=>{void save({action:'GRANT',connectionId:selected,vehicleId});}}/>
   </>:<Copy message={grants.length?'All current connections already have this vehicle.':'Connect with an account in Network before sharing this vehicle.'}/>}
   {grants.map(grant=><View key={grant.id} style={{gap:6}}><Copy>{grant.name}</Copy><ConfirmationButton message="Remove" disabled={busy} title="Remove capacity access?" detail="This account will no longer see this vehicle on its private map." cancel="Keep access" confirm="Remove access" onConfirm={()=>{void save({action:'REVOKE',grantId:grant.id,revision:grant.revision});}}/></View>)}
   <ErrorText message={error}/>{!!notice&&<Copy>{notice}</Copy>}
  </View>}
 </View>;
}
