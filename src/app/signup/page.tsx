import Link from 'next/link';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {Mail,KeyRound,Send,LogIn,RotateCcw} from 'lucide-react';
import {Text} from '@/components/localization';
import {PublicHeader} from '@/components/public-header';
import {PublicAuthShell} from '@/components/public-auth-shell';
import {Flash} from '@/components/flash';
import {getCurrentUser} from '@/lib/auth';
import {localAuthInboxUrl} from '@/lib/auth-flow.js';
import {MANAGED_SIGNUP_COOKIE,managedProviderSignupEligible,maskedProviderSignupEmail,readProviderSignupHandoff} from '@/lib/provider-signup.js';
import {getManagedCurrentUser} from '@/lib/identity/supabase';
import {createSupabaseServerClient} from '@/lib/supabase/server';
import {signupAudience} from '@/lib/signup-audience.js';
import {signupBenefits} from '@/lib/platform-copy.js';

export default async function SignupPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const user=await getCurrentUser();
 if(user?.active)redirect('/');
 const query=await searchParams,audience=signupAudience(query.audience)==='BUSINESS'?'BUSINESS':'PROVIDER';
 const handoff=readProviderSignupHandoff((await cookies()).get(MANAGED_SIGNUP_COOKIE)?.value||'');
 const codeStep=query.step==='code'&&Boolean(handoff?.email);
 let verified=false;
 if(handoff?.email){
  try{
   const client=await createSupabaseServerClient();
   const {data,error}=await client.auth.getUser();
   const identity=!error&&data.user?await getManagedCurrentUser(client,data.user):null;
   if(identity&&data.user&&!identity.active&&data.user.email?.trim().toLowerCase()===handoff.email)
    verified=await managedProviderSignupEligible(data.user.id);
  }catch{verified=false;}
 }
 const localInbox=localAuthInboxUrl();
 return <><PublicHeader/><PublicAuthShell variant="signup" taskKicker="New account" title={verified?'Choose your account':'Create an account'}
  description={verified?'Your email is verified. Choose how you will use Loadgistic.':codeStep?<Text message="We sent a six-digit code to {email}." values={{email:maskedProviderSignupEmail(handoff?.email||'')}}/>:'Choose your account type, then verify your email.'}
  feedback={<Flash error={query.error} success={query.success}/>}
  contextKicker="Built for transport work" contextTitle="From one vehicle to a whole network" contextDescription="Show available space, find the right capacity, and keep trusted partners moving together.">
  {verified?<div className="signup-verified-actions"><div><strong><Text message="Transport Provider"/></strong><p><Text message={signupBenefits.provider[1]}/></p><Link className="button" href="/apply"><Text message="Continue as Transport Provider"/></Link></div><div><strong><Text message="Shipper / broker"/></strong><p><Text message={signupBenefits.business[1]}/></p><Link className="button secondary" href="/workspaces?start=business"><Text message="Continue as Shipper / broker"/></Link></div></div>
   :<form action={codeStep?'/api/applications/email-otp/verify':'/api/applications/email-otp/request'} method="post" className="stack auth-primary-form">
    {codeStep?<><input type="hidden" name="audience" value={audience}/><div className="form-group"><label htmlFor="signup-code"><KeyRound aria-hidden="true"/><Text message="Six-digit code"/></label><input id="signup-code" name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required/></div><button className="button auth-primary-action" type="submit"><LogIn aria-hidden="true"/><Text message="Continue"/></button><Link className="auth-inline-link" href="/signup"><RotateCcw aria-hidden="true"/><Text message="Use a different email"/></Link></>
     :<><fieldset className="signup-audience"><legend><Text message="I want to"/></legend><label><input type="radio" name="audience" value="BUSINESS" aria-labelledby="signup-business-title" defaultChecked={audience==='BUSINESS'}/><span><strong id="signup-business-title"><Text message="Find room for your load"/></strong><small><Text message="Shipper / broker workspace"/></small><ul>{signupBenefits.business.map(item=><li key={item}><Text message={item}/></li>)}</ul></span></label><label><input type="radio" name="audience" value="PROVIDER" aria-labelledby="signup-provider-title" defaultChecked={audience==='PROVIDER'}/><span><strong id="signup-provider-title"><Text message="Put your vehicles on the map"/></strong><small><Text message="Transport Provider workspace"/></small><ul>{signupBenefits.provider.map(item=><li key={item}><Text message={item}/></li>)}</ul></span></label></fieldset><Link className="auth-inline-link" href="/about"><Text message="See how Loadgistic works"/></Link><div className="form-group"><label htmlFor="signup-email"><Mail aria-hidden="true"/><Text message="Email"/></label><input id="signup-email" name="email" type="email" autoComplete="email" required/></div><button className="button auth-primary-action" type="submit"><Send aria-hidden="true"/><Text message="Email me a code"/></button></>}
    {localInbox?<a className="auth-inline-link auth-local-inbox" href={localInbox} target="_blank" rel="noreferrer"><Text message="Local testing: open the email inbox "/>↗</a>:null}
   </form>}
  <p className="auth-switch-link"><Text message="Already have an account? "/><Link href="/login"><Text message="Sign in"/></Link></p>
 </PublicAuthShell></>;
}
