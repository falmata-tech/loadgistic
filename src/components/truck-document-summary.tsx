
import {Text} from '@/components/localization';
import { BadgeCheck, FileText } from 'lucide-react';
import { VerificationBadges, type VerificationBadge } from './verification-badges';
import { documentReviewSummary } from '@/lib/verification-summary.js';

export function TruckDocumentSummary({label,badges=[]}:{label:string;badges?:VerificationBadge[]}){
  const {reviewed,complete}=documentReviewSummary(badges);
  return <details className={`truck-document-summary ${complete?'verified':reviewed?'partly-reviewed':'unverified'}`}>
    <summary>{reviewed?<BadgeCheck aria-hidden="true"/>:<FileText aria-hidden="true"/>}<span><strong><Text message={label}/></strong><small>{badges.length?<Text message="{reviewed} of {total} reviewed" values={{reviewed,total:badges.length}}/>:<Text message="Not verified"/>}</small></span></summary>
    {badges.length?<VerificationBadges badges={badges} compact/>:<p><Text message="No current reviewed evidence."/></p>}
  </details>;
}
