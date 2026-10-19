
import {ContentPolicyConsent} from '@/components/content-policy-consent';
import {Text} from '@/components/localization';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {ProviderSignupDetailsForm} from '@/components/provider-signup-details-form';
import {PublicAuthShell} from '@/components/public-auth-shell';
import {PublicHeader} from '@/components/public-header';
import {Flash} from '@/components/flash';
import {managedWorkspaceDestination} from '@/lib/auth-flow.js';
import {getManagedCurrentUser} from '@/lib/identity/supabase';
import {managedProviderSignupEligible,MANAGED_SIGNUP_COOKIE,readProviderSignupHandoff} from '@/lib/provider-signup.js';
import {createSupabaseServerClient} from '@/lib/supabase/server';

export default async function ApplyPage({
  searchParams
}:{
  searchParams:Promise<Record<string,string|undefined>>;
}){
  const query=await searchParams;
  const store=await cookies();
  const handoff=readProviderSignupHandoff(store.get(MANAGED_SIGNUP_COOKIE)?.value||'');
  let identityProved=false;
  let activeDestination='';
  let identityId='';
  if(handoff){
    try{
      const client=await createSupabaseServerClient();
      const {data,error}=await client.auth.getUser();
      const projection=!error&&data.user?await getManagedCurrentUser(client,data.user):null;
      const eligible=Boolean(data.user&&await managedProviderSignupEligible(data.user.id));
      if(projection?.active&&!eligible)activeDestination=managedWorkspaceDestination(projection.role);
      if(projection&&data.user)identityId=data.user.id;
      const authenticatedEmail=String(data.user?.email||'').trim().toLowerCase();
      identityProved=Boolean(data.user&&projection&&eligible
        &&(!handoff.email||authenticatedEmail===handoff.email)
        );
    }catch{}
  }
  if(activeDestination)redirect(activeDestination);
  if(!identityProved){
    redirect(handoff?.email?'/login?step=code':'/login');
  }

  return <>
    <PublicHeader/>
    <PublicAuthShell
      variant="signup"
      taskKicker={<Text message="Transporter setup"/>}
      title={<Text message="Set up your transporter workspace"/>}
      description={<Text message="Add vehicles and drivers from your workspace."/>}
      contextKicker={<Text message="Build your presence"/>}
      contextTitle={<Text message="Share capacity. Grow your transport business."/>}
      contextDescription={<Text message="Connect with brokers and businesses, share vehicle availability, and keep customers informed through private Tracking."/>}
      contextNoteTitle={<Text message="Identity confirmed"/>}
      contextNote={<Text message="Your account remains inactive until this short transporter setup is complete."/>}
      footerNote={<Text message="Creating an account does not mark any Driver, vehicle, or document as reviewed."/>}
      feedback={<Flash error={query.error} success={query.success}/>}
    >
      <ProviderSignupDetailsForm/>
      <ContentPolicyConsent actorId={identityId}/>
    </PublicAuthShell>
  </>;
}
