import Link from 'next/link';
import {UserRound, ShieldCheck, FileCheck2, Building2, Camera} from 'lucide-react';
import {LogoutButton} from '@/components/logout-button';
import {ProviderProfileWorkspace} from '@/components/provider-profile-workspace';
import {SubjectDocuments} from '@/components/subject-documents';
import {getVerificationCenter} from '@/lib/verification.js';
import {Text,Localized} from '@/components/localization';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {AccountSecurityControls} from '@/components/account-security-controls';
import {AccountDeletionForm} from '@/components/account-deletion-form';
import {accountDeactivationBlockers} from '@/lib/identity/account-security';
import {requireUser} from '@/lib/auth';
import {getWorkspaceAccess} from '@/lib/workspace.js';
import {PageHeader} from '@/components/page-header';
import {Flash} from '@/components/flash';
import {AccountDetailsForm} from '@/components/account-details-form';
import {DriverPortraitEditor} from '@/components/driver-portrait-editor';
import {getDriverPortraitWorkspace} from '@/lib/driver-portrait-storage.js';
import {providerWorkspaceCapabilities} from '@/lib/provider-workspace.js';
import {WorkspaceTaskDialog} from '@/components/workspace-task-dialog';
import styles from '@/components/account-workspace.module.css';

const roleLabels:Record<string,string>={TRANSPORTER:'Transport Provider',DRIVER:'Transport Provider',ADMIN:'Platform administrator'};
function accountRoleLabel(user:Awaited<ReturnType<typeof requireUser>>){
  return user.provider_operating_model==='COMPANY_DRIVER'?'Company driver':roleLabels[user.role]||user.role;
}
function Fact({label,children}:{label:string;children:React.ReactNode}){
  return <div className={styles.fact}><dt><Text message={label}/></dt><dd>{children||<Text message="Not set"/>}</dd></div>;
}
export default async function AccountPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requireUser(undefined,{allowLimited:true}),query=await searchParams;
  const access=await getWorkspaceAccess(user),capabilities=providerWorkspaceCapabilities(user);
  const ownsProfile=access.granted&&capabilities.ownsProviderAccount,member=['TRANSPORTER','DRIVER'].includes(user.role);
  const tabs=[{id:'details',label:'Account details',Icon:UserRound},...(ownsProfile?[{id:'profile',label:'Transporter profile',Icon:Building2}]:[]),...(access.granted&&member?[{id:'documents',label:'Documents',Icon:FileCheck2}]:[]),...(member?[{id:'security',label:'Email and account security',Icon:ShieldCheck}]:[])];
  const tab=tabs.some(item=>item.id===query.tab)?query.tab!:'details';
  // Opening Account should not wait for every document, portrait and closure query.
  const [portrait,documents,pendingEmail,security]=await Promise.all([
    tab==='details'&&capabilities.drivesTruck?getDriverPortraitWorkspace(user):null,
    tab==='documents'?getVerificationCenter(user):null,
    tab==='security'?(async()=>((await (await createSupabaseServerClient()).auth.getUser()).data.user?.new_email||undefined))():undefined,
    tab==='security'?accountDeactivationBlockers(user.id).then(blockers=>({available:true,blockers})).catch(()=>({available:false,blockers:[]})):null
  ]);
  const ownDriverSubject=documents?.subjects.find((subject:{subject_type:string;subject_id:string})=>subject.subject_type==='DRIVER'&&subject.subject_id===user.id);
  const ownerSubject=ownsProfile?documents?.subjects.find((subject:{subject_type:string})=>subject.subject_type===(user.organization_id?'ORGANIZATION':'PROVIDER_PROFILE')):null;
  return <div className={`page ${styles.page}`}><PageHeader icon={UserRound} title={<Text message="Account"/>}/><Flash error={query.error} success={query.success}/>
    <Localized as="nav" copy={['aria-label']} className={styles.tabs} aria-label="Account sections">{tabs.map(({id,label,Icon})=><Link key={id} href={`/app/more?tab=${id}`} aria-current={tab===id?'page':undefined} className={tab===id?styles.active:''}><Icon aria-hidden="true"/><Text message={label}/></Link>)}</Localized>
    {tab==='details'?<section className={styles.surface}><header className={styles.heading}><div><h2>{user.name}</h2><p><Text message={accountRoleLabel(user)}/></p></div><WorkspaceTaskDialog title="Account details" triggerLabel="Edit details"><AccountDetailsForm name={user.name} firstName={user.firstName??undefined} lastName={user.lastName??''} phone={user.phone} publicCallbackPhone={user.publicCallbackPhone??''} canEditPublicContact={capabilities.drivesTruck}/></WorkspaceTaskDialog></header>
      <dl className={styles.facts}><Fact label="First name">{user.firstName||user.name.split(/\s+/)[0]}</Fact><Fact label="Last / father name">{user.lastName}</Fact><Fact label="Account email">{user.email}</Fact><Fact label="Account phone">{user.phone}</Fact>{capabilities.drivesTruck?<Fact label="Public contact phone">{user.publicCallbackPhone}</Fact>:null}</dl><p className={styles.note}><Text message="Your login email stays private."/></p>
      {capabilities.canManageFleet?<div className={styles.relatedRow}><div><strong><Text message="I drive a vehicle"/></strong><p><Text message={capabilities.drivesTruck?'Yes':'No'}/></p></div><WorkspaceTaskDialog title="I drive a vehicle" triggerLabel="Change"><form action="/api/account/driving-mode" method="post" className="stack"><div className="form-group"><label htmlFor="owner-driving-mode"><Text message="I drive a vehicle"/></label><select id="owner-driving-mode" name="drivesTruck" defaultValue={capabilities.drivesTruck?'1':'0'}><option value="1"><Text message="Yes"/></option><option value="0"><Text message="No"/></option></select><small><Text message="Keep my driving controls on Home."/></small></div><button className="button"><Text message="Save"/></button></form></WorkspaceTaskDialog></div>:null}
      {portrait?<div className={styles.relatedRow}><div><strong><Text message="Driver photo"/></strong><p><Text message={portrait.hasPortrait?'Your driver photo':'No photo yet'}/></p></div><WorkspaceTaskDialog title="Driver photo" triggerLabel="Change photo" icon={<Camera aria-hidden="true"/>}><DriverPortraitEditor portrait={portrait}/></WorkspaceTaskDialog></div>:null}
    </section>:null}
    {tab==='profile'&&ownsProfile?<ProviderProfileWorkspace user={user} embedded/>:null}
    {tab==='documents'?<div className={styles.documentSections} id="documents">{ownDriverSubject?<section className={styles.surface}><h2><Text message="Driver documents"/></h2><SubjectDocuments readOnly center={documents} kind="DRIVER" id={user.id} returnTo="/app/more?tab=documents#documents"/></section>:null}{ownerSubject?<section className={styles.surface}><h2><Text message={user.organization_id?'Workspace documents':'Owner documents'}/></h2><SubjectDocuments readOnly center={documents} kind={ownerSubject.subject_type} id={ownerSubject.subject_id} returnTo="/app/more?tab=documents#documents"/></section>:null}</div>:null}
    {tab==='security'&&security?<section className={styles.surface} id="security"><AccountSecurityControls {...security} pendingEmail={pendingEmail}/><div className={styles.relatedRow}><div><strong><Text message="Delete account and data"/></strong></div><WorkspaceTaskDialog title="Delete account and data" triggerLabel="Delete account and data" variant="danger"><AccountDeletionForm initialEmail={user.email} showHeading={false}/></WorkspaceTaskDialog></div></section>:null}
    <div className={styles.signOut}><LogoutButton/></div>
  </div>;
}
