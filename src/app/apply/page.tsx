
import {Text} from '@/components/localization';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {Building2, Phone, Truck, UserRound} from 'lucide-react';
import {PublicAuthShell} from '@/components/public-auth-shell';
import {PublicHeader} from '@/components/public-header';
import {Flash} from '@/components/flash';
import {managedWorkspaceDestination} from '@/lib/auth-flow.js';
import {getManagedCurrentUser} from '@/lib/identity/supabase';
import {managedProviderSignupEligible,MANAGED_SIGNUP_COOKIE,readProviderSignupHandoff} from '@/lib/provider-signup.js';
import {createSupabaseServerClient} from '@/lib/supabase/server';

const accountTypes=[
  {
    value:'TRANSPORT_COMPANY',title:'Fleet transporter',
    hint:'A transport company or fleet with its own trucks and company Drivers.',icon:Building2
  },
  {
    value:'OWNER_OPERATOR',title:'Owner-operator',
    hint:'You drive and manage a truck you own.',icon:Truck
  },
  {
    value:'SELF_MANAGED_DRIVER',title:'Self-managed driver',
    hint:'You operate another owner’s truck with authorization.',icon:UserRound
  }
];

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
  if(handoff){
    try{
      const client=await createSupabaseServerClient();
      const {data,error}=await client.auth.getUser();
      const projection=!error&&data.user?await getManagedCurrentUser(client,data.user):null;
      if(projection?.active)activeDestination=managedWorkspaceDestination(projection.role);
      const authenticatedEmail=String(data.user?.email||'').trim().toLowerCase();
      identityProved=Boolean(data.user&&projection&&!projection.active
        &&(!handoff.email||authenticatedEmail===handoff.email)
        &&await managedProviderSignupEligible(data.user.id));
    }catch{}
  }
  if(activeDestination)redirect(activeDestination);
  if(!identityProved){
    redirect(handoff?.email?'/login?step=code':'/login');
  }
  const selectedType=accountTypes.some(type=>type.value===query.type)?query.type:'TRANSPORT_COMPANY';

  return <>
    <PublicHeader/>
    <PublicAuthShell
      variant="signup"
      taskKicker={<Text message="Transporter setup"/>}
      title={<Text message="Set up your transporter workspace"/>}
      description={<Text message="Tell us how you operate. Add trucks, public contacts, and documents from your workspace next."/>}
      contextKicker={<Text message="Build your presence"/>}
      contextTitle={<Text message="Share capacity. Grow your transport business."/>}
      contextDescription={<Text message="Connect with brokers and businesses, share truck availability, and keep customers informed through private Tracking."/>}
      contextNoteTitle={<Text message="Identity confirmed"/>}
      contextNote={<Text message="Your account remains inactive until this short transporter setup is complete."/>}
      footerNote={<Text message="Creating an account does not mark any Driver, truck, or document as reviewed."/>}
      feedback={<Flash error={query.error} success={query.success}/>}
    >
      <ProviderDetailsForm selectedType={selectedType}/>
    </PublicAuthShell>
  </>;
}

function ProviderDetailsForm({selectedType}:{selectedType:string|undefined}){
  return <form action="/api/applications" method="post" className="form-card stack provider-setup-form" data-testid="provider-details-form">
    <fieldset>
      <legend><Text message="How do you operate?"/></legend>
      <div className="signup-role-grid">
        {accountTypes.map(type=>{
          const Icon=type.icon;
          return <label className="signup-role" key={type.value}>
            <input type="radio" name="applicationType" value={type.value} defaultChecked={selectedType===type.value} required/>
            <Icon aria-hidden="true"/><strong>{type.title}</strong><span>{type.hint}</span>
          </label>;
        })}
      </div>
    </fieldset>
    <div className="form-grid">
      <div className="form-group"><label htmlFor="applicant-name"><UserRound aria-hidden="true"/><Text message="Your name"/></label><input id="applicant-name" name="name" autoComplete="name" required/></div>
      <div className="form-group"><label htmlFor="workspace-name"><Building2 aria-hidden="true"/><Text message="Transporter name"/></label><input id="workspace-name" name="businessName" autoComplete="organization" required/></div>
      <div className="form-group"><label htmlFor="application-phone"><Phone aria-hidden="true"/><Text message="Account phone"/></label><input id="application-phone" name="phone" type="tel" autoComplete="tel" aria-describedby="application-phone-help" required/><small id="application-phone-help"><Text message="Private. Add a public phone later if you choose."/></small></div>
      <div className="form-group full"><label htmlFor="application-note"><Truck aria-hidden="true"/><Text message="About your transport work "/><span className="meta"><Text message="(optional)"/></span></label><textarea id="application-note" name="notes" maxLength={1000} aria-describedby="application-note-help"/><small id="application-note-help"><Text message="Briefly describe the transport services you plan to offer."/></small></div>
    </div>
    <button className="button auth-primary-action" type="submit"><Building2 aria-hidden="true"/><Text message="Create transporter workspace"/></button>
  </form>;
}
