"use client";

import React from 'react';
import Image from 'next/image';
import { VEHICLE_CONFIGURATIONS } from '@/lib/vehicle-configurations';
import {
  ArrowRightLeft,
  Banknote,
  Boxes,
  CalendarClock,
  Check,
  Clock3,
  MapPin,
  Navigation,
  PackageOpen,
  Route,
  Search,
  Send,
  Share2,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { EthiopiaPlaceInput } from './ethiopia-place-input';
import { AsyncMemberSelect } from './async-member-select';
import { LocalLoadMapPicker } from './local-load-map-picker';

export function ShipmentForm({
  selectedProvider,
  selectedProviderLabel,
  minDate
}: {
  selectedProvider: string;
  selectedProviderLabel:string;
  minDate: string;
}) {
  const [distributionMode, setDistributionMode] = React.useState(selectedProvider ? 'DIRECT_TO_PROVIDER' : 'OPEN_MARKET');
  const [priceMode, setPriceMode] = React.useState('QUOTE_REQUESTED');
  const [loadType,setLoadType]=React.useState('');
  const [movementScope,setMovementScope]=React.useState('INTERCITY' as 'LOCAL'|'INTERCITY');
  const [localCenter,setLocalCenter]=React.useState(null as {lat:number;lng:number}|null);

  return <form action="/api/shipments" method="post" className="load-composer stack" data-testid="new-shipment-form">
    <input type="hidden" name="serviceMode" value="FREIGHT"/>

    <section className="load-composer-section">
      <div className="load-step-heading"><span>1</span><PackageOpen aria-hidden="true"/><div><h2>Shipment and route</h2><p>What is moving, and where should it go?</p></div></div>
      <div className="form-grid">
        <div className="form-group full"><label htmlFor="shipment-title"><Boxes aria-hidden="true"/>Shipment name</label><input id="shipment-title" name="title" required placeholder="Example: Woven baskets for a shop in Hawassa, Ethiopia"/></div>
        <fieldset className="form-group full"><legend><Route aria-hidden="true"/>Movement</legend><div className="rich-choice-grid two"><label className="rich-choice"><input type="radio" name="movementScope" value="LOCAL" checked={movementScope==='LOCAL'} onChange={()=>setMovementScope('LOCAL')}/><MapPin aria-hidden="true"/><span><strong>Local</strong><small>Within one city or town area</small></span><Check className="choice-check" aria-hidden="true"/></label><label className="rich-choice"><input type="radio" name="movementScope" value="INTERCITY" checked={movementScope==='INTERCITY'} onChange={()=>setMovementScope('INTERCITY')}/><Route aria-hidden="true"/><span><strong>Between cities</strong><small>Origin city to destination city</small></span><Check className="choice-check" aria-hidden="true"/></label></div></fieldset>
        {movementScope==='INTERCITY'?<div className="route-inputs full"><div className="form-group"><label htmlFor="shipment-origin"><MapPin aria-hidden="true"/>From city</label><EthiopiaPlaceInput id="shipment-origin" name="origin" placeRefName="originPlaceRef" required placeholder="Addis Ababa, Ethiopia"/></div><div className="route-arrow" aria-hidden="true"><ArrowRightLeft/></div><div className="form-group"><label htmlFor="shipment-destination"><MapPin aria-hidden="true"/>To city</label><EthiopiaPlaceInput id="shipment-destination" name="destination" placeRefName="destinationPlaceRef" required placeholder="Hawassa, Ethiopia"/></div></div>:<div className="local-load-location full">
          <div className="form-group"><label htmlFor="shipment-locality"><MapPin aria-hidden="true"/>Local city or town</label><EthiopiaPlaceInput id="shipment-locality" name="localPlaceLabel" placeRefName="localPlaceRef" required placeholder="Addis Ababa, Ethiopia" onPlaceSelect={place=>setLocalCenter({lat:place.lat,lng:place.lng})}/></div>
          <div className="form-grid"><div className="form-group"><label htmlFor="pickup-area"><Navigation aria-hidden="true"/>Pickup area (optional)</label><input id="pickup-area" name="pickupAreaLabel" placeholder="Bole, near Megenagna"/></div><div className="form-group"><label htmlFor="dropoff-area"><MapPin aria-hidden="true"/>Drop-off area (optional)</label><input id="dropoff-area" name="dropoffAreaLabel" placeholder="Saris, near the main road"/></div></div>
          <LocalLoadMapPicker center={localCenter}/>
        </div>}
        <div className="form-group"><label htmlFor="pickup-date"><CalendarClock aria-hidden="true"/>Pick up before</label><input id="pickup-date" name="pickupDate" type="date" min={minDate} required/></div>
        <div className="form-group"><label htmlFor="delivery-date"><Clock3 aria-hidden="true"/>Drop off before (optional)</label><input id="delivery-date" name="deliveryDate" type="date" min={minDate}/></div>
        <div className="form-group full"><label htmlFor="cargo-description"><PackageOpen aria-hidden="true"/>Shipment detail</label><textarea id="cargo-description" name="cargoDescription" required placeholder="Example: 18 packed cartons of woven baskets. Keep sensitive details out."/></div>
        <input type="hidden" name="packageCount" value="1"/>
        <fieldset className="form-group full"><legend><Truck aria-hidden="true"/>Shipment size</legend><div className="rich-choice-grid two"><label className="rich-choice"><input type="radio" name="loadType" value="FTL" required onChange={event=>setLoadType(event.target.value)}/><Truck aria-hidden="true"/><span><strong>FTL</strong><small>Needs a full truck</small></span><Check className="choice-check" aria-hidden="true"/></label><label className="rich-choice"><input type="radio" name="loadType" value="PTL" required onChange={event=>setLoadType(event.target.value)}/><Boxes aria-hidden="true"/><span><strong>PTL</strong><small>Can share truck space</small></span><Check className="choice-check" aria-hidden="true"/></label></div></fieldset>
        <fieldset className="form-group full vehicle-choice-field"><legend><Truck aria-hidden="true"/>Best cargo configuration (optional)</legend><p className="meta">Choose by picture. Leave every option unselected when any truck can work.</p><div className="vehicle-choice-grid">{VEHICLE_CONFIGURATIONS.map((configuration)=><label className="vehicle-choice" key={configuration.name}><input type="radio" name="vehicleCategory" value={configuration.name}/><Image src={configuration.image} alt={configuration.name} width={180} height={180}/><span>{configuration.name}</span><Check className="choice-check" aria-hidden="true"/></label>)}</div></fieldset>
      </div>
    </section>

    <section className="load-composer-section">
      <div className="load-step-heading"><span>2</span><Share2 aria-hidden="true"/><div><h2>Who can see it?</h2><p>Choose the transporters you want to reach.</p></div></div>
      <div className="form-grid">
        <fieldset className="form-group full"><legend><Share2 aria-hidden="true"/>Shipment visibility</legend><div className="rich-choice-grid three"><label className="rich-choice"><input type="radio" name="distributionMode" value="OPEN_MARKET" checked={distributionMode==='OPEN_MARKET'} onChange={event=>setDistributionMode(event.target.value)}/><Search aria-hidden="true"/><span><strong>Shipment Board</strong><small>All approved transporters</small></span><Check className="choice-check" aria-hidden="true"/></label><label className="rich-choice"><input type="radio" name="distributionMode" value="SAVED_PARTNERS" checked={distributionMode==='SAVED_PARTNERS'} onChange={event=>setDistributionMode(event.target.value)}/><ShieldCheck aria-hidden="true"/><span><strong>Partners</strong><small>Connected network only</small></span><Check className="choice-check" aria-hidden="true"/></label><label className="rich-choice"><input type="radio" name="distributionMode" value="DIRECT_TO_PROVIDER" checked={distributionMode==='DIRECT_TO_PROVIDER'} onChange={event=>setDistributionMode(event.target.value)}/><Send aria-hidden="true"/><span><strong>Direct</strong><small>One transporter</small></span><Check className="choice-check" aria-hidden="true"/></label></div></fieldset>
        {distributionMode === 'DIRECT_TO_PROVIDER' ? <AsyncMemberSelect id="providerRef" name="providerRef" kind="TRANSPORT" label="Selected transporter" placeholder="Start typing a transporter or driver name" initialRef={selectedProvider} initialLabel={selectedProviderLabel} required/> : null}
      </div>
    </section>

    <section className="load-composer-section">
      <div className="load-step-heading"><span>3</span><Banknote aria-hidden="true"/><div><h2>Price and tracking</h2><p>Set the offer and the updates required after assignment.</p></div></div>
      <div className="form-grid">
        <div className="form-group"><label htmlFor="price-mode"><Banknote aria-hidden="true"/>Pricing</label><select id="price-mode" name="priceMode" value={priceMode} onChange={(event) => setPriceMode(event.target.value)}><option value="QUOTE_REQUESTED">Request quotes</option><option value="FIXED_PRICE">Fixed price in ETB</option><option value="TARGET_PRICE">Target price in ETB</option></select></div>
        {priceMode === 'FIXED_PRICE' ? <div className="form-group"><label htmlFor="fixed-price"><Banknote aria-hidden="true"/>Fixed amount (ETB)</label><input id="fixed-price" name="priceEtb" type="number" min="0" step="1" required placeholder="35000"/></div> : null}
        {priceMode === 'TARGET_PRICE' ? <div className="form-group"><label htmlFor="target-price"><Banknote aria-hidden="true"/>Target amount (ETB)</label><input id="target-price" name="targetPriceEtb" type="number" min="0" step="1" required placeholder="35000"/></div> : null}
        <div className="form-group"><label htmlFor="tracking-mode"><Route aria-hidden="true"/>Tracking after assignment</label><select id="tracking-mode" name="trackingMode" defaultValue="STATUS_ONLY"><option value="STATUS_ONLY">Status timeline</option><option value="LOCATION_AND_STATUS">Approximate location + status</option></select><div className="meta">Device location uses a {loadType==='FTL'?'20':loadType==='PTL'?'40':'20 or 40'} km privacy area based on shipment size. Proof is handled separately.</div></div>
      </div>
    </section>
    <button className="button load-submit icon-button-label" type="submit"><Send aria-hidden="true"/>Post shipment</button>
  </form>;
}
