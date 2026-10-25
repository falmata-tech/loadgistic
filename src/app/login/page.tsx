
import {Text,Localized} from '@/components/localization';
import Link from 'next/link';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {KeyRound, LockKeyhole, LogIn, Mail, RotateCcw, Send} from 'lucide-react';
import {PublicAuthShell} from '@/components/public-auth-shell';
import {PublicHeader} from '@/components/public-header';
import {Flash} from '@/components/flash';
import {getCurrentUser} from '@/lib/auth';
import {signupEntry} from '@/lib/signup-audience.js';
import {localAuthInboxUrl,localFixturePasswordLoginEnabled,managedWorkspaceDestination} from '@/lib/auth-flow.js';
import {
  MANAGED_SIGNUP_COOKIE,maskedProviderSignupEmail,readProviderSignupHandoff
} from '@/lib/provider-signup.js';

export default async function LoginPage({
  searchParams
}:{
  searchParams:Promise<Record<string,string|undefined>>;
}){
  const user=await getCurrentUser();
  if(user?.active)redirect(managedWorkspaceDestination(user.role,user.selected_business_workspace));
  const query=await searchParams;
  const store=await cookies();
  const handoff=readProviderSignupHandoff(store.get(MANAGED_SIGNUP_COOKIE)?.value||'');
  const codeStep=query.step==='code'&&Boolean(handoff?.email);
  const localInbox=localAuthInboxUrl();
  const fixturePassword=localFixturePasswordLoginEnabled();
  const from=signupEntry(query.from);
  const sharedEntry=Boolean(from);

  return <>
    <PublicHeader/>
    <PublicAuthShell
      variant="login"
      taskKicker={<Text message={sharedEntry?'Shared with you':'Account'}/>}
      title={codeStep?'Enter your code':'Sign in'}
      description={codeStep
        ?<Text message="We sent a six-digit code to {email}." values={{email:maskedProviderSignupEmail(handoff?.email||'')}}/>
        :<Text message={sharedEntry?'Sign in to see vehicles shared with your account.':'Enter your email to sign in securely.'}/>}
      feedback={<Flash error={query.error} success={query.success}/>}
    >
      <div className="managed-login-stack">
        {codeStep?<EmailCodeForm localInbox={localInbox} from={from}/>:<EmailRequestForm localInbox={localInbox} from={from}/>}
      </div>
      <p className="auth-switch-link"><Text message="Don't have an account? "/><Link href="/signup"><Text message="Sign up"/></Link></p>
      {fixturePassword?<LocalFixtureLogin/>:null}
      <p className="auth-driver-hint"><Text message="Added by your company? Use the email your fleet owner registered for you."/></p>
      <p className="auth-privacy-note"><LockKeyhole aria-hidden="true"/><Text message="Your login email stays private."/></p>
    </PublicAuthShell>
  </>;
}

function EmailRequestForm({localInbox,from}:{localInbox:string|null;from:string}){
  const helpId='account-email-help';
  return <form action="/api/applications/email-otp/request" method="post" className="stack auth-primary-form" data-testid="email-code-request-form">
    {from?<input type="hidden" name="from" value={from}/>:null}
    <input type="hidden" name="audience" value="EXISTING"/>
    <div className="form-group">
      <label htmlFor="account-email"><Mail aria-hidden="true"/><Text message="Email"/></label>
      <input id="account-email" name="email" type="email" autoComplete="email" aria-describedby={helpId} required/>
      <small id={helpId}><Text message="No password needed."/></small>
    </div>
    <button className="button auth-primary-action" type="submit"><Send aria-hidden="true"/><Text message="Email me a code"/></button>
    {localInbox?<LocalInboxLink url={localInbox}/>:null}
  </form>;
}

function EmailCodeForm({localInbox,from}:{localInbox:string|null;from:string}){
  const helpId='account-code-help';
  return <form action="/api/applications/email-otp/verify" method="post" className="stack auth-primary-form" data-testid="email-code-form">
    <input type="hidden" name="audience" value="EXISTING"/>{from?<input type="hidden" name="from" value={from}/>:null}
    <div className="form-group">
      <label htmlFor="account-code"><KeyRound aria-hidden="true"/><Text message="Six-digit code"/></label>
      <input id="account-code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} aria-describedby={helpId} required/>
      <small id={helpId}><Text message="Codes expire after ten minutes and can be used once."/></small>
    </div>
    <button className="button auth-primary-action" type="submit"><LogIn aria-hidden="true"/><Text message="Continue"/></button>
    <Link className="auth-inline-link" href="/login"><RotateCcw aria-hidden="true"/><Text message="Use a different email"/></Link>
    {localInbox?<LocalInboxLink url={localInbox}/>:null}
  </form>;
}

function LocalInboxLink({url}:{url:string}){
  return <Localized as="a" copy={["aria-label"]} className="auth-inline-link auth-local-inbox" href={url} target="_blank" rel="noreferrer" aria-label="Open the local email inbox in a new tab"><Text message="Local testing: open the email inbox "/><span aria-hidden="true">↗</span></Localized>;
}

function LocalFixtureLogin(){
  return <details className="auth-fixture-login">
    <summary><Text message="Local test accounts"/></summary>
    <form action="/api/auth/login" method="post" className="stack" data-testid="login-form">
      <div className="form-group"><label htmlFor="fixture-email"><Mail aria-hidden="true"/><Text message="Email"/></label><input id="fixture-email" name="email" type="email" autoComplete="email" required/></div>
      <div className="form-group"><label htmlFor="fixture-password"><LockKeyhole aria-hidden="true"/><Text message="Password"/></label><input id="fixture-password" name="password" type="password" autoComplete="current-password" required/></div>
      <button className="button secondary" type="submit"><LogIn aria-hidden="true"/><Text message="Log in"/></button>
    </form>
  </details>;
}
