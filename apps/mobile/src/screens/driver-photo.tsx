import { useRef,useState } from 'react';
import { ActivityIndicator,Alert,Switch,View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAccount } from '../session/provider';
import { useAccountQuery } from '../hooks/account-query';
import { FilePicker,uploadBody,useFileSelection } from '../components/private-file';
import { PublicImage } from '../components/public-details';
import { Page,Title,Copy,Button,ErrorText } from '../components/ui';
export default function DriverPhoto({embedded=false}:{embedded?:boolean}={}){const account=useAccount();if(account.busy)return <Page embedded={embedded}><ActivityIndicator/></Page>;if(!account.session)return <Redirect href="/account"/>;if(account.session.user.role!=='DRIVER')return <Page embedded={embedded}><Copy message={"Only a driver can manage their own public photo."}/></Page>;return <Photo key={account.session.user.id} embedded={embedded}/>;}
function Photo({embedded}:{embedded:boolean}){
 const account=useAccount(),query=useAccountQuery<{image:string;hasPortrait:boolean}>('/api/mobile/account/portrait'),{file,setFile}=useFileSelection(),lock=useRef(false);
 const [consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 async function save(remove=false){if(lock.current)return;lock.current=true;setBusy(true);setError('');setMessage('');try{if(!remove&&(!file||!consent))throw Error('Choose your photo and confirm public display.');await account.request('/api/mobile/account/portrait',remove?{action:'REMOVE',confirm:true}:uploadBody({action:'UPLOAD',consent:true},file!));setFile(null);setConsent(false);await query.reload();setMessage(remove?'Public photo removed.':'Public photo updated.');}catch(error){setError(error instanceof Error?error.message:'Refresh to check whether your photo was saved.');}finally{lock.current=false;setBusy(false);}}
 return <Page embedded={embedded}>{!embedded&&<Title message={"Your driver photo"}/>}<Copy message={"Help people recognize the driver behind the truck. Your photo may appear in public capacity and Featured."}/><ErrorText message={error||query.error}/>{query.loading&&!query.data&&<ActivityIndicator/>}{!!query.data?.image&&<PublicImage path={query.data.image} label="Your public driver photo" portrait/>}
 <FilePicker imagesOnly file={file} disabled={busy} onChange={value=>{setFile(value);setConsent(false);}}/><View style={{flexDirection:'row',gap:12,alignItems:'center'}}><Switch accessibilityLabel="Allow public display of my driver photo" value={consent} onValueChange={setConsent} disabled={busy}/><View style={{flex:1}}><Copy message={"This is my photo. I agree to show it publicly on Loadgistic."}/></View></View>
 <Button message="Save public photo" busy={busy} disabled={!file||!consent} onPress={()=>{void save();}}/>{query.data?.hasPortrait&&<Button secondary message="Remove public photo" busy={busy} onPress={()=>Alert.alert('Remove your public photo?','The driver silhouette will appear instead.',[{text:'Keep photo',style:'cancel'},{text:'Remove photo',style:'destructive',onPress:()=>{void save(true);}}])}/>}
 <Button secondary message="Refresh photo" busy={query.loading||busy} onPress={()=>{void query.reload();}}/>{!!message&&<Copy>{message}</Copy>}</Page>;
}
