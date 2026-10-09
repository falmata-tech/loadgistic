import {LogoutButton} from '@/components/logout-button';
import {ProviderProfileWorkspace} from '@/components/provider-profile-workspace';
import {SubjectDocuments} from '@/components/subject-documents';
import {getVerificationCenter} from '@/lib/verification.js';

import {Text} from '@/components/localization';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {AccountSecurityControls} from '@/components/account-security-controls';
import {accountDeactivationBlockers} from '@/lib/identity/account-security';
import { requireUser } from '@/lib/auth';
import { getWorkspaceAccess } from '@/lib/workspace.js';
import { PageHeader } from '@/components/page-header';
import { Flash } from '@/components/flash';
import { UserRound } from 'lucide-react';
import { AccountDetailsForm } from '@/components/account-details-form';
import { DriverPortraitEditor } from '@/components/driver-portrait-editor';
import { getDriverPortraitWorkspace } from '@/lib/driver-portrait-storage.js';

const roleLabels:Record<string,string>={TRANSPORTER:'Fleet transporter',DRIVER:'Independent driver',ADMIN:'Platform administrator'};

function accountRoleLabel(user:any){
  if(user.provider_operating_model==='COMPANY_DRIVER')return `Company driver · ${user.organization_name}`;
  if(['OWNER_OPERATOR','SELF_MANAGED_DRIVER'].includes(user.provider_operating_model))return 'Independent driver';
  return roleLabels[user.role]||user.role;
}

export default async function AccountPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const user=await requireUser(undefined,{allowLimited:true});
  const query=await searchParams;
  const access=await getWorkspaceAccess(user);
  const portrait=user.role==='DRIVER'?await getDriverPortraitWorkspace(user):null;
  const documents=access.granted&&user.role==='DRIVER'?await getVerificationCenter(user):null;
  const ownsProfile=access.granted&&['TRANSPORTER','DRIVER'].includes(user.role)&&user.driver_kind!=='COMPANY';
  const pendingEmail=(await (await createSupabaseServerClient()).auth.getUser()).data.user?.new_email||undefined;
  const security=['TRANSPORTER','DRIVER'].includes(user.role)?await accountDeactivationBlockers(user.id).then(blockers=>({available:true,blockers})).catch(()=>({available:false,blockers:[]})):null;

  return <div className="page account-page"><PageHeader icon={UserRound} title={<Text message="Account"/>} subtitle={<Text message="Your details, profile and security."/>}/><Flash error={query.error} success={query.success}/><div className="account-layout"><div className="stack account-primary-stack">
    <section className="card account-private-card"><h2 className="panel-heading"><UserRound aria-hidden="true"/><Text message="Account details"/></h2><p className="meta">{user.email}<br/>{accountRoleLabel(user)}</p><p className="meta"><Text message="Your login email stays private."/></p><AccountDetailsForm name={user.name} phone={user.phone}/>
    {portrait?<details className="workspace-related-section"><summary><Text message="Driver photo"/></summary><DriverPortraitEditor portrait={portrait}/></details>:null}
    {documents?.subjects.some((subject:{subject_type:string})=>subject.subject_type==='DRIVER')?<details className="workspace-related-section" id="documents" open={Boolean(query.success||query.error)}><summary><Text message="Driver documents"/></summary>{documents.subjects.filter((subject:{subject_type:string})=>subject.subject_type==='DRIVER').map((subject:{subject_type:string;subject_id:string})=><SubjectDocuments key={subject.subject_id} center={documents} kind={subject.subject_type} id={subject.subject_id} returnTo="/app/more#documents"/>)}</details>:null}
    </section>
    {security?<details className="workspace-related-section" id="security"><summary><Text message="Email and account security"/></summary><AccountSecurityControls {...security} pendingEmail={pendingEmail}/></details>:null}
    {ownsProfile?<details className="workspace-related-section" id="business" open={Boolean(query.success||query.error)}><summary><Text message="Transporter profile"/></summary><ProviderProfileWorkspace user={user} embedded/></details>:null}
  </div></div><div className="workspace-signout"><LogoutButton/></div></div>;
}
