'use client';

import React from 'react';
import {Text} from '@/components/localization';
import {AtSign,Phone,Truck,UserRound} from 'lucide-react';
import {PublicHandleInput} from './public-handle-input';

export function ProviderSignupDetailsForm(){
  const [ready,setReady]=React.useState(false);
  React.useEffect(()=>setReady(true),[]);
  return <form action="/api/applications" method="post" className="form-card stack provider-setup-form" data-testid="provider-details-form">
    <input type="hidden" name="applicationType" value="TRANSPORT_PROVIDER"/>
    <div className="form-grid">
      <div className="form-group full"><label htmlFor="provider-account-name"><UserRound aria-hidden="true"/><Text message="Account name"/></label><input id="provider-account-name" name="accountName" autoComplete="nickname" minLength={1} maxLength={140} required/><small><Text message="Use your name or a name for your transport work."/></small></div>
      <div className="form-group full"><label htmlFor="provider-handle"><AtSign aria-hidden="true"/><Text message="Handle"/></label><PublicHandleInput id="provider-handle" name="handle" required/><small><Text message="Use letters, numbers, underscores or hyphens."/></small></div>
      <div className="form-group full"><h3><Text message="Account manager"/></h3><small><Text message="Only your first name is shown as Account manager."/></small></div>
      <div className="form-group"><label htmlFor="applicant-first-name"><UserRound aria-hidden="true"/><Text message="First name"/></label><input id="applicant-first-name" name="firstName" autoComplete="given-name" minLength={1} maxLength={100} required/></div>
      <div className="form-group"><label htmlFor="applicant-last-name"><Text message="Last / father name"/></label><input id="applicant-last-name" name="lastName" autoComplete="family-name" maxLength={100}/><small><Text message="Private. Your last or father name is not shown publicly."/></small></div>
      <div className="form-group"><label htmlFor="application-phone"><Phone aria-hidden="true"/><Text message="Account phone"/></label><input id="application-phone" name="phone" type="tel" autoComplete="tel" aria-describedby="application-phone-help" required/><small id="application-phone-help"><Text message="Private. Add a public phone later if you choose."/></small></div>
      <div className="form-group full"><label htmlFor="application-note"><Truck aria-hidden="true"/><Text message="About your transport work "/><span className="meta"><Text message="(optional)"/></span></label><textarea id="application-note" name="notes" maxLength={1000} aria-describedby="application-note-help"/><small id="application-note-help"><Text message="Briefly describe the transport services you plan to offer."/></small></div>
    </div>
    <label className="rich-toggle"><input type="checkbox" name="drivesTruck" disabled={!ready}/><span className="toggle-track"/><Truck aria-hidden="true"/><span><strong><Text message="I drive a vehicle"/></strong><small><Text message="Keep my driving controls on Home."/></small></span></label>
    <button className="button auth-primary-action" type="submit" disabled={!ready}><Truck aria-hidden="true"/><Text message="Create transporter workspace"/></button>
  </form>;
}
