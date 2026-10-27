import {capacitySharingLabel} from '@/lib/capacity-sharing';
import Link from 'next/link';
import {Building2, CalendarClock, MapPinned, Phone} from 'lucide-react';
import {Text,useTranslation} from './localization';
import {localizedUpdateLabel} from '@/lib/i18n/update-label.js';
import {capacityLoadPreference,capacityLoadLabel} from '@/lib/capacity-load-preferences';
import {TruckDocumentSummary} from './truck-document-summary';
import type {VerificationBadge} from './verification-badges';
import {vehicleConfigurationImage} from '@/lib/vehicle-configurations';
import presentation from './public-truck-presentation.module.css';
import {PublicIdentityImage} from './public-identity-image';
import identity from './public-identity-image.module.css';
import {TruckAuthorityBadges,type TruckAuthority} from './truck-authority';
import {BusinessCargoSpacePhoto} from './cargo-space-photo-panel';

type TruckDetails = {
  provider_name: string; provider_handle: string; provider_organization_id?: string | null;
  vehicle_make?: string; vehicle_model?: string; cargo_configuration?: string;
  status: string; sharing_mode?: string; assigned_driver_first_name?: string; assigned_driver_phone?: string | null;
  accepts_full_load?: boolean | number; accepts_partial_load?: boolean | number;
  available_percent?: number | null; available_percent_reported_at?: string | null;
  contact_phone?: string | null; driver_kind_label?: string; assigned_driver_portrait_url?: string | null;
  capacity_updated_label?: string; location_updated_label?: string;
  capacity_confirmation_needed?: boolean; current_signal_geometry_visible?: boolean;
  recurring_corridors?: {geometry?: string}[];
  owner_verification_badges?: VerificationBadge[]; driver_verification_badges?: VerificationBadge[];
  truck_verification_badges?: VerificationBadge[];
  authority?:TruckAuthority|null;
};

export function MapTruckDetails({truck,privatePhoto}:{truck:TruckDetails;privatePhoto?:{workspaceId:string;vehicleId:string}}) {
  const {t}=useTranslation();
  const loadPreference=capacityLoadPreference(truck.status,truck.accepts_full_load,truck.accepts_partial_load);
  const preferredArea=truck.recurring_corridors?.length?truck.recurring_corridors.every(signal=>signal.geometry==='RADIUS'):false;
  return <section className={`map-capacity-sheet truck-inspection ${presentation.summary}`} aria-label={t('{name} vehicle summary',{name:truck.provider_name})}>
    <div className="truck-inspection-hero">
      <div className="truck-inspection-image"><img src={vehicleConfigurationImage(truck.cargo_configuration)} alt=""/></div>
      <div className="truck-inspection-identity">
        <div className="truck-inspection-status-line"><span className={`status ${truck.status==='PARTIAL'?'yellow':'green'}`}><Text message={truck.status==='PARTIAL'?'Partial capacity':'Empty vehicle'}/></span>{loadPreference?<span className="truck-load-preference"><Text message={capacityLoadLabel(loadPreference)}/></span>:null}{truck.status==='PARTIAL'&&truck.available_percent_reported_at&&typeof truck.available_percent==='number'&&Number.isInteger(truck.available_percent)?<span className="truck-load-preference"><Text message="Available space: {percent}%" values={{percent:truck.available_percent}}/></span>:null}</div>
        <h3>{truck.vehicle_make} {truck.vehicle_model}</h3>
        {truck.cargo_configuration?<p><Text message={truck.cargo_configuration}/></p>:null}
        <div className="truck-inspection-tags">{truck.sharing_mode?<span><Text message={capacitySharingLabel(truck.sharing_mode)}/></span>:null}</div>
      </div>
    </div>
    <TruckAuthorityBadges authority={truck.authority}/>
    <div className="truck-inspection-people">
      <div className="truck-inspection-person transporter">
        <Building2 aria-hidden="true"/>
        <div><small><Text message="Transport Provider"/></small><strong>{truck.provider_name}</strong></div>
        <div className="truck-inspection-person-actions"><Link className="truck-inspection-action profile" href={`/@${truck.provider_handle}`}><Text message="Profile"/><span aria-hidden="true">↗</span></Link>{!truck.assigned_driver_phone&&truck.contact_phone?<a className="truck-inspection-action call" href={`tel:${truck.contact_phone}`}><Phone aria-hidden="true"/><Text message="Call"/></a>:null}</div>
      </div>
      <div className={`truck-inspection-person driver ${identity.mapPerson}`}>
        <PublicIdentityImage path={truck.assigned_driver_portrait_url} kind="person" label={truck.assigned_driver_first_name||''} size="small"/>
        <div><small><Text message={truck.driver_kind_label||'Driver'}/></small><strong>{truck.assigned_driver_first_name||<Text message="Driver not named"/>}</strong>
          {truck.assigned_driver_phone?<span className="truck-inspection-phone">{truck.assigned_driver_phone}</span>:<span className="truck-inspection-phone"><Text message="Phone not published"/></span>}
        </div>
        {truck.assigned_driver_phone?<a className="truck-inspection-action call" href={`tel:${truck.assigned_driver_phone}`}><Phone aria-hidden="true"/><Text message="Call driver"/></a>:null}
      </div>
    </div>
    <div className="truck-inspection-updates">
      <div><CalendarClock aria-hidden="true"/><p><Text message="Planned capacity"/> · {localizedUpdateLabel(truck.capacity_updated_label,t)}</p></div>
      {truck.current_signal_geometry_visible!==false?<div><MapPinned aria-hidden="true"/><p>{localizedUpdateLabel(truck.location_updated_label,t,'location')}</p></div>:null}
      {truck.capacity_confirmation_needed?<p className="truck-inspection-confirm"><Text message="Confirm availability directly."/></p>:null}
    </div>
    {truck.current_signal_geometry_visible===false?<p className="truck-inspection-private"><strong><Text message={preferredArea?'Preferred area—not current location':'Preferred corridor—not current location'}/></strong></p>:null}
    <div className="map-truck-documents">
      <TruckDocumentSummary label={truck.provider_organization_id?'Transport Provider documents':'Owner documents'} badges={truck.owner_verification_badges}/>
      <TruckDocumentSummary label="Driver documents" badges={truck.driver_verification_badges}/>
      <TruckDocumentSummary label="Vehicle documents" badges={truck.truck_verification_badges}/>
    </div>
    {privatePhoto?<BusinessCargoSpacePhoto key={`${privatePhoto.workspaceId}:${privatePhoto.vehicleId}`} workspaceId={privatePhoto.workspaceId} vehicleId={privatePhoto.vehicleId}/>:null}
  </section>;
}
