"use client";


import {Text,Localized} from '@/components/localization';
import React from 'react';
import Link from 'next/link';
import { CalendarDays, Check, Clipboard, KeyRound, Link2, LoaderCircle, LocateFixed, Mail, MapPin, PackageCheck, Route, ShieldCheck, Truck } from 'lucide-react';
import { EthiopiaPlaceInput } from './ethiopia-place-input';

type Vehicle={id:string;platform_number:string;make:string;model:string;cargo_configuration?:string;category?:string};
type Created={id:string;code:string;trackingCode:string;trackingPath:string};

export function ProviderShipmentForm({vehicles}:{vehicles:Vehicle[]}){
  const [created,setCreated]=React.useState(null as Created|null);
  const [error,setError]=React.useState('');
  const [submitting,setSubmitting]=React.useState(false);
  const [copied,setCopied]=React.useState('');

  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setError('');setSubmitting(true);
    try{
      const response=await fetch('/api/provider-shipments',{method:'POST',body:new FormData(event.currentTarget)});
      const body=await response.json();
      if(!response.ok)throw new Error(body.error||'Could not start Tracking.');
      setCreated(body);
    }catch(problem){setError(problem instanceof Error?problem.message:'Could not start Tracking.');}
    finally{setSubmitting(false);}
  }

  async function copy(label:string,value:string){
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(()=>setCopied(''),1800);
  }

  if(created)return <section className="tracking-code-reveal" aria-live="polite">
    <div className="tracking-code-reveal-heading"><span><Check aria-hidden="true"/></span><div><p className="eyebrow"><Text message="Tracking started"/></p><h1>{created.code}</h1><p><Text message="The Track link and code are queued for every approved tracking party."/></p></div></div>
    <div className="party-code-grid single">
      <article><div><KeyRound aria-hidden="true"/><strong><Text message="Customer tracking code"/></strong></div><code>{created.trackingCode}</code><button type="button" className="button secondary" onClick={()=>copy('code',created.trackingCode)}>{copied==='code'?<Check aria-hidden="true"/>:<Clipboard aria-hidden="true"/>}{copied==='code'?<Text message="Copied"/>:<Text message="Copy code"/>}</button></article>
      <article><div><Link2 aria-hidden="true"/><strong><Text message="Tracking link"/></strong></div><code>{created.trackingPath}</code><button type="button" className="button secondary" onClick={()=>copy('link',`${window.location.origin}${created.trackingPath}`)}>{copied==='link'?<Check aria-hidden="true"/>:<Clipboard aria-hidden="true"/>}{copied==='link'?<Text message="Copied"/>:<Text message="Copy link"/>}</button></article>
    </div>
    <div className="permission-note"><ShieldCheck aria-hidden="true"/><div><strong><Text message="Email-verified access"/></strong><span><Text message="Each approved person uses this shipment code with their own email and one-time code."/></span></div></div>
    <Link className="button" href={`/app/provider-shipments/${created.id}`}><Text message="Open Tracking"/></Link>
  </section>;

  return <form onSubmit={submit} className="form-card stack">
    {error?<div className="flash error" role="alert">{error}</div>:null}
    <section><div className="section-heading-icon"><Truck aria-hidden="true"/><div><h2><Text message="Truck and tracking"/></h2><p className="meta"><Text message="Start Tracking once you and your customer have agreed the work."/></p></div></div><div className="form-grid">
      <div className="form-group full"><label htmlFor="provider-shipment-vehicle"><Truck aria-hidden="true"/><Text message="Truck"/></label><select id="provider-shipment-vehicle" name="vehicleId" required defaultValue=""><option value="" disabled><Text message="Choose a truck"/></option>{vehicles.map(vehicle=><option key={vehicle.id} value={vehicle.id}>{vehicle.platform_number} · {vehicle.make} {vehicle.model} · {vehicle.cargo_configuration||vehicle.category}</option>)}</select></div>
      <div className="form-group full"><label htmlFor="cargo-summary"><PackageCheck aria-hidden="true"/><Text message="Cargo summary"/></label><Localized as="input" copy={["placeholder"]} id="cargo-summary" name="cargoSummary" minLength={3} maxLength={500} required placeholder="Coffee bags · partial space"/></div>
    </div></section>
    <section><div className="section-heading-icon"><Route aria-hidden="true"/><div><h2><Text message="Route"/></h2><p className="meta"><Text message="Choose recognizable Ethiopian places. Exact loading details are coordinated offline."/></p></div></div><div className="form-grid">
      <div className="form-group"><label htmlFor="shipment-origin"><MapPin aria-hidden="true"/><Text message="Origin"/></label><EthiopiaPlaceInput id="shipment-origin" name="origin" placeRefName="originPlaceRef" required placeholder="Search origin"/></div>
      <div className="form-group"><label htmlFor="shipment-destination"><MapPin aria-hidden="true"/><Text message="Destination"/></label><EthiopiaPlaceInput id="shipment-destination" name="destination" placeRefName="destinationPlaceRef" required placeholder="Search destination"/></div>
      <div className="form-group"><label htmlFor="expected-pickup"><CalendarDays aria-hidden="true"/><Text message="Expected pickup "/><span className="meta"><Text message="(optional)"/></span></label><input id="expected-pickup" name="expectedPickupDate" type="date"/></div>
      <div className="form-group"><label htmlFor="expected-delivery"><CalendarDays aria-hidden="true"/><Text message="Expected delivery "/><span className="meta"><Text message="(optional)"/></span></label><input id="expected-delivery" name="expectedDeliveryDate" type="date"/></div>
    </div></section>
    <section><div className="section-heading-icon"><Mail aria-hidden="true"/><div><h2><Text message="Tracking parties"/></h2><p className="meta"><Text message="The customer owner receives the completion record and review invitation. Add brokers, shippers or receivers who should also follow this shipment."/></p></div></div><div className="form-grid">
      <div className="form-group full"><label htmlFor="customer-email"><Mail aria-hidden="true"/><Text message="Customer owner email"/></label><input id="customer-email" name="customerEmail" type="email" required autoComplete="off"/></div>
      <div className="form-group full"><label htmlFor="additional-recipient-emails"><Mail aria-hidden="true"/><Text message="Additional tracking emails "/><span className="meta"><Text message="(optional)"/></span></label><textarea id="additional-recipient-emails" name="additionalRecipientEmails" rows={3} placeholder={'dispatch@example.com\nreceiver@example.com'} aria-describedby="additional-recipient-help"/><small id="additional-recipient-help" className="meta"><Text message="Enter one email per line, up to 20. Each person verifies their own email before viewing updates."/></small></div>
    </div></section>
    <fieldset className="tracking-mode-choice"><legend><LocateFixed aria-hidden="true"/><Text message="Updates shared with the customer"/></legend><label><input type="radio" name="trackingMode" value="STATUS_ONLY" defaultChecked/><span><strong><Text message="Status only"/></strong><small><Text message="Shares the shipment timeline without Driver location."/></small></span></label><label><input type="radio" name="trackingMode" value="LOCATION_AND_STATUS"/><span><strong><Text message="Status and approximate location"/></strong><small><Text message="During travel to pickup and delivery, the assigned Driver shares an obscured area from their phone."/></small></span></label></fieldset>
    <button className="button" disabled={submitting||!vehicles.length}>{submitting?<LoaderCircle className="spin" aria-hidden="true"/>:<KeyRound aria-hidden="true"/>}{submitting?<Text message="Starting Tracking…"/>:<Text message="Start Tracking"/>}</button>
  </form>;
}
