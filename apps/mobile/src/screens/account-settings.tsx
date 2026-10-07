import {Page,Title,Copy,Button,ErrorText} from '../components/ui';
import {useState} from 'react';
import {ActivityIndicator} from 'react-native';
import {Redirect,router} from 'expo-router';
import {useAccount} from '../session/provider';
import {useLanguage} from '../localization/provider';
import {accountSections,hasWorkspace,type AccountSection} from '../navigation/destinations';
import {WorkspaceSection} from '../components/workspace-section';
import type {IconName} from '../components/app-icon';
import AccountDetails from '../screens/account-details';
import Security from '../screens/account-security';
import DriverPhoto from '../screens/driver-photo';
import Profile from '../screens/profile';
import RegularService from '../screens/regular-service';
import Documents from '../screens/documents';
import Billing from '../screens/billing';
const sections:Record<AccountSection,{message:string;icon:IconName}>={
 DETAILS:{message:'Account details',icon:'user'},PHOTO:{message:'Your driver photo',icon:'user'},
 SECURITY:{message:'Email and account security',icon:'shield'},PROFILE:{message:'Transporter profile',icon:'profile'},
 REGULAR:{message:'Regular service',icon:'route'},DOCUMENTS:{message:'Documents',icon:'documents'},BILLING:{message:'Plan and payments',icon:'billing'},
};

export default function AccountSettings(){
 const account=useAccount(),{t}=useLanguage();
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 if(account.busy)return <Page><ActivityIndicator/></Page>;
 if(!hasWorkspace(account.session))return <Redirect href="/account"/>;
 async function signOut(){
  if(busy)return;setBusy(true);setError('');
  try{await account.signOut();router.replace('/account');}
  catch{setError(t('Sign-out could not finish. Please try again.'));}
  finally{setBusy(false);}
 }
 return <Page><Title message="Account"/><Copy>{account.session!.user.name}</Copy>
  {accountSections(account.session).map(section=><WorkspaceSection key={`${account.session!.user.id}:${section}`} {...sections[section]} initiallyOpen={section==='DETAILS'}>
   {section==='DETAILS'?<AccountDetails embedded/>:section==='PHOTO'?<DriverPhoto embedded/>:section==='SECURITY'?<Security embedded/>:section==='PROFILE'?<Profile embedded/>:section==='REGULAR'?<RegularService embedded/>:section==='DOCUMENTS'?<Documents embedded scope={{kind:'ACCOUNT',includeDriver:account.session!.user.role==='DRIVER'}}/>:<Billing embedded/>}
  </WorkspaceSection>)}
  <ErrorText message={error}/><Button secondary message="Sign out" busy={busy} onPress={()=>{void signOut();}}/>
 </Page>;
}
