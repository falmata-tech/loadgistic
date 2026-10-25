import {PublicHeader} from '@/components/public-header';
import {BusinessWorkspaceChoice} from '@/components/business-workspace-choice';
import {ContentPolicyConsent} from '@/components/content-policy-consent';
import {workspaceChoiceIdentity} from '@/lib/identity/workspace-choice';
import {managedProviderSignupEligible} from '@/lib/provider-signup.js';
import {Text} from '@/components/localization';
export const dynamic='force-dynamic';
export const metadata={title:'Your workspaces | Loadgistic',robots:{index:false,follow:false}};
export default async function WorkspaceChoicePage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const query=await searchParams;
 const user=await workspaceChoiceIdentity();
 return <><PublicHeader/><main className="page container" style={{maxWidth:950,paddingBottom:100}}><header className="page-header"><div><h1 className="page-title"><Text message="Your workspaces"/></h1><p className="page-subtitle"><Text message="Choose where you want to work."/></p></div></header><BusinessWorkspaceChoice workspaces={user.business_workspaces||[]} invitations={user.business_invitations||[]} providerAvailable={Boolean(user.provider_workspace_available)} canCreateProvider={await managedProviderSignupEligible(user.id)} startBusiness={query.start==='business'}/><ContentPolicyConsent actorId={user.id}/></main></>;
}
