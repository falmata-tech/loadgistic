"use client";

import React from 'react';
import Image from 'next/image';
import { VEHICLE_CONFIGURATIONS } from '@/lib/vehicle-configurations';

type Option = { id: string; name: string; type?: string; ref_kind?: string };

export function ShipmentForm({
  workspaceName,
  businesses,
  providers,
  selectedProvider,
  minDate
}: {
  workspaceName: string;
  businesses: Option[];
  providers: Option[];
  selectedProvider: string;
  minDate: string;
}) {
  const [distributionMode, setDistributionMode] = React.useState(selectedProvider ? 'DIRECT_TO_PROVIDER' : 'OPEN_MARKET');
  const [priceMode, setPriceMode] = React.useState('QUOTE_REQUESTED');

  return <form action="/api/shipments" method="post" className="form-card stack" data-testid="new-shipment-form">
    <input type="hidden" name="serviceMode" value="FREIGHT"/>

    <div className="form-section">
      <div><h2>Shipment details</h2><p className="meta">Tell transporters what needs to move and where it is going.</p></div>
      <div className="form-grid">
        <div className="form-group full"><label htmlFor="shipment-title">Shipment title</label><input id="shipment-title" name="title" required placeholder="Example: Retail cartons to Hawassa branch"/></div>
        <div className="form-group"><label htmlFor="business-account">Business account</label><input id="business-account" value={workspaceName} readOnly/></div>
        <div className="form-group"><label htmlFor="receiver-organization">Recipient business (optional)</label><select id="receiver-organization" name="receiverOrganizationId"><option value="">External or not selected</option>{businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}</select></div>
        <div className="route-inputs full"><div className="form-group"><label htmlFor="shipment-origin">Origin city</label><input id="shipment-origin" name="origin" required placeholder="Addis Ababa"/></div><div className="route-arrow" aria-hidden="true">→</div><div className="form-group"><label htmlFor="shipment-destination">Destination city</label><input id="shipment-destination" name="destination" required placeholder="Hawassa"/></div></div>
        <div className="form-group"><label htmlFor="pickup-date">Pickup date</label><input id="pickup-date" name="pickupDate" type="date" min={minDate} required/></div>
        <div className="form-group"><label htmlFor="delivery-date">Desired delivery date (optional)</label><input id="delivery-date" name="deliveryDate" type="date" min={minDate}/></div>
        <div className="form-group full"><label htmlFor="cargo-description">Cargo description</label><textarea id="cargo-description" name="cargoDescription" required placeholder="Boxes, pallets, produce, materials, or other freight. Keep sensitive details out."/></div>
        <input type="hidden" name="packageCount" value="1"/>
        <div className="form-group"><label htmlFor="freight-weight">Estimated weight in kg (optional)</label><input id="freight-weight" name="estimatedWeight" type="number" min="0" step="0.1"/></div>
        <fieldset className="form-group full vehicle-choice-field"><legend>Cargo configuration (optional)</legend><div className="vehicle-choice-grid"><label className="vehicle-choice none"><input type="radio" name="vehicleCategory" value="" defaultChecked/><span>No preference</span></label>{VEHICLE_CONFIGURATIONS.map((configuration)=><label className="vehicle-choice" key={configuration.name}><input type="radio" name="vehicleCategory" value={configuration.name}/><Image src={configuration.image} alt="" width={180} height={180}/><span>{configuration.name}</span></label>)}</div></fieldset>
        <fieldset className="form-group full"><legend>Load requirement</legend><div className="segmented-control"><label><input type="radio" name="loadType" value="FTL" required/><span>FTL · Full truckload</span></label><label><input type="radio" name="loadType" value="PTL" required/><span>PTL · Partial truckload</span></label></div></fieldset>
      </div>
    </div>

    <div className="form-section">
      <div><h2>Share with transporters</h2><p className="meta">Only logged-in, approved transporters can see shipment demand.</p></div>
      <div className="form-grid">
        <div className="form-group"><label htmlFor="distribution-mode">Demand visibility</label><select id="distribution-mode" name="distributionMode" value={distributionMode} onChange={(event) => setDistributionMode(event.target.value)}><option value="OPEN_MARKET">Open to logged-in transporters</option><option value="SAVED_PARTNERS">Saved relationships only</option><option value="DIRECT_TO_PROVIDER">Direct to one transporter</option></select></div>
        {distributionMode === 'DIRECT_TO_PROVIDER' ? <div className="form-group"><label htmlFor="providerRef">Selected transporter</label><select id="providerRef" name="providerRef" defaultValue={selectedProvider} required><option value="">Choose a transporter</option>{providers.map((provider) => <option key={`${provider.ref_kind}-${provider.id}`} value={`${provider.ref_kind}:${provider.id}`}>{provider.name}</option>)}</select></div> : null}
      </div>
    </div>

    <div className="form-section">
      <div><h2>Price and updates</h2><p className="meta">Ask for a quote or share a clear ETB amount.</p></div>
      <div className="form-grid">
        <div className="form-group"><label htmlFor="price-mode">Pricing</label><select id="price-mode" name="priceMode" value={priceMode} onChange={(event) => setPriceMode(event.target.value)}><option value="QUOTE_REQUESTED">Quote requested</option><option value="FIXED_PRICE">Fixed price in ETB</option><option value="TARGET_PRICE">Target price in ETB</option></select></div>
        {priceMode === 'FIXED_PRICE' ? <div className="form-group"><label htmlFor="fixed-price">Fixed amount (ETB)</label><input id="fixed-price" name="priceEtb" type="number" min="0" step="1" required placeholder="35000"/></div> : null}
        {priceMode === 'TARGET_PRICE' ? <div className="form-group"><label htmlFor="target-price">Target amount (ETB)</label><input id="target-price" name="targetPriceEtb" type="number" min="0" step="1" required placeholder="35000"/></div> : null}
        <div className="form-group"><label htmlFor="tracking-mode">Tracking required after assignment</label><select id="tracking-mode" name="trackingMode" defaultValue="STATUS_ONLY"><option value="STATUS_ONLY">Status timeline</option><option value="LOCATION_AND_STATUS">Approximate location + status</option></select><div className="meta">Location uses a general area or a device area obscured within 40 km. Proof is managed separately.</div></div>
      </div>
    </div>
    <button className="button" type="submit">Create shipment</button>
  </form>;
}
