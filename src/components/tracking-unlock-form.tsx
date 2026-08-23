"use client";

import React from 'react';
import { KeyRound, LoaderCircle, PackageSearch } from 'lucide-react';

export function TrackingUnlockForm() {
  const [submitting,setSubmitting]=React.useState(false);
  function submit(event:React.FormEvent<HTMLFormElement>){
    if(submitting){event.preventDefault();return;}
    setSubmitting(true);
  }
  return <form action="/api/tracking/unlock" method="post" className="tracking-code-form" onSubmit={submit}>
    <div className="form-group"><label htmlFor="tracking-code"><KeyRound aria-hidden="true"/>Tracking code</label><input id="tracking-code" name="trackingCode" autoComplete="off" inputMode="text" placeholder="LG-XXXX-XXXX" required readOnly={submitting}/></div>
    <button className="button icon-button-label" disabled={submitting} aria-live="polite">{submitting?<LoaderCircle className="tracking-submit-spinner" aria-hidden="true"/>:<PackageSearch aria-hidden="true"/>}{submitting?'Opening tracking…':'Open tracking'}</button>
  </form>;
}
