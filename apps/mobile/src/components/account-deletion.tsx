import {useEffect,useRef,useState} from 'react';
import {Pressable,Text} from 'react-native';
import {apiRequest} from '../api/http';
import {useLanguage} from '../localization/provider';
import {Button,Card,Copy,ErrorText,Field,Title,palette} from './ui';
import * as Storage from '../session/storage';
const receiptKey='loadgistic.deletion.receipt.v1';
type Receipt={status:string;retentionReason:string|null};
export function AccountDeletion({email:initialEmail}:{email:string}){
 const {t}=useLanguage(),[email,setEmail]=useState(initialEmail),[code,setCode]=useState(''),[handoff,setHandoff]=useState(''),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState<Receipt|null>(null),[receipt,setReceipt]=useState('');const lock=useRef(false);
 useEffect(()=>{let live=true;void Storage.getItemAsync(receiptKey).then(raw=>{const saved=raw?JSON.parse(raw):null;if(live&&saved&&typeof saved.receipt==='string'&&saved.request&&['REQUESTED','HELD','ERASING','COMPLETED'].includes(saved.request.status)){setStatus(saved.request);setReceipt(saved.receipt);}}).catch(()=>undefined);return()=>{live=false;};},[]);
 const send=async(step:'REQUEST'|'CONFIRM'|'STATUS')=>{if(lock.current)return;lock.current=true;setBusy(true);setError('');try{
  const body=step==='STATUS'?{step,receipt}:step==='REQUEST'?{step,email}:{step,email,handoff,code,confirm:'DELETE'};
  const result=await apiRequest('/api/mobile/account/deletion',{body}) as {handoff:string;request:Receipt;receipt?:string};
  if(step==='REQUEST')setHandoff(result.handoff);else{setStatus(result.request);if(result.receipt)setReceipt(result.receipt);setCode('');await Storage.setItemAsync(receiptKey,JSON.stringify({receipt:result.receipt||receipt,request:result.request}),{keychainAccessible:Storage.WHEN_UNLOCKED_THIS_DEVICE_ONLY}).catch(()=>setError('Your request is recorded, but this phone could not save its receipt.'));}
 }catch(caught){setError(caught instanceof Error?caught.message:'The request could not be confirmed. Try again.');}finally{lock.current=false;setBusy(false);}};
 return <Card><Title message="Delete account and data"/>
  <Copy message="Request deletion of your Loadgistic account, public profile, contacts, uploaded documents and account-linked messages. Deletion is permanent."/>
  <Copy message="We review requests within 30 days. Unfinished shipments or a company transfer may need to be resolved first; we explain any delay. Essential shipment and security event records may remain without your account contact details."/>
  <ErrorText message={error}/>
  {status?<><Title>{t(status.status==='COMPLETED'?'Deletion completed':status.status==='ERASING'?'Deletion in progress':status.status==='HELD'?'Action needed before deletion':'Deletion request received')}</Title><Copy>{t(status.retentionReason||'Your request is recorded. You do not need to submit it again.')}</Copy><Button secondary message="Check request status" busy={busy} onPress={()=>void send('STATUS')}/><Button secondary message="Verify another account" disabled={busy} onPress={()=>{void Storage.deleteItemAsync(receiptKey).then(()=>{setStatus(null);setReceipt('');setHandoff('');setConfirmed(false);}).catch(()=>setError('Could not clear saved access on this phone. Please try again.'));}}/></>:<>
   <Field message="Account email" value={email} onChangeText={setEmail} autoComplete="email" autoCapitalize="none" keyboardType="email-address" editable={!busy&&!handoff}/>
   {handoff?<><Copy message="If this email has a Loadgistic account, its verification code has been sent. Enter it to confirm your deletion request."/><Field message="Email verification code" value={code} onChangeText={setCode} autoComplete="one-time-code" keyboardType="number-pad" maxLength={6} editable={!busy}/><Pressable accessibilityRole="checkbox" aria-checked={confirmed} accessibilityState={{checked:confirmed,disabled:busy}} disabled={busy} onPress={()=>setConfirmed(!confirmed)} style={{minHeight:48,paddingVertical:10,flexDirection:'row',gap:10}}><Text style={{color:palette.teal,fontSize:22}}>{confirmed?'☑':'☐'}</Text><Text style={{flex:1,color:palette.ink,lineHeight:22}}>{t('I understand deletion is permanent and want to delete this account and its data.')}</Text></Pressable></>:null}
   <Button label={t(handoff?'Submit deletion request':'Verify email to request deletion')} busy={busy} disabled={!email.trim()||(Boolean(handoff)&&(!confirmed||!/^\d{6}$/.test(code)))} onPress={()=>void send(handoff?'CONFIRM':'REQUEST')}/>
   {handoff?<Button secondary message="Use another email or resend" disabled={busy} onPress={()=>{setHandoff('');setCode('');setConfirmed(false);}}/>:null}
  </>}
 </Card>;
}
