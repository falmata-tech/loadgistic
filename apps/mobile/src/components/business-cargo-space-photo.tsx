import {randomUUID} from 'expo-crypto';
import {useEffect,useRef,useState} from 'react';
import {View} from 'react-native';
import {useAccountQuery} from '../hooks/account-query';
import {useLanguage} from '../localization/provider';
import {useAccount} from '../session/provider';
import {PrivateFile} from './private-file';
import {Button,Copy,ErrorText,LoadingSpinner} from './ui';
import {WorkspaceSection} from './workspace-section';

type Photo={id:string;vehicleId:string;receivedAt:string;contentPath:string};
type BusinessPhotoState={photo:Photo|null;request:{id:string;status:string;requestedAt:string}|null};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function BusinessCargoSpacePhoto({workspaceId,vehicleId}:{workspaceId:string;vehicleId:string}){
 const {t,locale}=useLanguage(),account=useAccount();
 const collection=`/api/business-workspaces/${workspaceId}/capacity/photos?vehicleId=${vehicleId}`;
 const query=useAccountQuery<BusinessPhotoState>(collection);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[localPending,setLocalPending]=useState(false);
 const key=useRef<string|null>(null),requested=useRef<{id:string;requestedAt:string}|null>(null),lock=useRef(false);
 const photo=query.data?.photo||null;
 const pending=localPending||query.data?.request?.status==='PENDING';

 useEffect(()=>{
  if(!localPending)return;
  const acknowledged=Boolean(requested.current&&query.data?.request?.id===requested.current.id);
  const fulfilled=Boolean(requested.current&&photo?.receivedAt&&Date.parse(photo.receivedAt)>=Date.parse(requested.current.requestedAt));
  if(acknowledged||fulfilled){setLocalPending(false);key.current=null;requested.current=null;}
 },[localPending,photo?.receivedAt,query.data?.request?.id,query.data?.request?.status]);

 async function requestPhoto(){
  if(lock.current||pending||!query.data)return;
  lock.current=true;setBusy(true);setError('');
  if(!key.current)key.current=randomUUID();
  try{
   const reply=await account.request(`/api/business-workspaces/${workspaceId}/capacity/photo-requests`,{vehicleId,idempotencyKey:key.current}) as {id:string;requestedAt:string;status:string};
   requested.current={id:reply.id,requestedAt:reply.requestedAt};setLocalPending(reply.status==='PENDING');
   if(reply.status!=='PENDING'){key.current=null;requested.current=null;}
   await query.reload();
  }catch{setError('Could not request a photo. Please try again.');}
  finally{lock.current=false;setBusy(false);}
 }

 function readPhoto(){
  if(!photo||!uuid.test(workspaceId)||!uuid.test(photo.id)||photo.vehicleId!==vehicleId||photo.contentPath!==`/api/business-workspaces/${workspaceId}/capacity/photos/${photo.id}`)throw new Error('This photo cannot be opened.');
  return account.request(`${photo.contentPath}?format=base64`);
 }

 const received=photo?.receivedAt?new Date(photo.receivedAt).toLocaleString(locale==='om'?'en-ET':locale):'';
 return <WorkspaceSection message="Cargo space photo" icon="camera"><View testID="business-cargo-space-photo" style={{gap:10}}>
  {query.loading&&<LoadingSpinner accessibilityLabel={t('Loading photo')}/>}
  <ErrorText message={query.error?t(query.error):''}/>
  {!!query.error&&<Button secondary message="Refresh" onPress={()=>{void query.reload();}}/>}
  {photo?<View style={{gap:8}}><Copy>{t('Photo received {date}',{date:received})}</Copy><PrivateFile label={t('Open photo')} title={t('Cargo space photo')} imageLabel={t('Cargo space photo')} closeLabel={t('Close photo')} load={readPhoto}/></View>:query.data?<Copy message="No photo yet"/>:null}
  {query.data&&(pending?<Copy message="Photo requested"/>:<Button secondary message={photo?'Request new photo':'Request photo'} busy={busy} onPress={()=>{void requestPhoto();}}/>)}
  <ErrorText message={error?t(error):''}/>
 </View></WorkspaceSection>;
}
