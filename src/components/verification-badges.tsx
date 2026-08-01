import { Shield, ShieldCheck, Star } from 'lucide-react';

const labels: Record<string,string> = {
  IDENTITY: 'Identity',
  BUSINESS_LICENSE: 'Licensed Business',
  DRIVER_IDENTITY: 'Driver license',
  VEHICLE_OWNERSHIP: 'Vehicle ownership',
  VEHICLE_AUTHORIZATION: 'Owner authorization',
  VEHICLE_AUTHORITY: 'Truck authority'
};

export function VerificationBadges({badges,compact=false,label,reviewCount=0,averageRating=null}:{badges?:Array<{type:string;verified:boolean}>;compact?:boolean;label?:string;reviewCount?:number;averageRating?:number|null}) {
  if (!badges?.length&&!reviewCount) return null;
  return <div className="verification-group">
    {label?<strong className="verification-group-label">{label}</strong>:null}
    <div className={`verification-badges ${compact?'compact':''}`}>
    {(badges||[]).map((badge)=>{
      const Icon=badge.verified?ShieldCheck:Shield;
      return <span className={`verification-badge ${badge.verified?'verified':'unverified'}`} key={badge.type} title={`${labels[badge.type]||badge.type}: ${badge.verified?'Verified':'Not verified'}`}>
        <Icon aria-hidden="true"/><span>{labels[badge.type]||badge.type.replaceAll('_',' ')}</span><small>{badge.verified?'Verified':'Not verified'}</small>
      </span>;
    })}
    {reviewCount?<span className="verification-badge verified reputation" title={`${averageRating || 0} of 5 from ${reviewCount} published reviews`}><Star aria-hidden="true"/><span>{averageRating} / 5</span><small>{reviewCount} published {reviewCount===1?'review':'reviews'}</small></span>:null}
    </div>
  </div>;
}
