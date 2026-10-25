'use client';
import React from 'react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {Text,useTranslation} from './localization';

export function BusinessTrackingOwnerActions({endpoint,canApprove,canReview,review}:{endpoint:string;canApprove:boolean;canReview:boolean;review:{rating:number;note:string}|null}){
 const {t}=useTranslation(),router=useRouter(),[busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[notice,setNotice]=React.useState(''),[rating,setRating]=React.useState(0),[note,setNote]=React.useState(''),[terms,setTerms]=React.useState(false);
 async function save(input:{action:'APPROVE'}|{action:'REVIEW';rating:number;note:string;termsAccepted:true}){
  if(busy)return;setBusy(true);setError('');setNotice('');
  try{const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
   const result=await response.json();if(!response.ok)throw Error(result.error?.message||'Please try again.');
   setNotice(input.action==='APPROVE'?'Unloading approved. This shipment is complete.':'Your review is published.');router.refresh();
  }catch(problem){setError(problem instanceof Error?problem.message:'Please try again.');}finally{setBusy(false);}
 }
 return <>
  {error?<p className="alert error" role="alert">{t(error)}</p>:null}{notice?<p className="alert success" role="status">{t(notice)}</p>:null}
  {canApprove?<section className="card handover-approval"><h3><Text message="Approve unloading"/></h3><p><Text message="Check the unloading photo and confirm the shipment has arrived. Your approval completes this shipment."/></p><button type="button" className="button" disabled={busy} onClick={()=>void save({action:'APPROVE'})}><Text message="Approve unloading"/></button></section>:null}
  {canReview?<section className="card"><h3><Text message="Review the provider"/></h3><form className="stack" onSubmit={event=>{event.preventDefault();if(terms&&rating)void save({action:'REVIEW',rating,note,termsAccepted:true});}}><label><Text message="Rating"/><select value={rating||''} onChange={event=>setRating(Number(event.target.value))} required disabled={busy}><option value="" disabled><Text message="Choose 1–5 stars"/></option>{[5,4,3,2,1].map(value=><option value={value} key={value}>{value} {t(value===1?'star':'stars')}</option>)}</select></label><label><Text message="Comment "/><span className="meta"><Text message="(optional)"/></span><textarea value={note} onChange={event=>setNote(event.target.value)} maxLength={1000} disabled={busy}/></label><label><input type="checkbox" checked={terms} onChange={event=>setTerms(event.target.checked)} required disabled={busy}/><Text message="I agree to the Terms and content rules."/> <Link href="/terms" target="_blank"><Text message="Terms"/></Link></label><button className="button" disabled={busy||!terms||!rating}><Text message="Publish review"/></button></form></section>:review?<section className="card"><h3><Text message="Your review"/></h3><strong>{review.rating} / 5</strong><p>{review.note||t('No written comment.')}</p></section>:null}
 </>;
}
