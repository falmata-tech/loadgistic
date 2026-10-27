import {useEffect,useRef,useState} from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import {Switch} from '../components/branded-switch';
import {Redirect,router} from 'expo-router';
import {useAccount} from '../session/provider';
import {useAccountQuery} from '../hooks/account-query';
import {useLanguage} from '../localization/provider';
import { Page, Title, Copy, Field, Button, ErrorText, palette, LoadingSpinner } from '../components/ui';
import {Choices} from '../components/choices';
import {WorkspaceAction,WorkspaceFact,WorkspaceTaskHeader} from '../components/workspace-task';
import {parseBusinessDirectory,type BusinessWorkspaceDirectory,type BusinessMember} from '../api/business-workspaces';
import AccountDetails from './account-details';
import AccountSecurity from './account-security';
import {BusinessDocuments} from '../components/business-documents';
import {ApiError} from '../api/response';
import {businessAccountGroups,type BusinessAccountActionId} from '../navigation/business-account-groups';
import {AppIcon} from '../components/app-icon';
export default function BusinessAccount(){
 const account=useAccount(),workspace=account.session?.user.selectedBusinessWorkspace;
 if(account.busy)return <Page><LoadingSpinner/></Page>;
 if(!account.session)return <Redirect href="/account"/>;
 if(account.session.user.role!=='CUSTOMER'||!workspace)return <Redirect href="/workspaces"/>;
 return <Account key={`${account.session.user.id}:${workspace.id}:${workspace.membershipRevision}`} workspaceId={workspace.id}/>;
}
function Account({workspaceId}:{workspaceId:string}){
 const account=useAccount(),actorId=account.session!.user.id,{t}=useLanguage(),query=useAccountQuery<BusinessWorkspaceDirectory>(`/api/business-workspaces/${workspaceId}`);
 const refreshTeam=query.refresh;
 const [task,setTask]=useState(''),[member,setMember]=useState<BusinessMember|null>(null),[error,setError]=useState('');
 useEffect(()=>{
  if(task!=='TEAM')return;
  const refresh=()=>{void refreshTeam();};refresh();
  const subscription=AppState.addEventListener('change',state=>{if(state==='active')refresh();});
  const timer=setInterval(refresh,30000);
  return()=>{subscription.remove();clearInterval(timer);};
 },[task,refreshTeam]);
 let data:BusinessWorkspaceDirectory|null=null;let invalid='';try{if(query.data)data=parseBusinessDirectory(query.data,actorId,workspaceId);}catch{invalid=t('Could not load this workspace. Please try again.');}
 const labels:Record<string,string>={TEAM:'Team',DETAILS:'Workspace details',DOCUMENTS:'Documents',PERSONAL:'Account details',SECURITY:'Email and account security',INVITE:'Invite teammate',EDIT:'Team member',TRANSFER:'Transfer ownership',LEAVE:'Leave workspace'};
 const actionGroups=businessAccountGroups(data?.workspace.permissions??null);
 function openAccountAction(action:BusinessAccountActionId){
  setError('');
  if(action==='TEAM')setTask('TEAM');
  else if(action==='DETAILS')setTask('DETAILS');
  else if(action==='DOCUMENTS')setTask('DOCUMENTS');
  else if(action==='LEAVE')setTask('LEAVE');
  else if(action==='PERSONAL')setTask('PERSONAL');
  else if(action==='SECURITY')setTask('SECURITY');
  else if(action==='SUPPORT')router.push('/support');
  else if(action==='SWITCH')router.push('/workspaces');
 }
 async function changed(){await query.reloadConfirmed();await account.reload();setTask(current=>['TEAM','INVITE','EDIT','TRANSFER'].includes(current)?'TEAM':'');setMember(null);}
 return <Page>{task?<WorkspaceTaskHeader title={t(labels[task]||'Account')} backMessage="Back to account" onBack={()=>{setTask(task==='INVITE'||task==='EDIT'?'TEAM':'');setMember(null);setError('');}}/>:<><Title message="Account"/><Copy>{data?.workspace.name||account.session?.user.selectedBusinessWorkspace?.name}</Copy></>}
  <ErrorText message={error||query.error||invalid}/>{query.loading&&<LoadingSpinner/>}
  {!task&&<>
   {actionGroups.map(group=><View key={group.id} testID={`business-account-group-${group.id}`} style={styles.actionGroup}>
    <View style={styles.actionGroupHeading}><AppIcon name={group.icon} color={palette.blue}/><Text accessibilityRole="header" style={styles.actionGroupTitle}>{t(group.title)}</Text></View>
    {group.actions.map(action=><WorkspaceAction key={action.id} message={action.message} icon={action.icon} onPress={()=>openAccountAction(action.id)}/>)}
    {group.signOut&&<Button secondary message="Sign out" onPress={()=>{void account.signOut().then(()=>router.replace('/account')).catch(error=>setError(error instanceof Error?error.message:t('Could not confirm sign out. Please try again.')));}}/>}
   </View>)}
  </>}
  {task==='PERSONAL'&&<AccountDetails embedded/>}
  {task==='SECURITY'&&<AccountSecurity embedded/>}
  {data&&task==='DETAILS'&&<BusinessDetails data={data} onChanged={changed}/>}
  {data&&task==='DOCUMENTS'&&data.workspace.permissions.owner&&<BusinessDocuments workspaceId={workspaceId} canManage/>}
  {data&&task==='TEAM'&&<Team data={data} onInvite={()=>setTask('INVITE')} onEdit={value=>{setMember(value);setTask('EDIT');}} onTransfer={()=>setTask('TRANSFER')} onChanged={changed}/>}
  {data&&task==='INVITE'&&<MemberForm data={data} onChanged={changed} onCancel={()=>setTask('TEAM')}/>}
  {data&&task==='EDIT'&&member&&<MemberForm data={data} member={member} onChanged={changed} onCancel={()=>setTask('TEAM')}/>}
  {data&&task==='TRANSFER'&&<Transfer data={data} onChanged={changed}/>}
  {data&&task==='LEAVE'&&<LeaveBusiness data={data} onChanged={changed}/>}
  {!!(query.error||invalid)&&<Button secondary message="Refresh" busy={query.loading} onPress={()=>{void query.reload();}}/>}
 </Page>;
}
function useCommand(data:BusinessWorkspaceDirectory,onChanged:()=>Promise<void>){
 const account=useAccount(),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saved,setSaved]=useState(false),[conflict,setConflict]=useState(false),lock=useRef(false);
 async function command(input:Record<string,unknown>){
  if(lock.current)return;lock.current=true;setBusy(true);setError('');setConflict(false);
  try{if(!saved){const result=await account.request(`/api/business-workspaces/${data.workspace.id}`,{...input,expectedVersion:data.workspace.version}) as {delivery?:string};setSaved(true);if(result.delivery==='FAILED')throw Error('Invitation saved, but email delivery failed. Use Resend.');}await onChanged();}
  catch(error){setConflict(error instanceof ApiError&&error.code==='BUSINESS_REVISION_CONFLICT');setError(error instanceof Error?error.message:'Could not save changes.');}
  finally{lock.current=false;setBusy(false);}
 }
 return {busy,error,saved,conflict,command};
}
function Team({data,onInvite,onEdit,onTransfer,onChanged}:{data:BusinessWorkspaceDirectory;onInvite:()=>void;onEdit:(member:BusinessMember)=>void;onTransfer:()=>void;onChanged:()=>Promise<void>}){
 const account=useAccount(),{t}=useLanguage(),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function manageInvitation(id:string,action:'RESEND_INVITATION'|'REVOKE_INVITATION'){
  if(busy)return;setBusy(true);setError('');
  try{
   const result=await account.request(`/api/business-workspaces/${data.workspace.id}`,{action,invitationId:id,...(action==='REVOKE_INVITATION'?{expectedVersion:data.workspace.version}:{})}) as {delivery?:string};
   if(result.delivery==='FAILED')throw Error(t('Invitation saved, but email delivery failed. Use Resend.'));
   await onChanged();
  }catch(error){setError(error instanceof Error?error.message:t('Could not save changes.'));}finally{setBusy(false);}
 }
 return <><View style={styles.teamHeading}><Button message="Invite teammate" onPress={onInvite}/></View><ErrorText message={error}/>
  {data.members.map(member=>{const editable=!member.erased&&member.userId!==account.session!.user.id&&member.role!=='OWNER'&&(data.workspace.permissions.owner||member.role==='STAFF');return <View key={member.userId} style={styles.member}><View style={{flex:1,gap:4,minWidth:0}}><Text style={styles.name}>{member.erased?t('Former team member'):member.firstName}</Text><Text style={styles.note}>{member.email||''}</Text><Text style={styles.note}>{t(member.role==='OWNER'?'Owner':member.role==='ADMIN'?'Workspace admin':'Team member')} · {t(member.active?'Active':'Suspended')}</Text><Text style={styles.note}>{[member.capacity?t('Capacity'):null,member.tracking?t('Tracking'):null].filter(Boolean).join(' · ')||t('No map or shipment access')}</Text></View>{editable&&<Button secondary message="Manage" onPress={()=>onEdit(member)}/>}</View>;})}
  {data.invitations.length>0&&<Text style={styles.subheading}>{t('Invitations')}</Text>}
  {data.invitations.map(invitation=><View key={invitation.id} style={styles.member}><View style={{flex:1,gap:7,minWidth:0}}><Text style={styles.name}>{invitation.email}</Text><Text style={styles.note}>{t(invitation.role==='ADMIN'?'Workspace admin':'Team member')} · {t(invitation.status==='EXPIRED'?'Expired':'Pending')}</Text><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{invitation.status!=='EXPIRED'&&(data.workspace.permissions.owner||invitation.role==='STAFF')&&<><Button secondary message="Resend" busy={busy} onPress={()=>{void manageInvitation(invitation.id,'RESEND_INVITATION');}}/><Button secondary message="Remove" busy={busy} onPress={()=>{void manageInvitation(invitation.id,'REVOKE_INVITATION');}}/></>}</View></View></View>)}
  {data.workspace.permissions.owner&&<WorkspaceAction message="Transfer ownership" icon="shield" onPress={onTransfer}/>}
 </>;
}
function MemberForm({data,member,onChanged,onCancel}:{data:BusinessWorkspaceDirectory;member?:BusinessMember;onChanged:()=>Promise<void>;onCancel:()=>void}){
 const {t}=useLanguage(),[email,setEmail]=useState(''),[role,setRole]=useState(member?.role==='ADMIN'?'ADMIN':'STAFF'),[capacity,setCapacity]=useState(member?.capacity??true),[tracking,setTracking]=useState(member?.tracking??true),[active,setActive]=useState(member?.active??true),[remove,setRemove]=useState(false),operation=useCommand(data,onChanged);
 async function save(){await operation.command(member?{action:remove?'REMOVE_MEMBER':'UPDATE_MEMBER',userId:member.userId,...(remove?{}:{role,capacity,tracking,active})}:{action:'INVITE',email,role,capacity,tracking});}
 return <>{member?<WorkspaceFact message="Team member" value={member.firstName}/>:<Field message="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} maxLength={254} editable={!operation.busy&&!operation.saved}/>}
  {!remove&&<>{data.workspace.permissions.owner&&<Choices value={role} options={[{id:'STAFF',label:t('Team member')},{id:'ADMIN',label:t('Workspace admin')}]} onChange={setRole} disabled={operation.busy||operation.saved}/>}
   <Toggle message="View shared capacity" value={capacity} onChange={setCapacity} disabled={operation.busy||operation.saved}/><Toggle message="Tracking: status & route" value={tracking} onChange={setTracking} disabled={operation.busy||operation.saved}/>
   {member&&<Toggle message="Active" value={active} onChange={setActive} disabled={operation.busy||operation.saved}/>}</>}
  {remove&&<Copy message="This member will lose access to this workspace."/>}<ErrorText message={operation.error}/>
  {operation.conflict&&<Button secondary message="Refresh" busy={operation.busy} onPress={()=>{void onChanged();}}/>}
  <Button message={operation.saved?'Refresh':remove?'Remove from team':member?'Save changes':'Send invitation'} busy={operation.busy} disabled={!member&&!email.trim()} onPress={()=>{void save();}}/>
  {member&&!remove&&!operation.saved&&<Button secondary message="Remove from team" disabled={operation.busy} onPress={()=>setRemove(true)}/>}
  <Button secondary message="Cancel" disabled={operation.busy||operation.saved} onPress={onCancel}/>
 </>;
}
function BusinessDetails({data,onChanged}:{data:BusinessWorkspaceDirectory;onChanged:()=>Promise<void>}){
 const [editing,setEditing]=useState(false),[archiving,setArchiving]=useState(false),[name,setName]=useState(data.workspace.name),[city,setCity]=useState(data.workspace.city||''),operation=useCommand(data,async()=>{await onChanged();});
 return <>{operation.conflict&&<Button secondary message="Refresh" busy={operation.busy} onPress={()=>{void onChanged();}}/>}{!editing&&!archiving?<><WorkspaceFact message="Account name" value={data.workspace.name}/><WorkspaceFact message="Handle" value={`@${data.workspace.handle}`}/><WorkspaceFact message="Office city" value={data.workspace.city||''}/>{data.workspace.permissions.team&&<Button secondary message="Edit workspace details" onPress={()=>setEditing(true)}/>}</>:archiving?<><Copy message="This workspace will stop receiving shared Capacity and Tracking. Its team will lose workspace access. Existing history is retained."/><ErrorText message={operation.error}/><Button message={operation.saved?'Refresh':'Archive workspace'} busy={operation.busy} onPress={()=>{void operation.command({action:'ARCHIVE'});}}/><Button secondary message="Cancel" disabled={operation.busy||operation.saved} onPress={()=>setArchiving(false)}/></>:<><Field message="Account name" value={name} onChangeText={setName} maxLength={100} editable={!operation.busy&&!operation.saved}/><Field message="Office city" value={city} onChangeText={setCity} maxLength={100} editable={!operation.busy&&!operation.saved}/><ErrorText message={operation.error}/><Button message={operation.saved?'Refresh':'Save changes'} busy={operation.busy} onPress={()=>{void operation.command({action:'UPDATE_DETAILS',name,city:city||null});}}/><Button secondary message="Cancel" disabled={operation.busy||operation.saved} onPress={()=>setEditing(false)}/></>}
  {!editing&&!archiving&&data.workspace.permissions.owner&&<NetworkVisibility workspaceId={data.workspace.id}/>}
  {!editing&&!archiving&&<BusinessDocuments workspaceId={data.workspace.id} canManage={data.workspace.permissions.owner} summary/>}
  {data.workspace.permissions.owner&&!editing&&!archiving&&<Button secondary message="Archive workspace" onPress={()=>setArchiving(true)}/>}
 </>;
}
function NetworkVisibility({workspaceId}:{workspaceId:string}){
 const account=useAccount(),{t}=useLanguage(),query=useAccountQuery<{visible:boolean;version:number}>(`/api/business-workspaces/${workspaceId}/network-visibility`);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),lock=useRef(false);
 const value=query.data&&typeof query.data.visible==='boolean'&&Number.isSafeInteger(query.data.version)?query.data:null;
 async function change(visible:boolean){if(!value||lock.current)return;lock.current=true;setBusy(true);setError('');
  try{const saved=await account.request(`/api/business-workspaces/${workspaceId}/network-visibility`,{visible,expectedVersion:value.version}) as {visible?:boolean;version?:number};
   if(saved.visible!==visible||!Number.isSafeInteger(saved.version))throw Error(t('Could not confirm the change. Refresh and try again.'));
   await query.reloadConfirmed();
  }catch(problem){setError(problem instanceof Error?problem.message:t('Could not save this setting. Try again.'));}
  finally{lock.current=false;setBusy(false);}
 }
 return <View style={styles.networkVisibility}><View style={styles.row}><Text style={[styles.name,{flex:1}]}>{t('Show network size in Network')}</Text><Switch accessibilityLabel={t('Show network size in Network')} value={value?.visible||false} disabled={!value||busy} onValueChange={next=>{void change(next);}}/></View><Copy message="Signed-in accounts see a vehicle count, never your connections or vehicle list."/><ErrorText message={error||query.error}/>{!!(query.error||error)&&<Button secondary message="Refresh" onPress={()=>{void query.reload();}}/>}</View>;
}
function Transfer({data,onChanged}:{data:BusinessWorkspaceDirectory;onChanged:()=>Promise<void>}){
 const account=useAccount(),[selected,setSelected]=useState(''),operation=useCommand(data,onChanged);
 return <><Copy message="This teammate will become the workspace owner. You will remain a workspace admin."/><Choices value={selected} options={data.members.filter(member=>member.active&&member.userId!==account.session!.user.id).map(member=>({id:member.userId,label:member.firstName}))} onChange={setSelected} disabled={operation.busy||operation.saved}/><ErrorText message={operation.error}/><Button message={operation.saved?'Refresh':'Confirm transfer'} busy={operation.busy} disabled={!selected} onPress={()=>{void operation.command({action:'TRANSFER_OWNERSHIP',userId:selected});}}/></>;
}
function LeaveBusiness({data,onChanged}:{data:BusinessWorkspaceDirectory;onChanged:()=>Promise<void>}){const operation=useCommand(data,onChanged);return <><Copy message="You will lose access to this workspace's shared capacity and shipments."/><ErrorText message={operation.error}/><Button message={operation.saved?'Refresh':'Leave workspace'} busy={operation.busy} onPress={()=>{void operation.command({action:'LEAVE'});}}/></>;}
function Toggle({message,value,onChange,disabled}:{message:string;value:boolean;onChange:(value:boolean)=>void;disabled:boolean}){const {t}=useLanguage();return <View style={styles.row}><Text style={[styles.name,{flex:1}]}>{t(message)}</Text><Switch accessibilityLabel={t(message)} value={value} onValueChange={onChange} disabled={disabled}/></View>;}
const styles=StyleSheet.create({actionGroup:{borderWidth:1,borderColor:palette.border,borderRadius:14,backgroundColor:'#fff',paddingHorizontal:14,paddingTop:8,paddingBottom:12,gap:2},actionGroupHeading:{minHeight:44,flexDirection:'row',alignItems:'center',gap:10,borderBottomWidth:1,borderColor:palette.borderSoft},actionGroupTitle:{fontSize:15,fontWeight:'700',color:palette.ink,flex:1},teamHeading:{alignItems:'flex-start',gap:12},row:{flexDirection:'row',alignItems:'center',gap:12,minHeight:54},networkVisibility:{paddingVertical:14,borderTopWidth:1,borderBottomWidth:1,borderColor:palette.borderSoft,gap:6},member:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:16,borderBottomWidth:1,borderColor:palette.border},name:{fontSize:16,fontWeight:'600',color:palette.ink},note:{fontSize:13,lineHeight:19,color:palette.muted},subheading:{fontSize:17,fontWeight:'700',color:palette.ink,marginTop:12}});
