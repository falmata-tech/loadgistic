"use client";

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarDays, Check, Clipboard, KeyRound, Link2, LoaderCircle, Mail, MapPin, PackageCheck, Route, ShieldCheck, Truck } from 'lucide-react';
import { EthiopiaPlaceInput } from './ethiopia-place-input';

type Vehicle={id:string;platform_number:string;make:string;model:string;cargo_configuration?:string;category?:string};
type Created={id:string;code:string;trackingCode:string;trackingPath:string};

export function ProviderShipmentForm({vehicles}:{vehicles:Vehicle[]}){
  const router=useRouter();
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
      router.refresh();
    }catch(problem){setError(problem instanceof Error?problem.message:'Could not start Tracking.');}
    finally{setSubmitting(false);}
  }

  async function copy(label:string,value:string){
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(()=>setCopied(''),1800);
  }

  if(created)return <section className="tracking-code-reveal" aria-live="polite">
    <div className="tracking-code-reveal-heading"><span><Check aria-hidden="true"/></span><div><p className="eyebrow">Tracking started</p><h1>{created.code}</h1><p>The Track link and code are queued for the customer owner email. The owner may share them with anyone who should follow the shipment.</p></div></div>
    <div className="party-code-grid single">
      <article><div><KeyRound aria-hidden="true"/><strong>Customer tracking code</strong></div><code>{created.trackingCode}</code><button type="button" className="button secondary" onClick={()=>copy('code',created.trackingCode)}>{copied==='code'?<Check aria-hidden="true"/>:<Clipboard aria-hidden="true"/>}{copied==='code'?'Copied':'Copy code'}</button></article>
      <article><div><Link2 aria-hidden="true"/><strong>Tracking link</strong></div><code>{created.trackingPath}</code><button type="button" className="button secondary" onClick={()=>copy('link',`${window.location.origin}${created.trackingPath}`)}>{copied==='link'?<Check aria-hidden="true"/>:<Clipboard aria-hidden="true"/>}{copied==='link'?'Copied':'Copy link'}</button></article>
    </div>
    <div className="permission-note"><ShieldCheck aria-hidden="true"/><div><strong>One simple customer handoff</strong><span>The same code remains available inside this Tracking record while customer access is active.</span></div></div>
    <Link className="button" href={`/app/provider-shipments/${created.id}`}>Open Tracking</Link>
  </section>;

  return <form onSubmit={submit} className="form-card stack">
    {error?<div className="flash error" role="alert">{error}</div>:null}
    <section><div className="section-heading-icon"><Truck aria-hidden="true"/><div><h2>Truck and tracking</h2><p className="meta">Create the record only after you and the customer have agreed offline.</p></div></div><div className="form-grid">
      <div className="form-group full"><label htmlFor="provider-shipment-vehicle"><Truck aria-hidden="true"/>Truck</label><select id="provider-shipment-vehicle" name="vehicleId" required defaultValue=""><option value="" disabled>Choose a truck</option>{vehicles.map(vehicle=><option key={vehicle.id} value={vehicle.id}>{vehicle.platform_number} · {vehicle.make} {vehicle.model} · {vehicle.cargo_configuration||vehicle.category}</option>)}</select></div>
      <div className="form-group full"><label htmlFor="cargo-summary"><PackageCheck aria-hidden="true"/>Cargo summary</label><input id="cargo-summary" name="cargoSummary" minLength={3} maxLength={500} required placeholder="Coffee bags · partial space"/></div>
    </div></section>
    <section><div className="section-heading-icon"><Route aria-hidden="true"/><div><h2>Route</h2><p className="meta">Choose recognizable Ethiopian places. Exact loading details are coordinated offline.</p></div></div><div className="form-grid">
      <div className="form-group"><label htmlFor="shipment-origin"><MapPin aria-hidden="true"/>Origin</label><EthiopiaPlaceInput id="shipment-origin" name="origin" placeRefName="originPlaceRef" required placeholder="Search origin"/></div>
      <div className="form-group"><label htmlFor="shipment-destination"><MapPin aria-hidden="true"/>Destination</label><EthiopiaPlaceInput id="shipment-destination" name="destination" placeRefName="destinationPlaceRef" required placeholder="Search destination"/></div>
      <div className="form-group"><label htmlFor="expected-pickup"><CalendarDays aria-hidden="true"/>Expected pickup <span className="meta">(optional)</span></label><input id="expected-pickup" name="expectedPickupDate" type="date"/></div>
      <div className="form-group"><label htmlFor="expected-delivery"><CalendarDays aria-hidden="true"/>Expected delivery <span className="meta">(optional)</span></label><input id="expected-delivery" name="expectedDeliveryDate" type="date"/></div>
    </div></section>
    <section><div className="section-heading-icon"><Mail aria-hidden="true"/><div><h2>Customer owner</h2><p className="meta">This person receives the Track link, code, completion record, and verified review invitation. They may be the shipper or receiver.</p></div></div><div className="form-grid">
      <div className="form-group full"><label htmlFor="customer-email"><Mail aria-hidden="true"/>Customer owner email</label><input id="customer-email" name="customerEmail" type="email" required autoComplete="off"/></div>
    </div></section>
    <button className="button" disabled={submitting||!vehicles.length}>{submitting?<LoaderCircle className="spin" aria-hidden="true"/>:<KeyRound aria-hidden="true"/>}{submitting?'Starting Tracking…':'Start Tracking'}</button>
  </form>;
}
