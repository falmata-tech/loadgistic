import { Shield, ShieldCheck } from 'lucide-react';

const labels: Record<string,string> = {
  IDENTITY: 'Identity',
  BUSINESS_LICENSE: 'Business license',
  DRIVER_IDENTITY: 'Driver identity',
  VEHICLE_OWNERSHIP: 'Vehicle ownership',
  VEHICLE_AUTHORIZATION: 'Owner authorization',
  VEHICLE_AUTHORITY: 'Vehicle authority'
};

export function VerificationBadges({badges,compact=false}:{badges?:Array<{type:string;verified:boolean}>;compact?:boolean}) {
  if (!badges?.length) return null;
  return <div className={`verification-badges ${compact?'compact':''}`}>
    {badges.map((badge)=>{
      const Icon=badge.verified?ShieldCheck:Shield;
      return <span className={`verification-badge ${badge.verified?'verified':'unverified'}`} key={badge.type} title={`${labels[badge.type]||badge.type}: ${badge.verified?'Verified':'Not verified'}`}>
        <Icon aria-hidden="true"/><span>{labels[badge.type]||badge.type.replaceAll('_',' ')}</span><small>{badge.verified?'Verified':'Not verified'}</small>
      </span>;
    })}
  </div>;
}
