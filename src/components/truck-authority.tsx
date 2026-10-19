import Link from 'next/link';
import {BadgeCheck,KeyRound,ShieldCheck,Truck} from 'lucide-react';
import {Text,Localized} from './localization';
import styles from './truck-authority.module.css';

export type TruckAuthority={ownership?:{verified?:boolean;reviewedAt?:string|null;expiresOn?:string|null};permission?:{verified?:boolean;reviewedAt?:string|null;expiresOn?:string|null};operatingLicence?:{verified?:boolean;reviewedAt?:string|null;expiresOn?:string|null;holderBasis?:'OWNED'|'FINANCED'|null};qualifiesProvider?:boolean};
export type ProviderPublication={canPublish:boolean;liveTruckCount:number;qualifyingTruckCount:number;qualifyingOwnershipCount?:number;qualifyingLicenceCount?:number};
export type ProviderAuthoritySummary={total:number;ownershipVerified:number;operatingLicenceVerified:number;permissionVerified:number;notYetVerified:number;financedVerified:number};
export function ProviderTruckSummary({summary}:{summary?:ProviderAuthoritySummary|null}){
 if(!summary)return null;
 return <Localized as="div" copy={["aria-label"]} className={styles.summary} aria-label="Vehicle verification"><strong><Truck aria-hidden="true"/><Text message={summary.total===1?'{count} vehicle':'{count} vehicles'} values={{count:summary.total}}/></strong><div className={styles.badges}>{summary.ownershipVerified>0?<span className={`${styles.badge} ${styles.ownership}`}><KeyRound aria-hidden="true"/><Text message="{count} ownership verified" values={{count:summary.ownershipVerified}}/></span>:null}{summary.operatingLicenceVerified>0?<span className={`${styles.badge} ${styles.licence}`}><BadgeCheck aria-hidden="true"/><Text message="{count} operating licence reviewed" values={{count:summary.operatingLicenceVerified}}/></span>:null}{summary.permissionVerified>0?<span className={`${styles.badge} ${styles.permission}`}><ShieldCheck aria-hidden="true"/><Text message="{count} permission verified" values={{count:summary.permissionVerified}}/></span>:null}{summary.notYetVerified>0?<span className={`${styles.badge} ${styles.pending}`}><Text message="{count} not yet verified" values={{count:summary.notYetVerified}}/></span>:null}</div></Localized>;
}
export function TruckAuthorityBadges({authority}:{authority?:TruckAuthority|null}){
 const badges=[
  {key:'ownership',message:'Ownership verified',icon:KeyRound,evidence:authority?.ownership},
  {key:'permission',message:'Permission verified',icon:ShieldCheck,evidence:authority?.permission},
  {key:'licence',message:authority?.operatingLicence?.holderBasis==='FINANCED'?'Financed · licence reviewed':'Operating licence reviewed',icon:BadgeCheck,evidence:authority?.operatingLicence}
 ].filter(badge=>badge.evidence?.verified===true);
 return <Localized as="div" copy={["aria-label"]} className={styles.badges} aria-label="Vehicle verification">{badges.length?badges.map(({key,message,icon:Icon,evidence})=><details key={key} className={`${styles.badge} ${styles[key]}`}><summary><Icon aria-hidden="true"/><Text message={message}/></summary><div className={styles.details}>{evidence?.reviewedAt?<span><Text message="Reviewed "/>{evidence.reviewedAt.slice(0,10)}</span>:null}{evidence?.expiresOn?<span><Text message="Expires "/>{evidence.expiresOn}</span>:null}<span><Text message="Reviewed for this provider and vehicle."/></span></div></details>):<span className={`${styles.badge} ${styles.pending}`}><ShieldCheck aria-hidden="true"/><Text message="Not yet verified. Confirm details directly."/></span>}</Localized>;
}
export function ProviderPublicationNotice({publication}:{publication:ProviderPublication}){
 if(publication.canPublish)return null;
 return <div className="permission-note"><ShieldCheck aria-hidden="true"/><div><strong><Text message="Publish more vehicles"/></strong><span><Text message="One vehicle can go live without reviewed documents. To publish more, verify ownership or an operating licence in your name for a vehicle you own or are financing."/></span></div></div>;
}
export function TruckPublicationControl({vehicleId,state,publication,returnTo}:{vehicleId:string;state?:string|null;publication:ProviderPublication;returnTo?:string}){
 const live=state==='LIVE',paused=publication.qualifyingTruckCount===0&&publication.liveTruckCount>1;
 return <Localized as="section" copy={["aria-label"]} className="card stack" aria-label="Vehicle publication"><div className="page-header compact-header"><div><h2><Truck aria-hidden="true"/><Text message={live?'Live':'Draft'}/></h2><p className="meta"><Text message={live?(paused?'Visibility is paused. Keep one vehicle live or complete verification.':'Capacity follows the sharing settings you choose.'):'This vehicle is saved privately. Take it live when you are ready.'}/></p></div><form action={`/api/fleet/vehicles/${vehicleId}/publication`} method="post"><input type="hidden" name="state" value={live?'DRAFT':'LIVE'}/><input type="hidden" name="returnTo" value={returnTo||`/app/fleet/${vehicleId}`}/><button className={`button ${live?'secondary':'success'}`} disabled={!live&&!publication.canPublish}><Text message={live?'Move to draft':'Go live'}/></button></form></div>{!publication.canPublish?<><ProviderPublicationNotice publication={publication}/><Link className="button secondary small" href={`/app/fleet/${vehicleId}?view=documents#truck-documents`}><Text message="Vehicle documents"/></Link></>:null}</Localized>;
}
