import { BadgeCheck, Building2, CalendarClock, IdCard, KeyRound, MapPinned, Shield, Star } from 'lucide-react';

const labels: Record<string,string> = {
  IDENTITY: 'National ID',
  BUSINESS_LICENSE: 'Business License',
  BUSINESS_ADDRESS: 'Business Address',
  DRIVER_IDENTITY: 'Driver license',
  VEHICLE_OWNERSHIP: 'Vehicle ownership',
  VEHICLE_AUTHORIZATION: 'Owner authorization',
  VEHICLE_AUTHORITY: 'Truck authority',
  TRUCK_AUTHORIZATION: 'Truck Authorization'
};

const icons:Record<string,typeof Shield>={
  IDENTITY:IdCard,
  BUSINESS_LICENSE:Building2,
  BUSINESS_ADDRESS:MapPinned,
  DRIVER_IDENTITY:BadgeCheck,
  VEHICLE_OWNERSHIP:KeyRound,
  VEHICLE_AUTHORIZATION:KeyRound,
  VEHICLE_AUTHORITY:KeyRound,
  TRUCK_AUTHORIZATION:KeyRound
};

type VerificationBadge={type:string;verified:boolean;expired?:boolean;reviewedAt?:string|null;expiresOn?:string|null;vehicleLabel?:string|null};

export function VerificationBadges({badges,compact=false,label,reviewCount=0,averageRating=null}:{badges?:VerificationBadge[];compact?:boolean;label?:string;reviewCount?:number;averageRating?:number|null}) {
  if (!badges?.length&&!reviewCount) return null;
  return <div className="verification-group">
    {label?<strong className="verification-group-label">{label}</strong>:null}
    <div className={`verification-badges ${compact?'compact':''}`}>
    {(badges||[]).map((badge)=>{
      const Icon=icons[badge.type]||Shield;
      const state=badge.verified?'verified':badge.expired?'expired':'unverified';
      const stateLabel=badge.verified?'Loadgistic reviewed':badge.expired?'Expired':'Not verified';
      return <details className={`verification-badge ${state} badge-${badge.type.toLowerCase().replaceAll('_','-')}`} key={`${badge.type}:${badge.vehicleLabel||''}`} title={`${labels[badge.type]||badge.type}: ${badge.verified?'Verified':badge.expired?'Expired':'Not verified'}`}>
        <summary><Icon aria-hidden="true"/><span>{labels[badge.type]||badge.type.replaceAll('_',' ')}</span><small>{stateLabel}</small></summary>
        <div className="verification-badge-details"><strong>{stateLabel}</strong>{badge.vehicleLabel?<span>{badge.vehicleLabel}</span>:null}{badge.reviewedAt?<span>Reviewed {new Date(badge.reviewedAt).toLocaleDateString()}</span>:null}{badge.expiresOn?<span><CalendarClock aria-hidden="true"/>Expires {badge.expiresOn}</span>:null}<span>This badge confirms only this named document category.</span></div>
      </details>;
    })}
    {reviewCount?<span className="verification-badge verified reputation" title={`${averageRating || 0} of 5 from ${reviewCount} published reviews`}><Star aria-hidden="true"/><span>{averageRating} / 5</span><small>{reviewCount} published {reviewCount===1?'review':'reviews'}</small></span>:null}
    </div>
  </div>;
}
