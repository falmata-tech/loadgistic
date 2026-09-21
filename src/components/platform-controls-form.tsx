"use client";

import React from 'react';
import {CalendarClock,CheckCircle2,Settings2,Sparkles} from 'lucide-react';

type Controls={access_mode:string;featured_mode:string;featured_target_count:number};

export function AccessControlsForm({controls}:{controls:Controls}){
  const [mode,setMode]=React.useState(controls.access_mode);
  const activating=mode==='TRIAL_PAYMENT'&&controls.access_mode==='FREE';
  return <form action="/api/admin/settings" method="post" className="card platform-control-card">
    <input type="hidden" name="section" value="ACCESS"/>
    <header><Settings2 aria-hidden="true"/><div><h2>Workspace access</h2><p>Choose when trials and payments begin.</p></div></header>
    <fieldset className="platform-mode-options"><legend className="sr-only">Access mode</legend>
      <label className={mode==='FREE'?'selected':''}><input type="radio" name="mode" value="FREE" checked={mode==='FREE'} onChange={()=>setMode('FREE')}/><span><strong>Free access</strong><small>No trial countdown or payment required.</small></span></label>
      <label className={mode==='TRIAL_PAYMENT'?'selected':''}><input type="radio" name="mode" value="TRIAL_PAYMENT" checked={mode==='TRIAL_PAYMENT'} onChange={()=>setMode('TRIAL_PAYMENT')}/><span><strong>Trial, then payment</strong><small>Seven days free, then an active paid plan.</small></span></label>
    </fieldset>
    {activating?<label className="platform-activation-confirm"><input type="checkbox" name="confirm" value="ENABLE" required/><span>Start a fresh seven-day trial for existing unpaid providers. Payment will be required afterwards.</span></label>:null}
    <p className="meta">Existing payments and account history are kept. Changing this never charges anyone automatically.</p>
    <button className="button"><CheckCircle2 aria-hidden="true"/>Save access mode</button>
  </form>;
}

export function FeaturedControlsForm({controls}:{controls:Controls}){
  return <section className="card platform-control-card" aria-label="Featured selection settings"><header><Sparkles aria-hidden="true"/><div><h2>Daily selection</h2><p>Choose automatically by the day’s truck type, or curate each day.</p></div></header>
    <form action="/api/admin/settings" method="post" className="stack"><input type="hidden" name="section" value="FEATURED"/>
      <div className="form-grid"><div className="form-group"><label htmlFor="featured-selection-mode">Selection</label><select id="featured-selection-mode" name="mode" defaultValue={controls.featured_mode}><option value="AUTO">Automatic daily selection</option><option value="MANUAL">Manual only</option></select></div><div className="form-group"><label htmlFor="featured-selection-count">Maximum Drivers per day</label><input id="featured-selection-count" type="number" name="targetCount" min="1" max="12" required defaultValue={controls.featured_target_count}/></div></div>
      <p className="meta">Random truck-and-Driver pairs rotate without repeats until the eligible round is complete. The actual roster size sets airtime. Saved days and manual drafts are kept.</p>
      <button className="button secondary">Save selection settings</button>
    </form>
    {controls.featured_mode==='AUTO'?<form action="/api/admin/settings" method="post"><input type="hidden" name="section" value="PREPARE_FEATURED"/><button className="button secondary"><CalendarClock aria-hidden="true"/>Prepare upcoming days</button><small className="meta">Prepares unscheduled dates for the next seven days.</small></form>:null}
  </section>;
}
