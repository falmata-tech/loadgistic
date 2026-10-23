'use client';
import React from 'react';
import {z} from 'zod';
import {BadgeCheck,ShieldCheck} from 'lucide-react';
import {DatePicker} from './date-picker';
import {Text,Localized} from './localization';
import styles from './truck-authority.module.css';

const fact=z.enum(['OWNERSHIP','PERMISSION','OPERATING_LICENCE']);
const contextSchema=z.object({
  requestId:z.string().uuid(),contextRevision:z.string().regex(/^[a-f0-9]{64}$/),vehicleId:z.string().uuid(),vehicleLabel:z.string(),
  providerKind:z.string(),providerId:z.string().uuid(),providerName:z.string(),
  supportedFacts:z.array(fact).max(3),hasMoreHistory:z.boolean(),
  reviews:z.array(z.object({id:z.string().uuid(),factKind:fact,holderBasis:z.enum(['OWNED','FINANCED']).nullable(),
    expiresOn:z.string().nullable(),reviewedAt:z.string(),revokedAt:z.string().nullable(),
    reviewNote:z.string(),revocationReason:z.string().nullable(),current:z.boolean()})).max(20)
});
const labels={OWNERSHIP:'Ownership verified',PERMISSION:'Permission to drive and manage',OPERATING_LICENCE:'Operating licence in provider’s name'};
export function ProviderAuthorityReview({requestId,context,returnTo,sourceExpiresOn}:{requestId:string;context:unknown;returnTo:string;sourceExpiresOn?:string|null}){
  const parsed=contextSchema.safeParse(context);
  const [selected,setSelected]=React.useState('OWNERSHIP' as z.infer<typeof fact>);
  const available=parsed.success&&parsed.data.requestId===requestId?parsed.data:null;
  const selectedFact=available?.supportedFacts.includes(selected)?selected:available?.supportedFacts[0];
  if(!available)return null;
  const expiryRequired=selectedFact==='PERMISSION'||selectedFact==='OPERATING_LICENCE';
  const existingReview=available.reviews.some(review=>review.factKind===selectedFact&&!review.revokedAt);
  return <Localized as="section" copy={["aria-label"]} className="stack" aria-label="Vehicle relationship review">
    <div className="section-heading-icon"><ShieldCheck aria-hidden="true"/><div><h3><Text message="Vehicle relationship"/></h3><p className="meta">{available.providerName} · {available.vehicleLabel}</p></div></div>
    {available.supportedFacts.length?<form action={`/api/admin/verifications/${requestId}/authority`} method="post" className="form-card stack">
      <input type="hidden" name="action" value="CONFIRM"/><input type="hidden" name="returnTo" value={returnTo}/><input type="hidden" name="contextRevision" value={available.contextRevision}/>
      <div className="form-grid">
        <div className="form-group"><label htmlFor={`authority-fact-${requestId}`}><Text message="What this document confirms"/></label><select id={`authority-fact-${requestId}`} name="factKind" value={selectedFact} onChange={event=>setSelected(event.target.value as z.infer<typeof fact>)}>{available.supportedFacts.map(kind=><option value={kind} key={kind}><Text message={labels[kind]}/></option>)}</select></div>
        {selectedFact==='OPERATING_LICENCE'?<div className="form-group"><label htmlFor={`authority-basis-${requestId}`}><Text message="Vehicle purchase"/></label><select id={`authority-basis-${requestId}`} name="holderBasis" defaultValue="" required><option value="" disabled><Text message="Choose"/></option><option value="OWNED"><Text message="Owned"/></option><option value="FINANCED"><Text message="Financed purchase"/></option></select></div>:null}
        {expiryRequired?<div className="form-group"><label htmlFor={`authority-expiry-${requestId}`}><Text message="Valid until"/></label><DatePicker id={`authority-expiry-${requestId}`} name="expiresOn" defaultValue={sourceExpiresOn||''} max={sourceExpiresOn||undefined} required/></div>:null}
        <div className="form-group full"><label htmlFor={`authority-note-${requestId}`}><Text message="What you checked"/></label><textarea id={`authority-note-${requestId}`} name="reviewNote" minLength={5} maxLength={500} required/></div>
      </div>
      <label className={`checkbox-control ${styles.confirmation}`}><input type="checkbox" name="confirmed" value="1" required/><Text message="I checked this document against the named provider and this vehicle."/></label>
      {existingReview?<p className="meta"><Text message="Revoke the previous review before confirming changes."/></p>:null}
      <button className="button icon-button-label" disabled={existingReview}><BadgeCheck aria-hidden="true"/><Text message="Confirm relationship"/></button>
    </form>:null}
    {available.reviews.map(review=><div className="card stack" key={review.id}><div><strong><Text message={labels[review.factKind]}/></strong><p className="meta"><Text message={review.current?'Current':review.revokedAt?'Revoked':'No longer current'}/> · {review.reviewedAt.slice(0,10)}{review.expiresOn?` · ${review.expiresOn}`:''}</p><p>{review.reviewNote}</p></div>{review.revokedAt?<p className="meta">{review.revocationReason}</p>:<form action={`/api/admin/verifications/${requestId}/authority`} method="post" className="stack"><input type="hidden" name="action" value="REVOKE"/><input type="hidden" name="authorityReviewId" value={review.id}/><input type="hidden" name="returnTo" value={returnTo}/><div className="form-group"><label htmlFor={`authority-revoke-${review.id}`}><Text message="Reason for revocation"/></label><input id={`authority-revoke-${review.id}`} name="reason" minLength={5} maxLength={500} required/></div><button className="button danger"><Text message="Revoke relationship review"/></button></form>}</div>)}
    {available.hasMoreHistory?<p className="meta"><Text message="Showing the latest relationship reviews."/></p>:null}
  </Localized>;
}
