import {useRef,useState} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {Redirect,router} from 'expo-router';
import {useAccount} from '../session/provider';
import {useAccountQuery} from '../hooks/account-query';
import {useLanguage} from '../localization/provider';
import { Page, Title, Copy, Field, Button, ErrorText, palette, LoadingSpinner } from '../components/ui';
import {AppIcon} from '../components/app-icon';
import {Choices} from '../components/choices';
import {WorkspaceTaskHeader} from '../components/workspace-task';
import {parseBusinessContext,type BusinessWorkspaceContext} from '../api/business-workspaces';

export function businessHome(workspace:{permissions:{capacity:boolean;tracking:boolean}}|null|undefined){return workspace?.permissions.capacity?'/business-capacity':workspace?.permissions.tracking?'/business-tracking':'/business-account';}
export default function BusinessWorkspaces({startBusiness=false}:{startBusiness?:boolean}={}){
 const account=useAccount();
 if(account.busy)return <Page><LoadingSpinner/></Page>;
 if(!account.session)return <Redirect href="/account"/>;
 return <WorkspaceChoice key={account.session.user.id} startBusiness={startBusiness}/>;
}
function WorkspaceChoice({startBusiness}:{startBusiness:boolean}){
 const account=useAccount(),session=account.session!,{t}=useLanguage(),query=useAccountQuery<BusinessWorkspaceContext>('/api/business-workspaces'),eligibility=useAccountQuery<{canCreateProvider:boolean}>('/api/mobile/onboarding');
 const [creating,setCreating]=useState(startBusiness),[name,setName]=useState(''),[handle,setHandle]=useState(''),[city,setCity]=useState(''),[kind,setKind]=useState('BROKER'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [saved,setSaved]=useState(false),lock=useRef(false);
 let data:BusinessWorkspaceContext|null=null;try{if(query.data)data=parseBusinessContext(query.data,session.user.id);}catch{/* Never present unvalidated or foreign context as a workspace. */}
 async function change(path:string,body:unknown){
  if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try{
   if(!saved){await account.request(path,body);setSaved(true);}
   const updated=await account.reload();
   if(!updated)throw Error(t('Please sign in again.'));
   setSaved(false);
   if(updated.user.role==='CUSTOMER'&&updated.user.selectedBusinessWorkspace)router.replace(businessHome(updated.user.selectedBusinessWorkspace));
   else if(updated.state==='ACTIVE'&&updated.user.providerWorkspaceAvailable)router.replace('/account');
   else{await query.reload();setCreating(false);}
  }catch(error){setError(error instanceof Error?error.message:t('Could not save changes.'));}
  finally{lock.current=false;setBusy(false);}
 }
 const invalid=!data&&Boolean(query.data);
 return <Page>{creating?<WorkspaceTaskHeader title={t('Create a shipper / broker workspace')} backMessage="Your workspaces" onBack={()=>{if(!busy&&!saved)setCreating(false);}}/>:<><Title message="Your workspaces"/><Copy message="Choose where you want to work."/></>}
  <ErrorText message={error||query.error||(invalid?t('Could not load this workspace. Please try again.'):'')}/>
  {saved?<><Copy message="Your account is saved. Try again to open your workspace."/><Button message="Try again" busy={busy} onPress={()=>{void change('',{});}}/></>:creating?<>
   <Field message="Account name" value={name} onChangeText={setName} maxLength={100} autoComplete="organization" editable={!busy}/>
   <Field message="Handle" value={handle} onChangeText={setHandle} maxLength={60} autoCapitalize="none" autoCorrect={false} editable={!busy}/>
   <Copy message="Use letters, numbers, underscores or hyphens."/>
   <Copy message="Which best describes your work?"/><Choices value={kind} options={['Broker','Shipper','Receiver'].map(label=>({id:label.toUpperCase(),label:t(label)}))} onChange={setKind} disabled={busy}/>
   <Field message="Office city" value={city} onChangeText={setCity} maxLength={100} editable={!busy}/>
   <Button message="Create workspace" busy={busy} disabled={name.trim().length<2||!/^[a-z0-9][a-z0-9_-]{2,59}$/.test(handle)} onPress={()=>{void change('/api/business-workspaces',{action:'CREATE',name,handle,kind,city:city.trim()||null});}}/>
   <Button secondary message="Cancel" disabled={busy} onPress={()=>setCreating(false)}/>
  </>:<>
   {query.loading&&<LoadingSpinner accessibilityLabel={t('Loading your workspaces')}/>}
   {data?.invitations.length? <View style={styles.group}><Text style={styles.heading}>{t('You have been invited')}</Text>{data.invitations.map(invitation=><View style={styles.row} key={invitation.id}><AppIcon name="users" color={palette.blue}/><View style={styles.text}><Text style={styles.name}>{invitation.businessName}</Text><Text style={styles.detail}>@{invitation.handle} · {t(invitation.role==='ADMIN'?'Workspace admin':'Team member')}</Text></View><Button secondary message="Join" busy={busy} onPress={()=>{void change(`/api/business-workspaces/invitations/${invitation.id}/accept`,{});}}/></View>)}</View>:null}
   {session.user.providerWorkspaceAvailable&&<Pressable accessibilityRole="button" disabled={busy} onPress={()=>{void change('/api/business-workspaces',{action:'SELECT',workspaceId:null});}} style={styles.row}><AppIcon name="truck" color={palette.blue}/><View style={styles.text}><Text style={styles.name}>{t('Transport Provider')}</Text><Text style={styles.detail}>{t('Your vehicles, drivers and capacity')}</Text></View><AppIcon name="next"/></Pressable>}
   {data?.workspaces.map(workspace=><Pressable key={workspace.id} accessibilityRole="button" disabled={busy} onPress={()=>{void change('/api/business-workspaces',{action:'SELECT',workspaceId:workspace.id});}} style={styles.row}><AppIcon name="profile" color={palette.blue}/><View style={styles.text}><Text style={styles.name}>{workspace.name}</Text><Text style={styles.detail}>@{workspace.handle} · {t(workspace.membershipRole==='OWNER'?'Owner':workspace.membershipRole==='ADMIN'?'Workspace admin':'Team member')}</Text></View>{workspace.id===data.selectedWorkspaceId?<AppIcon name="check" color={palette.blue}/>:<AppIcon name="next"/>}</Pressable>)}
   {!session.user.providerWorkspaceAvailable&&eligibility.data?.canCreateProvider&&<Pressable accessibilityRole="button" disabled={busy} onPress={()=>router.push({pathname:'/account',params:{setup:'provider'}})} style={styles.choice}><AppIcon name="truck" color={palette.blue}/><Text style={styles.name}>{t('Transport Provider')}</Text><Copy message="Manage your vehicles and share their capacity with customers."/></Pressable>}
   <Pressable accessibilityRole="button" disabled={busy} onPress={()=>setCreating(true)} style={styles.choice}><AppIcon name="profile" color={palette.blue}/><Text style={styles.name}>{t('Shipper / broker workspace')}</Text><Copy message="Keep your transport network and shipments in view with your team."/></Pressable>
   {!!(query.error||invalid)&&<Button secondary message="Refresh" busy={query.loading} onPress={()=>{void query.reload();}}/>}
  </>}
 </Page>;
}
const styles=StyleSheet.create({group:{gap:8},heading:{fontSize:17,fontWeight:'700',color:palette.ink},row:{minHeight:82,flexDirection:'row',alignItems:'center',gap:12,paddingVertical:14,borderBottomWidth:1,borderColor:palette.border},text:{flex:1,minWidth:0,gap:5},name:{fontSize:17,fontWeight:'700',color:palette.ink},detail:{fontSize:13,lineHeight:19,color:palette.muted},choice:{borderWidth:1,borderColor:palette.border,borderRadius:14,padding:18,gap:9,backgroundColor:'#fff'}});
