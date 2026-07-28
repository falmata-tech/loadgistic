"use client";

import React from 'react';
import Image from 'next/image';
import { VEHICLE_CONFIGURATIONS } from '@/lib/vehicle-configurations';
import {
  ArrowRightLeft,
  Banknote,
  Boxes,
  Building2,
  CalendarClock,
  Check,
  Clock3,
  MapPin,
  PackageOpen,
  Route,
  Search,
  Send,
  Share2,
  ShieldCheck,
  Truck,
  Weight
} from 'lucide-react';
import { EthiopiaPlaceInput } from './ethiopia-place-input';

type Option = { id: string; name: string; type?: string; ref_kind?: string };

export function ShipmentForm({
  workspaceName,
  businesses,
  providers,
  selectedProvider,
  selectedReceiver,
  minDate
}: {
  workspaceName: string;
  businesses: Option[];
  providers: Option[];
  selectedProvider: string;
  selectedReceiver: string;
  minDate: string;
}) {
  const [distributionMode, setDistributionMode] = React.useState(selectedProvider ? 'DIRECT_TO_PROVIDER' : 'OPEN_MARKET');
  const [priceMode, setPriceMode] = React.useState('QUOTE_REQUESTED');

  return <form action="/api/shipments" method="post" className="load-composer stack" data-testid="new-shipment-form">
    <input type="hidden" name="serviceMode" value="FREIGHT"/>

    <section className="load-composer-section">
      <div className="load-step-heading"><span>1</span><PackageOpen aria-hidden="true"/><div><h2>Load and route</h2><p>What is moving, and where should it go?</p></div></div>
      <div className="form-grid">
        <div className="form-group full"><label htmlFor="shipment-title"><Boxes aria-hidden="true"/>Load name</label><input id="shipment-title" name="title" required placeholder="Example: Woven baskets for Hawassa shop"/></div>
        <div className="form-group"><label htmlFor="business-account"><Building2 aria-hidden="true"/>Load owner</label><input id="business-account" value={workspaceName} readOnly/></div>
        <div className="form-group"><label htmlFor="receiver-organization"><Building2 aria-hidden="true"/>Receiver Business (optional)</label><select id="receiver-organization" name="receiverOrganizationId" defaultValue={selectedReceiver}><option value="">Select later or external receiver</option>{businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}</select></div>
        <div className="route-inputs full"><div className="form-group"><label htmlFor="shipment-origin"><MapPin aria-hidden="true"/>From city</label><EthiopiaPlaceInput id="shipment-origin" name="origin" required placeholder="Addis Ababa"/></div><div className="route-arrow" aria-hidden="true"><ArrowRightLeft/></div><div className="form-group"><label htmlFor="shipment-destination"><MapPin aria-hidden="true"/>To city</label><EthiopiaPlaceInput id="shipment-destination" name="destination" required placeholder="Hawassa"/></div></div>
        <div className="form-group"><label htmlFor="pickup-date"><CalendarClock aria-hidden="true"/>Pick up before</label><input id="pickup-date" name="pickupDate" type="date" min={minDate} required/></div>
        <div className="form-group"><label htmlFor="delivery-date"><Clock3 aria-hidden="true"/>Drop off before (optional)</label><input id="delivery-date" name="deliveryDate" type="date" min={minDate}/></div>
        <div className="form-group full"><label htmlFor="cargo-description"><PackageOpen aria-hidden="true"/>What is the load?</label><textarea id="cargo-description" name="cargoDescription" required placeholder="Example: 18 packed cartons of woven baskets. Keep sensitive details out."/></div>
        <input type="hidden" name="packageCount" value="1"/>
        <div className="form-group"><label htmlFor="freight-weight"><Weight aria-hidden="true"/>Estimated kg (optional)</label><input id="freight-weight" name="estimatedWeight" type="number" min="0" step="0.1" inputMode="decimal"/></div>
        <fieldset className="form-group full"><legend><Truck aria-hidden="true"/>Load size</legend><div className="rich-choice-grid two"><label className="rich-choice"><input type="radio" name="loadType" value="FTL" required/><Truck aria-hidden="true"/><span><strong>FTL</strong><small>Needs a full truck</small></span><Check className="choice-check" aria-hidden="true"/></label><label className="rich-choice"><input type="radio" name="loadType" value="PTL" required/><Boxes aria-hidden="true"/><span><strong>PTL</strong><small>Can share truck space</small></span><Check className="choice-check" aria-hidden="true"/></label></div></fieldset>
        <fieldset className="form-group full vehicle-choice-field"><legend><Truck aria-hidden="true"/>Best cargo configuration (optional)</legend><p className="meta">Choose by picture. Leave every option unselected when any truck can work.</p><div className="vehicle-choice-grid">{VEHICLE_CONFIGURATIONS.map((configuration)=><label className="vehicle-choice" key={configuration.name}><input type="radio" name="vehicleCategory" value={configuration.name}/><Image src={configuration.image} alt={configuration.name} width={180} height={180}/><span>{configuration.name}</span><Check className="choice-check" aria-hidden="true"/></label>)}</div></fieldset>
      </div>
    </section>

    <section className="load-composer-section">
      <div className="load-step-heading"><span>2</span><Share2 aria-hidden="true"/><div><h2>Who can see it?</h2><p>Choose the transporters you want to reach.</p></div></div>
      <div className="form-grid">
        <fieldset className="form-group full"><legend><Share2 aria-hidden="true"/>Load visibility</legend><div className="rich-choice-grid three"><label className="rich-choice"><input type="radio" name="distributionMode" value="OPEN_MARKET" checked={distributionMode==='OPEN_MARKET'} onChange={event=>setDistributionMode(event.target.value)}/><Search aria-hidden="true"/><span><strong>Load Board</strong><small>All approved transporters</small></span><Check className="choice-check" aria-hidden="true"/></label><label className="rich-choice"><input type="radio" name="distributionMode" value="SAVED_PARTNERS" checked={distributionMode==='SAVED_PARTNERS'} onChange={event=>setDistributionMode(event.target.value)}/><ShieldCheck aria-hidden="true"/><span><strong>Partners</strong><small>Connected network only</small></span><Check className="choice-check" aria-hidden="true"/></label><label className="rich-choice"><input type="radio" name="distributionMode" value="DIRECT_TO_PROVIDER" checked={distributionMode==='DIRECT_TO_PROVIDER'} onChange={event=>setDistributionMode(event.target.value)}/><Send aria-hidden="true"/><span><strong>Direct</strong><small>One transporter</small></span><Check className="choice-check" aria-hidden="true"/></label></div></fieldset>
        {distributionMode === 'DIRECT_TO_PROVIDER' ? <div className="form-group full"><label htmlFor="providerRef"><Truck aria-hidden="true"/>Selected transporter</label><select id="providerRef" name="providerRef" defaultValue={selectedProvider} required><option value="">Choose a transporter</option>{providers.map((provider) => <option key={`${provider.ref_kind}-${provider.id}`} value={`${provider.ref_kind}:${provider.id}`}>{provider.name}</option>)}</select></div> : null}
      </div>
    </section>

    <section className="load-composer-section">
      <div className="load-step-heading"><span>3</span><Banknote aria-hidden="true"/><div><h2>Price and tracking</h2><p>Set the offer and the updates required after assignment.</p></div></div>
      <div className="form-grid">
        <div className="form-group"><label htmlFor="price-mode"><Banknote aria-hidden="true"/>Pricing</label><select id="price-mode" name="priceMode" value={priceMode} onChange={(event) => setPriceMode(event.target.value)}><option value="QUOTE_REQUESTED">Request quotes</option><option value="FIXED_PRICE">Fixed price in ETB</option><option value="TARGET_PRICE">Target price in ETB</option></select></div>
        {priceMode === 'FIXED_PRICE' ? <div className="form-group"><label htmlFor="fixed-price">Fixed amount (ETB)</label><input id="fixed-price" name="priceEtb" type="number" min="0" step="1" required placeholder="35000"/></div> : null}
        {priceMode === 'TARGET_PRICE' ? <div className="form-group"><label htmlFor="target-price">Target amount (ETB)</label><input id="target-price" name="targetPriceEtb" type="number" min="0" step="1" required placeholder="35000"/></div> : null}
        <div className="form-group"><label htmlFor="tracking-mode"><Route aria-hidden="true"/>Tracking after assignment</label><select id="tracking-mode" name="trackingMode" defaultValue="STATUS_ONLY"><option value="STATUS_ONLY">Status timeline</option><option value="LOCATION_AND_STATUS">Approximate location + status</option></select><div className="meta">Device location is hidden inside a 40 km privacy area. Proof is handled separately.</div></div>
      </div>
    </section>
    <button className="button load-submit icon-button-label" type="submit"><Send aria-hidden="true"/>Post load</button>
  </form>;
}
