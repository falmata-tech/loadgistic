"use client";

import React from 'react';
import { FileCheck2, ShieldCheck, Upload } from 'lucide-react';

type Subject = {
  subject_type:string;
  subject_id:string;
  name:string;
  type:string;
  allowed_types:string[];
};

const labels:Record<string,string>={
  IDENTITY:'Identity',
  BUSINESS_LICENSE:'Business license',
  DRIVER_IDENTITY:'Driver identity',
  VEHICLE_OWNERSHIP:'Vehicle ownership',
  VEHICLE_AUTHORIZATION:'Owner authorization'
};

export function VerificationForm({subjects}:{subjects:Subject[]}) {
  const availableSubjects=subjects.filter(subject=>subject.allowed_types.length);
  const [key,setKey]=React.useState(availableSubjects.length?`${availableSubjects[0].subject_type}:${availableSubjects[0].subject_id}`:'');
  const selected=availableSubjects.find(subject=>`${subject.subject_type}:${subject.subject_id}`===key);
  if(!availableSubjects.length)return <section className="card verification-complete"><ShieldCheck aria-hidden="true"/><div><h2>Current verification is complete</h2><p className="meta">All verification categories currently required for this workspace are approved.</p></div></section>;
  return <form action="/api/verifications" method="post" encType="multipart/form-data" className="form-card stack">
    <div className="section-heading-icon"><FileCheck2 aria-hidden="true"/><div><h2>Submit verification</h2><p className="meta">Documents are private and reviewed by Loadgistic administrators.</p></div></div>
    <div className="form-grid">
      <div className="form-group full"><label htmlFor="verification-subject">Profile, driver, or truck</label><select id="verification-subject" value={key} onChange={event=>setKey(event.target.value)} required>{availableSubjects.map(subject=><option key={`${subject.subject_type}:${subject.subject_id}`} value={`${subject.subject_type}:${subject.subject_id}`}>{subject.name} · {subject.type}</option>)}</select></div>
      <input type="hidden" name="subjectType" value={selected?.subject_type||''}/>
      <input type="hidden" name="subjectId" value={selected?.subject_id||''}/>
      <div className="form-group"><label htmlFor="verification-type">What are you verifying?</label><select id="verification-type" name="verificationType" key={key} required>{selected?.allowed_types.map(type=><option value={type} key={type}>{labels[type]||type}</option>)}</select></div>
      <div className="form-group"><label htmlFor="document-name">Document name</label><input id="document-name" name="documentName" required placeholder="Example: Business license"/></div>
      <div className="form-group full"><label htmlFor="verification-file"><Upload aria-hidden="true"/> Verification document</label><input id="verification-file" name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required/></div>
    </div>
    <button className="button icon-button-label" type="submit"><Upload aria-hidden="true"/>Submit for review</button>
  </form>;
}
