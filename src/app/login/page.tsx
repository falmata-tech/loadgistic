import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, CirclePlus, KeyRound, LockKeyhole, LogIn, Mail, RotateCcw, Send } from 'lucide-react';
import { PublicHeader } from '@/components/public-header';
import { Flash } from '@/components/flash';
import { getCurrentUser } from '@/lib/auth';
import { localFixturePasswordLoginEnabled } from '@/lib/auth-flow.js';
import { usesSupabaseAuth } from '@/lib/supabase/config';

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string,string | undefined>> }) {
  const user=await getCurrentUser();
  if (user) redirect(user.role==='SUPPORT'?'/support':'/app/home');
  const query = await searchParams;
  const managed=usesSupabaseAuth();
  const fixturePassword=localFixturePasswordLoginEnabled();
  const codeStep=managed&&query.step==='code';
  return <><PublicHeader/><main className="public-app-page public-form-workspace"><div className="container auth-shell public-form-container">
    <section className="form-card">
      <div className="auth-heading"><span className="task-heading-icon"><LogIn aria-hidden="true"/></span><div><h1 className="page-title">Transporter login</h1><p className="page-subtitle">Open your transporter workspace securely. Capacity seekers do not need an account.</p></div></div>
      <Flash error={query.error} success={query.success}/>
      {managed?<div className="managed-login-stack">
        <form action="/api/auth/google" method="post">
          <button className="button secondary auth-google-button" type="submit"><span className="auth-google-mark" aria-hidden="true">G</span>Continue with Google</button>
        </form>
        <div className="auth-divider"><span>or use email</span></div>
        {codeStep?<form action="/api/auth/email-otp/verify" method="post" className="stack" data-testid="email-code-form">
          <div className="form-group"><label htmlFor="otp-email"><Mail aria-hidden="true"/>Account email</label><input id="otp-email" name="email" type="email" autoComplete="email" required/></div>
          <div className="form-group"><label htmlFor="otp-code"><KeyRound aria-hidden="true"/>Sign-in code</label><input id="otp-code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required/><small>Enter the six-digit code from your email.</small></div>
          <button className="button" type="submit"><LogIn aria-hidden="true"/>Sign in</button>
          <Link className="auth-inline-link" href="/login"><RotateCcw aria-hidden="true"/>Use a different email</Link>
        </form>:<form action="/api/auth/email-otp/request" method="post" className="stack" data-testid="email-code-request-form">
          <div className="form-group"><label htmlFor="managed-email"><Mail aria-hidden="true"/>Transporter account</label><input id="managed-email" name="email" type="email" autoComplete="email" required/><small>We will email a one-time sign-in code.</small></div>
          <button className="button" type="submit"><Send aria-hidden="true"/>Email me a code</button>
        </form>}
        <p className="auth-privacy-note"><LockKeyhole aria-hidden="true"/>Google and email codes are used only to identify your Loadgistic account.</p>
      </div>:null}
      {fixturePassword?<details className="auth-fixture-login" open={!managed}>
        <summary>Local fixture password</summary>
        <form action="/api/auth/login" method="post" className="stack" data-testid="login-form">
          <div className="form-group"><label htmlFor="email"><Mail aria-hidden="true"/>Email</label><input id="email" name="email" type="email" autoComplete="email" required/></div>
          <div className="form-group"><label htmlFor="password"><LockKeyhole aria-hidden="true"/>Password</label><input id="password" name="password" type="password" autoComplete="current-password" required/></div>
          <button className="button" type="submit"><LogIn aria-hidden="true"/>Log in</button>
        </form>
      </details>:null}
      {!managed&&!fixturePassword?<div className="auth-unavailable" role="status"><LockKeyhole aria-hidden="true"/><p>Transporter sign in is temporarily unavailable.</p></div>:null}
      <div className="auth-signup"><span>New to Loadgistic?</span><Link className="button secondary" href="/apply"><CirclePlus aria-hidden="true"/>Create a transporter account</Link></div>
    </section>
    <Link className="auth-back" href="/"><ArrowLeft aria-hidden="true"/>Back to Truck Market</Link>
  </div></main></>;
}
