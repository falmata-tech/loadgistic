import { useRef,useState } from 'react';
import { View } from 'react-native';
import {Switch} from '../components/branded-switch';
import { Redirect } from 'expo-router';
import { useAccount } from '../session/provider';
import { useAccountQuery } from '../hooks/account-query';
import { FilePicker,uploadBody,useFileSelection } from '../components/private-file';
import { PublicImage } from '../components/public-details';
import { Page, Title, Copy, Button, ErrorText, LoadingSpinner } from '../components/ui';
import {useLanguage} from '../localization/provider';
export default function DriverPhoto({embedded=false}:{embedded?:boolean}={}){const account=useAccount();if(account.busy)return <Page embedded={embedded}><LoadingSpinner/></Page>;if(!account.session)return <Redirect href="/account"/>;if(account.session.user.role!=='DRIVER'&&account.session.user.drivesTruck!==true)return <Page embedded={embedded}><Copy message={"Only a driver can manage their own public photo."}/></Page>;return <Photo key={account.session.user.id} embedded={embedded}/>;}
function Photo({embedded}:{embedded:boolean}){
 const {t}=useLanguage(),account=useAccount(),query=useAccountQuery<{image:string;hasPortrait:boolean}>('/api/mobile/account/portrait'),{file,setFile}=useFileSelection(),lock=useRef(false);
 const [editing,setEditing]=useState(false);
 const [consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[confirmRemove,setConfirmRemove]=useState(false),[previewVersion,setPreviewVersion]=useState(0),[committed,setCommitted]=useState(false);
 const preview=committed&&(query.loading||query.error)?null:query.data;
 async function save(remove=false){if(lock.current)return;lock.current=true;setBusy(true);setError('');setMessage('');try{if(!remove&&(!file||!consent))throw Error('Choose your photo and confirm public display.');await account.request('/api/mobile/account/portrait',remove?{action:'REMOVE',confirm:true}:uploadBody({action:'UPLOAD',consent:true},file!));setCommitted(true);setFile(null);setConsent(false);setConfirmRemove(false);setMessage(remove?'Public photo removed.':'Public photo updated.');await query.reload();setPreviewVersion(value=>value+1);setEditing(false);}catch(error){setError(error instanceof Error?error.message:'Refresh to check whether your photo was saved.');}finally{lock.current=false;setBusy(false);}}
 return <Page embedded={embedded}>{!embedded&&<Title message={"Your driver photo"}/>}<Copy message={"Help people recognize the driver behind the vehicle. Your photo may appear in public capacity and Featured."}/><ErrorText message={error||query.error}/>{query.loading&&!preview&&<LoadingSpinner/>}{preview&&<PublicImage key={previewVersion} path={preview.image} label={t('Your public driver photo')} portrait/>}{committed&&!!query.error&&<Copy message="Your photo was saved. Refresh to load the current preview."/>}
 {!editing?<Button secondary message="Change driver photo" busy={busy} onPress={()=>setEditing(true)}/>:<><FilePicker imagesOnly file={file} disabled={busy} onChange={value=>{setFile(value);setConsent(false);}}/><View style={{flexDirection:'row',gap:12,alignItems:'center'}}><Switch accessibilityLabel={t('Allow public display of my driver photo')} value={consent} onValueChange={setConsent} disabled={busy}/><View style={{flex:1}}><Copy message={"This is my photo. I agree to show it publicly on Loadgistic."}/></View></View>
 <Button message="Save public photo" busy={busy} disabled={!file||!consent} onPress={()=>{void save();}}/><Button secondary message="Cancel" busy={busy} onPress={()=>{setFile(null);setConsent(false);setEditing(false);setError('');}}/></>}{!editing&&preview?.hasPortrait&&(confirmRemove?<><Copy message="Remove your public photo?"/><Copy message="The driver silhouette will appear instead."/><Button secondary message="Keep photo" disabled={busy} onPress={()=>setConfirmRemove(false)}/><Button message="Remove photo" busy={busy} onPress={()=>{void save(true);}}/></>:<Button secondary message="Remove public photo" busy={busy} onPress={()=>setConfirmRemove(true)}/>)}
 <Button secondary message="Refresh photo" busy={query.loading||busy} onPress={()=>{void query.reload().then(()=>setPreviewVersion(value=>value+1));}}/>{!!message&&<Copy>{t(message)}</Copy>}</Page>;
}
