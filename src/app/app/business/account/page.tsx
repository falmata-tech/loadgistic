import businessStyles from '@/components/business-workspace.module.css';
import {Building2} from 'lucide-react';
import {PageHeader} from '@/components/page-header';
import {AccountSecurityControls} from '@/components/account-security-controls';
import {accountDeactivationBlockers} from '@/lib/identity/account-security';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {BusinessAccount} from '@/components/business-account';
import {Text} from '@/components/localization';
import {requireBusinessWorkspace} from '@/lib/identity/require-business';
import {businessWorkspaceService} from '@/lib/business-workspaces/application';
import {supabaseBusinessWorkspacePort} from '@/lib/business-workspaces/supabase';
export const dynamic='force-dynamic';
export default async function BusinessAccountPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const {user,workspace}=await requireBusinessWorkspace(),query=await searchParams;
 const client=await createSupabaseServerClient(),auth=await client.auth.getUser();
 let blockers:string[]=[],securityAvailable=true;try{blockers=await accountDeactivationBlockers(user.id);}catch{securityAvailable=false;}
 const directory=await businessWorkspaceService(supabaseBusinessWorkspacePort()).directory(user.id,workspace.id);
 return <div className="page"><PageHeader icon={Building2} title={<Text message="Account"/>} subtitle={workspace.name}/>{query.access==='restricted'?<p role="status" className="alert"><Text message="Your team access does not include that page. Contact your workspace admin."/></p>:null}<BusinessAccount key={`${user.id}:${workspace.id}:${workspace.membershipRevision}`} initial={directory} name={user.name} firstName={user.firstName||undefined} lastName={user.lastName||''} phone={user.phone} email={user.email}/><div className={businessStyles.securityCard} style={{marginTop:24}}><AccountSecurityControls blockers={blockers} available={securityAvailable} pendingEmail={auth.data.user?.new_email||''}/></div></div>;
}
