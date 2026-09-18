import { BadgeCheck, FileText } from 'lucide-react';
import { VerificationBadges, type VerificationBadge } from './verification-badges';
import { documentReviewSummary } from '@/lib/verification-summary.js';

export function TruckDocumentSummary({label,badges=[]}:{label:string;badges?:VerificationBadge[]}){
  const {reviewed,complete}=documentReviewSummary(badges);
  return <details className={`truck-document-summary ${complete?'verified':reviewed?'partly-reviewed':'unverified'}`}>
    <summary>{reviewed?<BadgeCheck aria-hidden="true"/>:<FileText aria-hidden="true"/>}<span><strong>{label}</strong><small>{badges.length?`${reviewed} of ${badges.length} reviewed`:'Not verified'}</small></span></summary>
    {badges.length?<VerificationBadges badges={badges} compact/>:<p>No current reviewed evidence.</p>}
  </details>;
}
