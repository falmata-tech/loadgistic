
import {Text} from '@/components/localization';
import {Image} from 'lucide-react';

export function TrackingProofLink({shipmentId,eventId}:{shipmentId:string;eventId:string}){
  return <a className="button secondary small" href={`/api/provider-shipments/${shipmentId}/proofs/${eventId}`} target="_blank" rel="noopener noreferrer"><Image aria-hidden="true"/><Text message="Open proof"/><span className="sr-only"><Text message=" (new tab)"/></span></a>;
}
