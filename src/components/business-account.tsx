'use client';
import React from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {Building2,Check,Headphones,Mail,MoreHorizontal,Pencil,Plus,Shield,UserRound,Users,X} from 'lucide-react';
import type {BusinessCommand,BusinessMember,BusinessPendingInvitation,BusinessWorkspaceDirectory} from '@/lib/business-workspaces/contracts';
import {AccountDetailsForm} from './account-details-form';
import {BusinessDocuments} from './business-documents';
import {businessRequest} from './business-workspace-choice';
import {Text,FeedbackText} from './localization';
import styles from './business-workspace.module.css';

type Task={kind:'PERSONAL'}|{kind:'DETAILS'}|{kind:'INVITE'}|{kind:'MEMBER';member:BusinessMember}|{kind:'ARCHIVE'}|{kind:'LEAVE'}|{kind:'TRANSFER';member:BusinessMember}|null;
const roleLabel=(role:string)=>role==='OWNER'?'Owner':role==='ADMIN'?'Workspace admin':'Team member';
export function BusinessAccount({initial,name,email,firstName,lastName,phone}:{initial:BusinessWorkspaceDirectory;name:string;email:string;firstName?:string;lastName?:string;phone?:string|null}){
 const router=useRouter();
 const [directory,setDirectory]:[BusinessWorkspaceDirectory,(value:BusinessWorkspaceDirectory)=>void]=React.useState(initial);
 const [task,setTask]:[Task,(value:Task)=>void]=React.useState(null);
 const [busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[notice,setNotice]=React.useState('');
 const workspace=directory.workspace,dialog=React.useRef(null as HTMLDialogElement|null),current=React.useRef(workspace.id);current.current=workspace.id;
 React.useEffect(()=>{setDirectory(initial);setTask(null);setError('');setNotice('');},[initial]);
 React.useEffect(()=>{if(task&&!dialog.current?.open)dialog.current?.showModal();return()=>{if(dialog.current?.open)dialog.current.close();};},[task]);
 async function refresh(){
  const response=await fetch(`/api/business-workspaces/${workspace.id}`,{cache:'no-store',signal:AbortSignal.timeout(20000)});
  const data:unknown=await response.json();const row=data&&typeof data==='object'&&!Array.isArray(data)?data as Record<string,unknown>:null;
  if(!response.ok){if(response.status===401||response.status===403)router.refresh();throw new Error('The workspace could not be loaded. Try again.');}
  const scope=row?.workspace&&typeof row.workspace==='object'?row.workspace as Record<string,unknown>:null;
  if(!row||scope?.id!==workspace.id||scope?.actorId!==workspace.actorId||!Array.isArray(row.members)||!Array.isArray(row.invitations))throw new Error('The workspace could not be loaded. Try again.');
  if(current.current===workspace.id)setDirectory(row as unknown as BusinessWorkspaceDirectory);
 }
 React.useEffect(()=>{
  if(task||busy)return;
  const reload=()=>{if(document.visibilityState==='visible')void refresh().catch(problem=>setError(problem instanceof Error?problem.message:'The workspace could not be loaded. Try again.'));};
  window.addEventListener('focus',reload);document.addEventListener('visibilitychange',reload);
  return()=>{window.removeEventListener('focus',reload);document.removeEventListener('visibilitychange',reload);};
 },[workspace.id,workspace.actorId,task,busy]);
 async function command(input:BusinessCommand|{action:'RESEND_INVITATION';invitationId:string}){
  if(busy)return;setBusy(true);setError('');setNotice('');try{
   const result=await businessRequest(`/api/business-workspaces/${workspace.id}`,input);
   if(input.action==='ARCHIVE'||input.action==='LEAVE'){router.push('/workspaces');router.refresh();return;}
   setTask(null);await refresh();
   setNotice(result?.delivery==='FAILED'?'The invitation is saved, but its email could not be sent. You can resend it.':result?.delivery==='PENDING'?'The invitation is saved. Its email is being sent.':result?.delivery==='SENT'?'Invitation sent.':input.action==='INVITE'?'Invitation saved. They can sign in with this email to join.':'Changes saved.');
   router.refresh();
  }catch(error){setError((error as Error).message);}finally{setBusy(false);}
 }
 async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();if(!task)return;const form=new FormData(event.currentTarget),expectedVersion=workspace.version;
  if(task.kind==='DETAILS')await command({action:'UPDATE_DETAILS',expectedVersion,name:String(form.get('name')||''),city:String(form.get('city')||'')||null});
  if(task.kind==='INVITE')await command({action:'INVITE',expectedVersion,email:String(form.get('email')||''),role:form.get('role')==='ADMIN'?'ADMIN':'STAFF',capacity:form.get('capacity')==='on',tracking:form.get('tracking')==='on'});
  if(task.kind==='MEMBER')await command({action:'UPDATE_MEMBER',expectedVersion,userId:task.member.userId,role:form.get('role')==='ADMIN'?'ADMIN':'STAFF',capacity:form.get('capacity')==='on',tracking:form.get('tracking')==='on',active:form.get('active')==='on'});
  if(task.kind==='ARCHIVE')await command({action:'ARCHIVE',expectedVersion});
  if(task.kind==='LEAVE')await command({action:'LEAVE',expectedVersion});
  if(task.kind==='TRANSFER')await command({action:'TRANSFER_OWNERSHIP',expectedVersion,userId:task.member.userId});
 }
 return <div>
  {notice?<p role="status" className={styles.feedback}><Text message={notice}/></p>:null}
  {error&&!task?<p role="alert" className="alert error"><FeedbackText message={error} fallback="The change could not be saved. Please try again."/></p>:null}
  <div className={styles.accountGrid}>
   <section className={styles.accountCard}>
    <div className={styles.sectionHeading}><h2><Building2 aria-hidden="true"/> <Text message="Workspace details"/></h2>{workspace.permissions.team?<button className="button secondary small" onClick={()=>setTask({kind:'DETAILS'})}><Pencil aria-hidden="true"/><Text message="Edit"/></button>:null}</div>
    <dl><div><dt><Text message="Account name"/></dt><dd>{workspace.name}</dd></div><div><dt><Text message="Handle"/></dt><dd>@{workspace.handle}</dd></div>{workspace.city?<div><dt><Text message="Office city"/></dt><dd>{workspace.city}</dd></div>:null}<div><dt><Text message="Your access"/></dt><dd><Text message={roleLabel(workspace.membershipRole)}/></dd></div></dl>
    <BusinessDocuments key={workspace.id+workspace.membershipRole} workspaceId={workspace.id} canManage={workspace.permissions.owner}/>
    <div className={styles.accountLinks}>{workspace.permissions.owner?<button type="button" className="button secondary small" onClick={()=>setTask({kind:'ARCHIVE'})}><Text message="Archive workspace"/></button>:<button type="button" className="button secondary small" onClick={()=>setTask({kind:'LEAVE'})}><Text message="Leave workspace"/></button>}</div>
   </section>
   <section className={styles.accountCard}>
    <div className={styles.sectionHeading}><h2><UserRound aria-hidden="true"/> <Text message="Your account"/></h2><button type="button" className="button secondary small" onClick={()=>setTask({kind:'PERSONAL'})}><Pencil aria-hidden="true"/><Text message="Edit your details"/></button></div><dl><div><dt><Text message="Name"/></dt><dd>{name}</dd></div><div><dt><Text message="Sign-in email"/></dt><dd>{email}</dd></div></dl>
    <div className={styles.accountLinks}><Link className="button secondary small" href="/app/support"><Headphones aria-hidden="true"/><Text message="Software support"/></Link></div>
    <div className={styles.accountLinks}><Link href="/privacy"><Text message="Privacy"/></Link><Link href="/delete-account"><Text message="Delete account and data"/></Link><form action="/api/auth/logout" method="post"><button type="submit" className="button secondary small"><Text message="Log out"/></button></form></div>
   </section>
  </div>
  <section className={`${styles.accountCard} ${styles.team}`}>
   <div className={styles.sectionHeading}><h2><Users aria-hidden="true"/> <Text message="Team"/></h2>{workspace.permissions.team?<button className="button small" onClick={()=>setTask({kind:'INVITE'})}><Plus aria-hidden="true"/><Text message="Invite teammate"/></button>:null}</div>
   <p><Text message="Capacity and Tracking access apply only to this workspace. Vehicle location needs the shipment owner's separate permission."/></p>
   {directory.members.map(member=><div key={member.userId} className={styles.member}><UserRound aria-hidden="true"/><div className={styles.memberMain}><strong>{member.erased?<Text message="Former team member"/>:member.firstName}{member.userId===workspace.actorId?<> · <Text message="You"/></>:null}</strong>{member.email?<small>{member.email}</small>:null}<div className={styles.memberAccess}>{member.capacity?<span><Text message="Capacity"/></span>:null}{member.tracking?<span><Text message="Tracking"/></span>:null}{!member.active&&!member.erased?<span><Text message="Suspended"/></span>:null}</div></div><span className={styles.role}><Text message={roleLabel(member.role)}/></span>{!member.erased&&workspace.permissions.team&&(workspace.permissions.owner||member.role==='STAFF')&&member.role!=='OWNER'&&member.userId!==workspace.actorId?<button type="button" className="button secondary small" onClick={()=>setTask({kind:'MEMBER',member})}><Text message="Manage"/></button>:null}</div>)}
   {workspace.permissions.team&&directory.invitations.length?<div className={styles.invite}><h3><Text message="Invitations"/></h3>{directory.invitations.map(invitation=><InvitationRow key={invitation.id} invitation={invitation} canManage={workspace.permissions.owner||invitation.role==='STAFF'} busy={busy} resend={()=>void command({action:'RESEND_INVITATION',invitationId:invitation.id})} revoke={()=>void command({action:'REVOKE_INVITATION',expectedVersion:workspace.version,invitationId:invitation.id})}/>)}</div>:null}
  </section>
  {task?.kind==='PERSONAL'?<dialog className={styles.dialog} ref={dialog} aria-labelledby="business-account-dialog-title" onCancel={event=>{event.preventDefault();setTask(null);}}><div className={styles.sectionHeading}><h2 id="business-account-dialog-title"><Text message="Your account"/></h2><button type="button" className="button secondary icon-button" aria-label="Close" onClick={()=>setTask(null)}><X aria-hidden="true"/></button></div><AccountDetailsForm name={name} firstName={firstName} lastName={lastName} phone={phone||null}/></dialog>:task?<dialog className={styles.dialog} ref={dialog} aria-labelledby="business-account-dialog-title" onCancel={event=>{event.preventDefault();if(!busy){setTask(null);setError('');}}}>
   <form onSubmit={event=>void submit(event)}>
    <div className={styles.sectionHeading}><h2 id="business-account-dialog-title"><Text message={task.kind==='DETAILS'?'Edit workspace details':task.kind==='INVITE'?'Invite teammate':task.kind==='MEMBER'?'Team member access':task.kind==='TRANSFER'?'Transfer ownership':task.kind==='LEAVE'?'Leave workspace':'Archive workspace'}/></h2><button className="button secondary icon-button" aria-label="Close" type="button" disabled={busy} onClick={()=>{setTask(null);setError('');}}><X aria-hidden="true"/></button></div>
    {task.kind==='DETAILS'?<><label><Text message="Account name"/><input name="name" defaultValue={workspace.name} minLength={2} maxLength={100} required/></label><label><Text message="Office city"/><input name="city" defaultValue={workspace.city||''} maxLength={100}/></label></>:null}
    {task.kind==='INVITE'?<label><Text message="Email address"/><input name="email" type="email" autoComplete="email" required maxLength={254}/></label>:null}
    {task.kind==='MEMBER'?<p>{task.member.firstName}{task.member.email?` · ${task.member.email}`:''}</p>:null}
    {task.kind==='INVITE'||task.kind==='MEMBER'?<><label><Text message="Role"/><select name="role" defaultValue={task.kind==='MEMBER'?task.member.role:'STAFF'}><option value="STAFF"><Text message="Team member"/></option>{workspace.permissions.owner?<option value="ADMIN"><Text message="Workspace admin"/></option>:null}</select></label><fieldset><legend><Text message="Workspace access"/></legend><label className={styles.checkbox}><input name="capacity" type="checkbox" defaultChecked={task.kind==='MEMBER'?task.member.capacity:true}/><Text message="View shared capacity"/></label><label className={styles.checkbox}><input name="tracking" type="checkbox" defaultChecked={task.kind==='MEMBER'?task.member.tracking:true}/><Text message="View shared shipments"/></label></fieldset></>:null}
    {task.kind==='MEMBER'?<><label className={styles.checkbox}><input name="active" type="checkbox" defaultChecked={task.member.active}/><Text message="Account access enabled"/></label><div className={styles.accountLinks}><button type="button" className="button secondary small" disabled={busy} onClick={()=>void command({action:'REMOVE_MEMBER',expectedVersion:workspace.version,userId:task.member.userId})}><Text message="Remove from team"/></button>{workspace.permissions.owner&&task.member.active?<button type="button" className="button secondary small" onClick={()=>setTask({kind:'TRANSFER',member:task.member})}><Text message="Transfer ownership"/></button>:null}</div></>:null}
    {task.kind==='ARCHIVE'?<p><Text message="This workspace will stop receiving shared capacity and shipments. Its team will lose workspace access. Existing history is retained."/></p>:null}
    {task.kind==='LEAVE'?<p><Text message="You will lose access to this workspace's shared capacity and shipments."/></p>:null}
    {task.kind==='TRANSFER'?<p><Text message="This teammate will become the workspace owner. You will remain a workspace admin."/> <strong>{task.member.firstName}</strong></p>:null}
    {error?<p className="alert error" role="alert"><FeedbackText message={error} fallback="The change could not be saved. Please try again."/></p>:null}
    <div className={styles.dialogActions}><button type="button" className="button secondary" disabled={busy} onClick={()=>{setTask(null);setError('');}}><Text message="Cancel"/></button><button className="button" disabled={busy}><Check aria-hidden="true"/><Text message={busy?'Saving…':task.kind==='INVITE'?'Send invitation':task.kind==='ARCHIVE'?'Archive workspace':task.kind==='LEAVE'?'Leave workspace':task.kind==='TRANSFER'?'Transfer ownership':'Save changes'}/></button></div>
   </form>
  </dialog>:null}
 </div>;
}
function InvitationRow({invitation,canManage,busy,resend,revoke}:{invitation:BusinessPendingInvitation;canManage:boolean;busy:boolean;resend:()=>void;revoke:()=>void}){
 return <div className={styles.member}><Mail aria-hidden="true"/><div className={styles.memberMain}><strong>{invitation.email}</strong><small><Text message={roleLabel(invitation.role)}/> · <Text message={invitation.status==='EXPIRED'?'Expired':'Waiting to join'}/></small><small><Text message={invitation.emailSentAt?'Invitation emailed':'Email delivery not confirmed'}/></small></div>{canManage&&invitation.status==='PENDING'?<button type="button" className="button secondary small" disabled={busy} onClick={resend}><Text message="Resend"/></button>:null}{canManage?<button type="button" className="button secondary small" disabled={busy} onClick={revoke}><Text message="Revoke"/></button>:null}</div>;
}
