import {Image} from 'lucide-react';

export function TrackingProofLink({shipmentId,eventId}:{shipmentId:string;eventId:string}){
  return <a className="button secondary small" href={`/api/provider-shipments/${shipmentId}/proofs/${eventId}`} target="_blank" rel="noopener noreferrer"><Image aria-hidden="true"/>Open proof<span className="sr-only"> (new tab)</span></a>;
}
