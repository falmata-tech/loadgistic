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
  UserRound
} from 'lucide-react';
import { EthiopiaPlaceInput } from './ethiopia-place-input';
import { AsyncMemberSelect } from './async-member-select';

export function ShipmentForm({
  workspaceName,
  selectedProvider,
  selectedReceiver,
  selectedProviderLabel,
  selectedReceiverLabel,
  minDate
}: {
  workspaceName: string;
  selectedProvider: string;
  selectedReceiver: string;
  selectedProviderLabel:string;
  selectedReceiverLabel:string;
  minDate: string;
}) {
  const [distributionMode, setDistributionMode] = React.useState(selectedProvider ? 'DIRECT_TO_PROVIDER' : 'OPEN_MARKET');
  const [priceMode, setPriceMode] = React.useState('QUOTE_REQUESTED');
  const [ownerPartyRole,setOwnerPartyRole]=React.useState('SHIPPER');
  const [counterpartyType,setCounterpartyType]=React.useState(selectedReceiver?'ACCOUNT':'ACCOUNT');
  const [loadType,setLoadType]=React.useState('');

  return <form action="/api/shipments" method="post" className="load-composer stack" data-testid="new-shipment-form">
    <input type="hidden" name="serviceMode" value="FREIGHT"/>

    <section className="load-composer-section">
      <div className="load-step-heading"><span>1</span><PackageOpen aria-hidden="true"/><div><h2>Load and route</h2><p>What is moving, and where should it go?</p></div></div>
      <div className="form-grid">
        <div className="form-group full"><label htmlFor="shipment-title"><Boxes aria-hidden="true"/>Load name</label><input id="shipment-title" name="title" required placeholder="Example: Woven baskets for a shop in Hawassa, Ethiopia"/></div>
        <div className="form-group"><label htmlFor="business-account"><Building2 aria-hidden="true"/>Load owner</label><input id="business-account" value={workspaceName} readOnly/></div>
        <fieldset className="form-group"><legend><UserRound aria-hidden="true"/>Your role on this load</legend><div className="segmented-control"><label onClick={()=>setOwnerPartyRole('SHIPPER')}><input type="radio" name="ownerPartyRole" value="SHIPPER" checked={ownerPartyRole==='SHIPPER'} onChange={()=>setOwnerPartyRole('SHIPPER')}/><span>Shipper</span></label><label onClick={()=>setOwnerPartyRole('RECEIVER')}><input type="radio" name="ownerPartyRole" value="RECEIVER" checked={ownerPartyRole==='RECEIVER'} onChange={()=>setOwnerPartyRole('RECEIVER')}/><span>Receiver</span></label></div></fieldset>
        <fieldset className="form-group full"><legend><Building2 aria-hidden="true"/>{ownerPartyRole==='SHIPPER'?'Who receives it?':'Who ships it?'}</legend><div className="segmented-control"><label onClick={()=>setCounterpartyType('ACCOUNT')}><input type="radio" name="counterpartyType" value="ACCOUNT" checked={counterpartyType==='ACCOUNT'} onChange={()=>setCounterpartyType('ACCOUNT')}/><span>Loadgistic Business</span></label><label onClick={()=>setCounterpartyType('EXTERNAL')}><input type="radio" name="counterpartyType" value="EXTERNAL" checked={counterpartyType==='EXTERNAL'} onChange={()=>setCounterpartyType('EXTERNAL')}/><span>External Business</span></label></div></fieldset>
        {counterpartyType==='ACCOUNT'?<AsyncMemberSelect id="counterparty-search" name="counterpartyRef" kind="BUSINESS" label={ownerPartyRole==='SHIPPER'?'Receiver Business':'Shipper Business'} placeholder="Start typing a Business name" initialRef={selectedReceiver?`org:${selectedReceiver}`:''} initialLabel={selectedReceiverLabel} required/>:<><div className="form-group"><label htmlFor="external-counterparty"><Building2 aria-hidden="true"/>{ownerPartyRole==='SHIPPER'?'Receiver':'Shipper'} name</label><input id="external-counterparty" name="externalCounterpartyName" required placeholder="Business or person name"/></div><div className="form-group"><label htmlFor="external-counterparty-phone">Phone (optional)</label><input id="external-counterparty-phone" name="externalCounterpartyPhone" type="tel" placeholder="+251 …"/></div></>}
        <div className="route-inputs full"><div className="form-group"><label htmlFor="shipment-origin"><MapPin aria-hidden="true"/>From city</label><EthiopiaPlaceInput id="shipment-origin" name="origin" required placeholder="Addis Ababa, Ethiopia"/></div><div className="route-arrow" aria-hidden="true"><ArrowRightLeft/></div><div className="form-group"><label htmlFor="shipment-destination"><MapPin aria-hidden="true"/>To city</label><EthiopiaPlaceInput id="shipment-destination" name="destination" required placeholder="Hawassa, Ethiopia"/></div></div>
        <div className="form-group"><label htmlFor="pickup-date"><CalendarClock aria-hidden="true"/>Pick up before</label><input id="pickup-date" name="pickupDate" type="date" min={minDate} required/></div>
        <div className="form-group"><label htmlFor="delivery-date"><Clock3 aria-hidden="true"/>Drop off before (optional)</label><input id="delivery-date" name="deliveryDate" type="date" min={minDate}/></div>
        <div className="form-group full"><label htmlFor="cargo-description"><PackageOpen aria-hidden="true"/>Load detail</label><textarea id="cargo-description" name="cargoDescription" required placeholder="Example: 18 packed cartons of woven baskets. Keep sensitive details out."/></div>
        <input type="hidden" name="packageCount" value="1"/>
        <fieldset className="form-group full"><legend><Truck aria-hidden="true"/>Load size</legend><div className="rich-choice-grid two"><label className="rich-choice"><input type="radio" name="loadType" value="FTL" required onChange={event=>setLoadType(event.target.value)}/><Truck aria-hidden="true"/><span><strong>FTL</strong><small>Needs a full truck</small></span><Check className="choice-check" aria-hidden="true"/></label><label className="rich-choice"><input type="radio" name="loadType" value="PTL" required onChange={event=>setLoadType(event.target.value)}/><Boxes aria-hidden="true"/><span><strong>PTL</strong><small>Can share truck space</small></span><Check className="choice-check" aria-hidden="true"/></label></div></fieldset>
        <fieldset className="form-group full vehicle-choice-field"><legend><Truck aria-hidden="true"/>Best cargo configuration (optional)</legend><p className="meta">Choose by picture. Leave every option unselected when any truck can work.</p><div className="vehicle-choice-grid">{VEHICLE_CONFIGURATIONS.map((configuration)=><label className="vehicle-choice" key={configuration.name}><input type="radio" name="vehicleCategory" value={configuration.name}/><Image src={configuration.image} alt={configuration.name} width={180} height={180}/><span>{configuration.name}</span><Check className="choice-check" aria-hidden="true"/></label>)}</div></fieldset>
      </div>
    </section>

    <section className="load-composer-section">
      <div className="load-step-heading"><span>2</span><Share2 aria-hidden="true"/><div><h2>Who can see it?</h2><p>Choose the transporters you want to reach.</p></div></div>
      <div className="form-grid">
        <fieldset className="form-group full"><legend><Share2 aria-hidden="true"/>Load visibility</legend><div className="rich-choice-grid three"><label className="rich-choice"><input type="radio" name="distributionMode" value="OPEN_MARKET" checked={distributionMode==='OPEN_MARKET'} onChange={event=>setDistributionMode(event.target.value)}/><Search aria-hidden="true"/><span><strong>Load Board</strong><small>All approved transporters</small></span><Check className="choice-check" aria-hidden="true"/></label><label className="rich-choice"><input type="radio" name="distributionMode" value="SAVED_PARTNERS" checked={distributionMode==='SAVED_PARTNERS'} onChange={event=>setDistributionMode(event.target.value)}/><ShieldCheck aria-hidden="true"/><span><strong>Partners</strong><small>Connected network only</small></span><Check className="choice-check" aria-hidden="true"/></label><label className="rich-choice"><input type="radio" name="distributionMode" value="DIRECT_TO_PROVIDER" checked={distributionMode==='DIRECT_TO_PROVIDER'} onChange={event=>setDistributionMode(event.target.value)}/><Send aria-hidden="true"/><span><strong>Direct</strong><small>One transporter</small></span><Check className="choice-check" aria-hidden="true"/></label></div></fieldset>
        {distributionMode === 'DIRECT_TO_PROVIDER' ? <AsyncMemberSelect id="providerRef" name="providerRef" kind="TRANSPORT" label="Selected transporter" placeholder="Start typing a transporter or driver name" initialRef={selectedProvider} initialLabel={selectedProviderLabel} required/> : null}
      </div>
    </section>

    <section className="load-composer-section">
      <div className="load-step-heading"><span>3</span><Banknote aria-hidden="true"/><div><h2>Price and tracking</h2><p>Set the offer and the updates required after assignment.</p></div></div>
      <div className="form-grid">
        <div className="form-group"><label htmlFor="price-mode"><Banknote aria-hidden="true"/>Pricing</label><select id="price-mode" name="priceMode" value={priceMode} onChange={(event) => setPriceMode(event.target.value)}><option value="QUOTE_REQUESTED">Request quotes</option><option value="FIXED_PRICE">Fixed price in ETB</option><option value="TARGET_PRICE">Target price in ETB</option></select></div>
        {priceMode === 'FIXED_PRICE' ? <div className="form-group"><label htmlFor="fixed-price">Fixed amount (ETB)</label><input id="fixed-price" name="priceEtb" type="number" min="0" step="1" required placeholder="35000"/></div> : null}
        {priceMode === 'TARGET_PRICE' ? <div className="form-group"><label htmlFor="target-price">Target amount (ETB)</label><input id="target-price" name="targetPriceEtb" type="number" min="0" step="1" required placeholder="35000"/></div> : null}
        <div className="form-group"><label htmlFor="tracking-mode"><Route aria-hidden="true"/>Tracking after assignment</label><select id="tracking-mode" name="trackingMode" defaultValue="STATUS_ONLY"><option value="STATUS_ONLY">Status timeline</option><option value="LOCATION_AND_STATUS">Approximate location + status</option></select><div className="meta">Device location uses a {loadType==='FTL'?'20':loadType==='PTL'?'40':'20 or 40'} km privacy area based on load size. Proof is handled separately.</div></div>
      </div>
    </section>
    <button className="button load-submit icon-button-label" type="submit"><Send aria-hidden="true"/>Post load</button>
  </form>;
}
