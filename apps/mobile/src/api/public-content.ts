export type PublicBadge={type:string;reviewed:boolean;expired:boolean;reviewedAt:string;expiresOn:string};
export type TruckAuthority={ownership:{verified:boolean;reviewedAt:string|null;expiresOn:string|null};permission:{verified:boolean;reviewedAt:string|null;expiresOn:string|null};operatingLicence:{verified:boolean;reviewedAt:string|null;expiresOn:string|null;holderBasis:'OWNED'|'FINANCED'|null};qualifiesProvider:boolean};
export type ProviderAuthoritySummary={total:number;ownershipVerified:number;operatingLicenceVerified:number;financedVerified:number;permissionVerified:number;notYetVerified:number};
export type PublicTruck={authority?:TruckAuthority|null;number:string;name:string;configuration:string;image:string;driver:string;portrait:string;driverKind:string;phone:string;driverBadges:PublicBadge[];truckBadges:PublicBadge[];regular:{kind:'AREA'|'ROUTE';places:string[]}|null;capacity:{status:string;updated:string;locationUpdated:string;origin:string;destination:string}|null};
export type PublicProvider={authoritySummary?:ProviderAuthoritySummary|null;name:string;accountName?:string;managerName?:string;handle:string;kind:string;isCompany:boolean;headline:string;about:string;services:string;city:string;image:string;contacts:{phone:string;whatsapp:string;email:string;website:string};youtubeId:string;badges:PublicBadge[];regular:{kind:string;places:string[]}|null;reviewCount:number;averageRating:number|null;reviews:{id?:string;rating:number;note:string;createdAt:string;disputed:boolean}[];fleet:{page:number;pages:number;total:number};trucks:PublicTruck[]};
export type Featured={date:string;headline:string;introduction:string;theme:string;published:boolean;tiktokUrl:string;tiktokStatus:'NOT_SCHEDULED'|'SCHEDULED'|'LIVE'|'ENDED';start:string;end:string;week:{date:string;day:string;label:string;dateLabel:string}[];programme:{kind:string;slot:number|null;label:string;startsAt:string;endsAt:string;timeLabel:string}[];trucks:{slot:number;name:string;handle:string;driver:string;driverKind:string;portrait:string;truck:string;configuration:string;image:string;place:string;available:boolean}[];sponsors:{kind:string;name:string;handle:string;description:string;website:string;phone:string;image:string}[]};
export function externalDestination(value:string):string|null{
 if(/[\x00-\x1f\x7f]/.test(value))return null;
 if(value.startsWith('tel:')){
  const number=value.slice(4),digits=number.replace(/\D/g,'');
  const legacy=/^\+?[0-9 ()-]{6,30}$/.test(number)&&digits.length>=6;
  const common=number.length<=32&&/^\+?[0-9 () .-]+$/.test(number)&&digits.length>=7;
  return legacy||common?`tel:${number.startsWith('+')?'+':''}${digits}`:null;
 }
 if(/^mailto:[^\s@<>?]+@[^\s@<>?]+\.[^\s@<>?]+$/.test(value))return value;
 try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.toString():null;}catch{return null;}
}
export function programmeState(startsAt:string,endsAt:string,now:number){const start=Date.parse(startsAt),end=Date.parse(endsAt);return !Number.isFinite(start)||!Number.isFinite(end)?'':now<start?'Upcoming':now<end?'Featured now':'Finished';}
