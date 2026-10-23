import { Page, Title, Copy, Button, ErrorText, LoadingSpinner } from '../components/ui';
import {useState} from 'react';
import { Switch, View } from 'react-native';
import {Redirect,router} from 'expo-router';
import {useAccount} from '../session/provider';
import {useLanguage} from '../localization/provider';
import {accountSections,hasWorkspace,workspaceCapabilities,type AccountSection} from '../navigation/destinations';
import {WorkspaceAction,WorkspaceTaskHeader,WorkspaceTaskPane,WorkspaceFact} from '../components/workspace-task';
import type {IconName} from '../components/app-icon';
import AccountDetails from '../screens/account-details';
import Security from '../screens/account-security';
import DriverPhoto from '../screens/driver-photo';
import Profile from '../screens/profile';
import Documents from '../screens/documents';
const sections:Record<AccountSection,{message:string;icon:IconName}>={
 DETAILS:{message:'Account details',icon:'user'},
 SECURITY:{message:'Email and account security',icon:'shield'},PROFILE:{message:'Transporter profile',icon:'profile'},
};

export default function AccountSettings(){
 const account=useAccount(),{t}=useLanguage();
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[task,setTask]=useState('');
 if(account.busy)return <Page><LoadingSpinner/></Page>;
 if(!hasWorkspace(account.session))return <Redirect href="/account"/>;
 if(account.session!.user.role==='CUSTOMER')return <Redirect href="/business-account"/>;
 const capabilities=workspaceCapabilities(account.session);
 async function signOut(){
  if(busy)return;setBusy(true);setError('');
  try{await account.signOut();router.replace('/account');}
  catch{setError(t('Sign-out could not finish. Please try again.'));}
  finally{setBusy(false);}
 }
 const tasks=[...accountSections(account.session).map(section=>({id:section,...sections[section]})),...(capabilities.drivesTruck?[{id:'PHOTO',message:'Your driver photo',icon:'user' as const}]:[]),...(account.session!.access?.granted&&(capabilities.drivesTruck||capabilities.ownsProviderAccount)?[{id:'DOCUMENTS',message:capabilities.drivesTruck?'Your documents':'Provider documents',icon:'documents' as const}]:[])];
 const current=tasks.find(item=>item.id===task);
 return <Page>{current?<WorkspaceTaskHeader title={t(current.message)} backMessage="Back to account" onBack={()=>setTask('')}/>:<><Title message="Account"/><Copy>{account.session!.user.name}</Copy>{tasks.map(item=><WorkspaceAction key={item.id} message={item.message} icon={item.icon} onPress={()=>setTask(item.id)}/>)}</>}
  <WorkspaceTaskPane active={task==='DETAILS'}><AccountDetails embedded/>{capabilities.canManageFleet&&<DrivingMode value={capabilities.drivesTruck}/>}</WorkspaceTaskPane>
  <WorkspaceTaskPane active={task==='SECURITY'}><Security embedded/></WorkspaceTaskPane>
  <WorkspaceTaskPane active={task==='PROFILE'}><Profile embedded/></WorkspaceTaskPane>
  {capabilities.drivesTruck&&<WorkspaceTaskPane active={task==='PHOTO'}><DriverPhoto embedded/></WorkspaceTaskPane>}
  {account.session!.access?.granted&&<WorkspaceTaskPane active={task==='DOCUMENTS'}><Documents embedded scope={{kind:'ACCOUNT',includeDriver:capabilities.drivesTruck,driverId:capabilities.drivesTruck?account.session!.user.id:undefined,includeOwner:capabilities.ownsProviderAccount}}/></WorkspaceTaskPane>}
  {!current&&<><ErrorText message={error}/><Button secondary message="Sign out" busy={busy} onPress={()=>{void signOut();}}/></>}
 </Page>;

}

function DrivingMode({value}:{value:boolean}){
 const account=useAccount(),{t}=useLanguage(),[drivesTruck,setDrivesTruck]=useState(value),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false),[error,setError]=useState(''),[editing,setEditing]=useState(false);
 async function save(){if(busy)return;setBusy(true);setError('');try{if(!saved){await account.request('/api/mobile/account/driving-mode',{drivesTruck});setSaved(true);}await account.reload();setSaved(false);setEditing(false);}catch(error){setError(error instanceof Error?error.message:'Could not confirm this change. Refresh before retrying.');}finally{setBusy(false);}}
 if(!editing)return <View style={{gap:10}}><WorkspaceFact message="I drive a vehicle" value={t(value?'Yes':'No')}/><Button secondary message="Change driving settings" onPress={()=>{setDrivesTruck(value);setEditing(true);}}/></View>;
 return <View style={{gap:10}}><View style={{flexDirection:'row',alignItems:'center',gap:12}}><Switch accessibilityLabel={t('I drive a vehicle')} value={drivesTruck} onValueChange={setDrivesTruck} disabled={busy||saved}/><View style={{flex:1}}><Copy message="I drive a vehicle"/><Copy message="Keep my driving controls on Home."/></View></View><ErrorText message={error}/><Button secondary message={saved?'Refresh':'Save'} disabled={!saved&&drivesTruck===value} busy={busy} onPress={()=>{void save();}}/><Button secondary message="Cancel" busy={busy} onPress={()=>{setDrivesTruck(value);setEditing(false);setError('');}}/></View>;
}
