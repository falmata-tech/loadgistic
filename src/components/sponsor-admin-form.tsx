"use client";

import React from 'react';
import {BadgeDollarSign} from 'lucide-react';

type SponsorCandidate={provider_key:string;name:string;base_place:string};

export function SponsorAdminForm({featureDate,candidates}:{featureDate:string;candidates:SponsorCandidate[]}){
  const [kind,setKind]=React.useState('TRANSPORTER' as 'TRANSPORTER'|'ADVERTISER');
  const outside=kind==='ADVERTISER';
  return <form action="/api/admin/featured" method="post" className="featured-sponsor-form">
    <input type="hidden" name="featureDate" value={featureDate}/>
    <div className="form-group"><label htmlFor="sponsor-kind">Sponsor type</label><select id="sponsor-kind" name="sponsorKind" value={kind} onChange={event=>setKind(event.target.value as 'TRANSPORTER'|'ADVERTISER')}><option value="TRANSPORTER">Loadgistic transporter</option><option value="ADVERTISER">Outside advertiser</option></select></div>
    {outside?<>
      <div className="form-group"><label htmlFor="sponsor-business-name">Business name</label><input id="sponsor-business-name" name="businessName" minLength={2} maxLength={100} required/></div>
      <div className="form-group sponsor-description"><label htmlFor="sponsor-description">Short description</label><textarea id="sponsor-description" name="description" minLength={10} maxLength={240} required placeholder="What the advertiser offers"/></div>
      <div className="form-group"><label htmlFor="sponsor-website">Website (optional)</label><input id="sponsor-website" name="websiteUrl" type="url" inputMode="url" placeholder="https://example.com"/></div>
      <div className="form-group"><label htmlFor="sponsor-phone">Public phone (optional)</label><input id="sponsor-phone" name="phone" type="tel" inputMode="tel" placeholder="+251…"/><small>Add a website, a phone number, or both.</small></div>
    </>:<div className="form-group sponsor-provider"><label htmlFor="sponsor-provider">Transporter</label><select id="sponsor-provider" name="providerKey" required defaultValue=""><option value="" disabled>Choose reviewed transporter</option>{candidates.map(item=><option key={item.provider_key} value={item.provider_key}>{item.name} · {item.base_place}</option>)}</select></div>}
    <div className="form-group"><label htmlFor="sponsor-position">Position</label><select id="sponsor-position" name="position" required defaultValue="1">{Array.from({length:5},(_,index)=><option key={index+1} value={index+1}>{index+1}</option>)}</select></div>
    <div className="form-group"><label htmlFor="sponsor-start">Starts</label><input id="sponsor-start" name="startsOn" type="date" defaultValue={featureDate} required/></div>
    <div className="form-group"><label htmlFor="sponsor-end">Ends</label><input id="sponsor-end" name="endsOn" type="date" defaultValue={featureDate} required/></div>
    <button className="button" name="command" value="SAVE_SPONSOR"><BadgeDollarSign aria-hidden="true"/>Schedule sponsor</button>
  </form>;
}
