import {useRef,useState} from 'react';
import {Redirect} from 'expo-router';
import {useAccount} from '../session/provider';
import {Page,Title,Copy,Field,Button,ErrorText} from '../components/ui';
export default function ReviewAccess(){
 const account=useAccount(),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),lock=useRef(false);
 if(account.session)return <Redirect href="/account"/>;
 const submit=async()=>{if(lock.current)return;lock.current=true;const credential=password;setPassword('');setBusy(true);setError('');try{await account.signInReview(email,credential);}catch(caught){setError(caught instanceof Error?caught.message:'The review account could not sign in.');}finally{lock.current=false;setBusy(false);}};
 return <Page><Title message="App review access"/><Copy message="Use the demo credentials provided in Play Console. Demo records stay private and have no access to customer workspaces or staff tools."/><ErrorText message={error}/><Field message="Review account email" value={email} onChangeText={setEmail} autoComplete="email" autoCapitalize="none" keyboardType="email-address" editable={!busy}/><Field message="Review account password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" editable={!busy} onSubmitEditing={()=>void submit()}/><Button message="Sign in" busy={busy} disabled={!email.trim()||password.length<8} onPress={()=>void submit()}/></Page>;
}
