import {useRef,useState} from 'react';
import {useAccount} from '../session/provider';
import {Button,Card,Copy,ErrorText,Field,Title} from './ui';

export function TrackingPartnerForm({shipmentId,reload}:{shipmentId:string;reload:()=>Promise<void>}){
 const account=useAccount(),lock=useRef(false);
 const [email,setEmail]=useState(''),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false),[error,setError]=useState('');
 async function save(){
  if(lock.current||saved||!email.trim())return;
  lock.current=true;setBusy(true);setError('');
  try{
   const result=await account.request('/api/tracking/sessions/partner',{shipmentId,email:email.trim()}) as {ok?:boolean;data?:boolean};
   if(result?.ok!==true||result.data!==true)throw Error('Refresh the shipment and check its partner.');
   setSaved(true);
  }catch(error){setError(error instanceof Error?error.message:'Refresh the shipment and check its partner.');}
  finally{try{await reload();}finally{lock.current=false;setBusy(false);}}
 }
 return <Card><Title message="Shipment partner"/>{saved?<Copy message="Partner added"/>:<>
  <Copy message="Choose one account to manage customer tracking and approve unloading."/>
  <Field message="Shipper or broker account email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" maxLength={254} editable={!busy}/>
  <ErrorText message={error}/><Button message="Add partner" busy={busy} disabled={!email.trim()} onPress={()=>void save()}/>
 </>}</Card>;
}
