import Link from 'next/link';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {
  ArrowLeft,Building2,KeyRound,LockKeyhole,Mail,Phone,RotateCcw,Send,Truck,UserRound
} from 'lucide-react';
import {PublicHeader} from '@/components/public-header';
import {Flash} from '@/components/flash';
import {managedWorkspaceDestination} from '@/lib/auth-flow.js';
import {getManagedCurrentUser} from '@/lib/identity/supabase';
import {
  MANAGED_SIGNUP_COOKIE,maskedProviderSignupEmail,readProviderSignupHandoff
} from '@/lib/provider-signup.js';
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
      identityProved=Boolean(data.user&&projection&&!projection.active);
    }catch{}
  }
  if(activeDestination)redirect(activeDestination);
  const detailsStep=query.step==='details'&&identityProved;
  const codeStep=query.step==='code'&&Boolean(handoff?.email)&&!identityProved;
  const selectedType=accountTypes.some(type=>type.value===query.type)?query.type:'TRANSPORT_COMPANY';

  return <><PublicHeader/><main className="public-app-page public-form-workspace"><div className="container public-form-container">
    <div className="auth-heading"><span className="task-heading-icon"><Building2 aria-hidden="true"/></span><div><h1 className="page-title">Create a transporter account</h1><p className="page-subtitle">{detailsStep?'Tell us how you operate. You can complete trucks, public contacts, and documents from your workspace.':'First, confirm the email you will use to access your transporter workspace.'}</p></div></div>
    <Flash error={query.error} success={query.success}/>
    {detailsStep?<ProviderDetailsForm selectedType={selectedType}/>:codeStep?<EmailCodeForm maskedEmail={maskedProviderSignupEmail(handoff?.email||'')}/>:<IdentityChoice/>}
    <Link className="auth-back" href="/"><ArrowLeft aria-hidden="true"/>Back to Truck Market</Link>
  </div></main></>;
}

function IdentityChoice(){
  return <section className="form-card managed-login-stack">
    <form action="/api/applications/google" method="post">
      <button className="button secondary auth-google-button" type="submit"><span className="auth-google-mark" aria-hidden="true">G</span>Continue with Google</button>
    </form>
    <div className="auth-divider"><span>or use email</span></div>
    <form action="/api/applications/email-otp/request" method="post" className="stack" data-testid="signup-email-code-request-form">
      <div className="form-group"><label htmlFor="signup-email"><Mail aria-hidden="true"/>Account email</label><input id="signup-email" name="email" type="email" autoComplete="email" required/><small>We will email a six-digit code. No password is needed.</small></div>
      <button className="button" type="submit"><Send aria-hidden="true"/>Email me a code</button>
    </form>
    <p className="auth-privacy-note"><LockKeyhole aria-hidden="true"/>Your account email stays private. Add public contact details later if you choose.</p>
    <p className="auth-signup"><span>Already have an account?</span><Link className="button secondary" href="/login">Transporter login</Link></p>
  </section>;
}

function EmailCodeForm({maskedEmail}:{maskedEmail:string}){
  return <form action="/api/applications/email-otp/verify" method="post" className="form-card stack" data-testid="signup-email-code-form">
    <div><span className="section-kicker"><Mail aria-hidden="true"/>Check your email</span><h2>Enter your six-digit code</h2><p className="meta">Sent to {maskedEmail}. The code and this signup step expire after 15 minutes.</p></div>
    <div className="form-group"><label htmlFor="signup-code"><KeyRound aria-hidden="true"/>Email code</label><input id="signup-code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required/></div>
    <button className="button" type="submit"><KeyRound aria-hidden="true"/>Confirm email</button>
    <Link className="auth-inline-link" href="/apply"><RotateCcw aria-hidden="true"/>Use a different email</Link>
  </form>;
}

function ProviderDetailsForm({selectedType}:{selectedType:string|undefined}){
  return <form action="/api/applications" method="post" className="form-card stack" data-testid="provider-details-form">
    <fieldset>
      <legend>How do you operate?</legend>
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
      <div className="form-group"><label htmlFor="applicant-name"><UserRound aria-hidden="true"/>Your name</label><input id="applicant-name" name="name" autoComplete="name" required/></div>
      <div className="form-group"><label htmlFor="workspace-name"><Building2 aria-hidden="true"/>Transporter name</label><input id="workspace-name" name="businessName" autoComplete="organization" required/></div>
      <div className="form-group"><label htmlFor="application-phone"><Phone aria-hidden="true"/>Account phone</label><input id="application-phone" name="phone" type="tel" autoComplete="tel" required/><div className="meta">Private. Add a public phone later.</div></div>
      <div className="form-group full"><label htmlFor="application-note"><Truck aria-hidden="true"/>About your transport work <span className="meta">(optional)</span></label><textarea id="application-note" name="notes" maxLength={1000}/></div>
    </div>
    <button className="button" type="submit"><Building2 aria-hidden="true"/>Create transporter workspace</button>
    <p className="meta">Creating an account does not mark documents as reviewed. Add trucks and submit current documents from your workspace.</p>
  </form>;
}
