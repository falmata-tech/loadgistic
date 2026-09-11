import Link from 'next/link';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {KeyRound, LockKeyhole, LogIn, Mail, RotateCcw, Send} from 'lucide-react';
import {PublicAuthShell} from '@/components/public-auth-shell';
import {PublicHeader} from '@/components/public-header';
import {Flash} from '@/components/flash';
import {getCurrentUser} from '@/lib/auth';
import {localAuthInboxUrl,localFixturePasswordLoginEnabled} from '@/lib/auth-flow.js';
import {
  MANAGED_SIGNUP_COOKIE,maskedProviderSignupEmail,readProviderSignupHandoff
} from '@/lib/provider-signup.js';

export default async function LoginPage({
  searchParams
}:{
  searchParams:Promise<Record<string,string|undefined>>;
}){
  const user=await getCurrentUser();
  if(user)redirect(user.role==='SUPPORT'?'/support':'/app/home');
  const query=await searchParams;
  const store=await cookies();
  const handoff=readProviderSignupHandoff(store.get(MANAGED_SIGNUP_COOKIE)?.value||'');
  const codeStep=query.step==='code'&&Boolean(handoff?.email);
  const localInbox=localAuthInboxUrl();
  const fixturePassword=localFixturePasswordLoginEnabled();

  return <>
    <PublicHeader/>
    <PublicAuthShell
      variant="login"
      taskKicker="Account"
      title={codeStep?'Enter your code':'Log in'}
      description={codeStep
        ?`We sent a six-digit code to ${maskedProviderSignupEmail(handoff?.email||'')}.`
        :'Use a one-time email code or Google.'}
      contextKicker="Loadgistic"
      contextTitle="Share capacity. Track agreed shipments."
      contextDescription="One account for self-managed drivers, owner-operators, and fleet transporters."
      feedback={<Flash error={query.error} success={query.success}/>}
    >
      <div className="managed-login-stack">
        {codeStep?<EmailCodeForm localInbox={localInbox}/>:<EmailRequestForm localInbox={localInbox}/>}
        <div className="auth-divider"><span>or</span></div>
        <form action="/api/applications/google" method="post">
          <button className="button secondary auth-google-button" type="submit"><span className="auth-google-mark" aria-hidden="true">G</span>Continue with Google</button>
        </form>
      </div>
      {fixturePassword?<LocalFixtureLogin/>:null}
      <p className="auth-privacy-note"><LockKeyhole aria-hidden="true"/>Your login email stays private.</p>
    </PublicAuthShell>
  </>;
}

function EmailRequestForm({localInbox}:{localInbox:string|null}){
  const helpId='account-email-help';
  return <form action="/api/applications/email-otp/request" method="post" className="stack auth-primary-form" data-testid="email-code-request-form">
    <div className="form-group">
      <label htmlFor="account-email"><Mail aria-hidden="true"/>Email</label>
      <input id="account-email" name="email" type="email" autoComplete="email" aria-describedby={helpId} required/>
      <small id={helpId}>We will email a six-digit code. No password is needed.</small>
    </div>
    <button className="button auth-primary-action" type="submit"><Send aria-hidden="true"/>Email me a code</button>
    {localInbox?<LocalInboxLink url={localInbox}/>:null}
  </form>;
}

function EmailCodeForm({localInbox}:{localInbox:string|null}){
  const helpId='account-code-help';
  return <form action="/api/applications/email-otp/verify" method="post" className="stack auth-primary-form" data-testid="email-code-form">
    <div className="form-group">
      <label htmlFor="account-code"><KeyRound aria-hidden="true"/>Six-digit code</label>
      <input id="account-code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} aria-describedby={helpId} required/>
      <small id={helpId}>Codes expire after ten minutes and can be used once.</small>
    </div>
    <button className="button auth-primary-action" type="submit"><LogIn aria-hidden="true"/>Continue</button>
    <Link className="auth-inline-link" href="/login"><RotateCcw aria-hidden="true"/>Use a different email</Link>
    {localInbox?<LocalInboxLink url={localInbox}/>:null}
  </form>;
}

function LocalInboxLink({url}:{url:string}){
  return <a className="auth-inline-link auth-local-inbox" href={url} target="_blank" rel="noreferrer" aria-label="Open the local email inbox in a new tab">Local testing: open the email inbox <span aria-hidden="true">↗</span></a>;
}

function LocalFixtureLogin(){
  return <details className="auth-fixture-login">
    <summary>Local test accounts</summary>
    <form action="/api/auth/login" method="post" className="stack" data-testid="login-form">
      <div className="form-group"><label htmlFor="fixture-email"><Mail aria-hidden="true"/>Email</label><input id="fixture-email" name="email" type="email" autoComplete="email" required/></div>
      <div className="form-group"><label htmlFor="fixture-password"><LockKeyhole aria-hidden="true"/>Password</label><input id="fixture-password" name="password" type="password" autoComplete="current-password" required/></div>
      <button className="button secondary" type="submit"><LogIn aria-hidden="true"/>Log in</button>
    </form>
  </details>;
}
