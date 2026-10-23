
'use client';

import React from 'react';
import {Image} from 'lucide-react';
import {Text,useTranslation} from '@/components/localization';
import {TrackingDetailDialog} from '@/components/tracking-detail-dialog';
import {PRIVATE_UPLOAD_MAX_BYTES} from '@/lib/upload-policy.js';
import {isDemoTrackingShipment,demoTrackingLabel} from '@/lib/demo-tracking-identity.js';

const imageTypes=new Set(['image/jpeg','image/png','image/webp']);

function TrackingProofPhoto({shipmentId,eventId}:{shipmentId:string;eventId:string}){
  const {t}=useTranslation();const [image,setImage]=React.useState(''),[error,setError]=React.useState(''),[attempt,setAttempt]=React.useState(0);
  React.useEffect(()=>{
    const controller=new AbortController();let objectUrl='';let mounted=true;
    const timeout=window.setTimeout(()=>controller.abort(),15000);setImage('');setError('');
    void (async()=>{
      try{
        const response=await fetch(`/api/provider-shipments/${shipmentId}/proofs/${eventId}`,{credentials:'same-origin',cache:'no-store',signal:controller.signal});
        if(!response.ok)throw new Error(response.status===404||response.status===401||response.status===403?'Proof is unavailable or access has expired.':'The proof could not be opened. Please retry.');
        const mime=response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()||'';
        if(!imageTypes.has(mime))throw new Error('The proof could not be opened. Please retry.');
        if(Number(response.headers.get('content-length'))>PRIVATE_UPLOAD_MAX_BYTES)throw new Error('The proof could not be opened. Please retry.');
        const blob=await response.blob();if(controller.signal.aborted||!mounted)return;
        if(!blob.size||blob.size>PRIVATE_UPLOAD_MAX_BYTES)throw new Error('The proof could not be opened. Please retry.');
        objectUrl=URL.createObjectURL(blob);setImage(objectUrl);
      }catch(problem){
        if(!mounted)return;
        setError(problem instanceof Error&&problem.message==='Proof is unavailable or access has expired.'?problem.message:'The proof could not be opened. Please retry.');
      }finally{window.clearTimeout(timeout);}
    })();
    return()=>{mounted=false;controller.abort();window.clearTimeout(timeout);if(objectUrl)URL.revokeObjectURL(objectUrl);};
  },[shipmentId,eventId,attempt]);
  return <>{error?<div className="tracking-proof-error"><p role="alert"><Text message={error}/></p><button type="button" className="button secondary" onClick={()=>setAttempt((value:number)=>value+1)}><Text message="Try again"/></button></div>:image?<img className="tracking-proof-photo" src={image} alt={t('Shipment proof photo')} onError={()=>setError('The proof could not be opened. Please retry.')}/>:<p className="tracking-proof-loading" role="status"><Text message="Opening proof…"/></p>}</>;
}

export function TrackingProofLink({shipmentId,eventId}:{shipmentId:string;eventId:string}){
  const [open,setOpen]=React.useState(false),[ready,setReady]=React.useState(false);
  const demo=isDemoTrackingShipment(shipmentId);
  React.useEffect(()=>setReady(true),[]);
  return <><button type="button" className="button secondary small" disabled={!ready} onClick={()=>setOpen(true)}><Image aria-hidden="true"/><Text message={demo?demoTrackingLabel('proof'):'Open proof'}/></button>
    {open?<TrackingDetailDialog title={demo?demoTrackingLabel('proof'):'Shipment proof'} closeLabel="Close proof" className="tracking-proof-dialog" onClose={()=>setOpen(false)}><TrackingProofPhoto shipmentId={shipmentId} eventId={eventId}/></TrackingDetailDialog>:null}
  </>;
}
