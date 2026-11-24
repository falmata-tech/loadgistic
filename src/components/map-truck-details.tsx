import {capacitySharingLabel} from '@/lib/capacity-sharing';
import {Building2, CalendarClock, MapPinned, Phone} from 'lucide-react';
import {Text,useTranslation} from './localization';
import {localizedUpdateLabel} from '@/lib/i18n/update-label.js';
import {capacityCoverageLabel} from '@/lib/capacity-coverage-label.js';
import {CapacityCoverageIndicators} from './capacity-coverage-indicators';
import {capacityLoadPreference} from '@/lib/capacity-load-preferences';
import {availableSpacePercent,emptyShipmentPreferenceLabel} from '@/lib/capacity-space-estimate.js';
import {TruckDocumentSummary} from './truck-document-summary';
import type {VerificationBadge} from './verification-badges';
import {vehicleConfigurationImage} from '@/lib/vehicle-configurations';
import {PublicIdentityImage} from './public-identity-image';
import {TruckAuthorityBadges,type TruckAuthority} from './truck-authority';
import {BusinessCargoSpacePhoto} from './cargo-space-photo-panel';

type TruckDetails = {
  provider_name: string; provider_handle: string; account_is_demo?:boolean;
  vehicle_make?: string; vehicle_model?: string; cargo_configuration?: string;
  status: string; sharing_mode?: string; assigned_driver_first_name?: string; assigned_driver_phone?: string | null;
  accepts_full_load?: boolean | number; accepts_partial_load?: boolean | number;
  available_percent?: number | null; available_percent_reported_at?: string | null;
  contact_phone?: string | null; driver_kind_label?: string; assigned_driver_portrait_url?: string | null;
  capacity_updated_label?: string; location_updated_label?: string;
  capacity_confirmation_needed?: boolean; current_signal_geometry_visible?: boolean;
  availability_geometry?:string|null; current_route_points?:unknown[]; capacity_area_boundary?:unknown[];
  recurring_corridors?: {geometry?:string; route_points?:unknown[]; area_boundary?:unknown[]}[];
  driver_verification_badges?: VerificationBadge[];
  truck_verification_badges?: VerificationBadge[];
  authority?:TruckAuthority|null;
};

export function MapTruckDetails({truck,privatePhoto}:{truck:TruckDetails;privatePhoto?:{workspaceId:string;vehicleId:string}}) {
  const {t}=useTranslation();
  const percent=availableSpacePercent(truck.status,truck.available_percent,truck.available_percent_reported_at);
  const loadLabel=emptyShipmentPreferenceLabel(percent,capacityLoadPreference(truck.status,truck.accepts_full_load,truck.accepts_partial_load));
  const visible=truck.current_signal_geometry_visible!==false;
  const planned=visible?capacityCoverageLabel('planned',truck.availability_geometry,truck.availability_geometry==='ROUTE'?truck.current_route_points:truck.capacity_area_boundary):null;
  const regular=truck.recurring_corridors?.[0];
  const preferred=capacityCoverageLabel('preferred',regular?.geometry,regular?.geometry==='ROUTE'?regular.route_points:regular?.area_boundary);
  return <section className="map-capacity-sheet truck-inspection" aria-label={t('{name} vehicle summary',{name:truck.provider_name})}>
    <div className="truck-inspection-hero">
      <div className="truck-inspection-image"><img src={vehicleConfigurationImage(truck.cargo_configuration)} alt=""/></div>
      <div className="truck-inspection-identity">
        <h3>{truck.vehicle_make} {truck.vehicle_model}</h3>
        <div className="truck-inspection-tags">
          {truck.cargo_configuration?<span><Text message={truck.cargo_configuration}/></span>:null}
          {truck.sharing_mode?<span><Text message={capacitySharingLabel(truck.sharing_mode)}/></span>:null}
        </div>
        <div className="truck-inspection-status-line">
          <span className={`status ${truck.status==='PARTIAL'?'partial':'empty'}`}>{percent===null?<Text message="Available space not reported"/>:<Text message="Available space: {percent}%" values={{percent}}/>}</span>
          {loadLabel?<span className="truck-load-preference"><Text message={loadLabel}/></span>:null}
        </div>
      </div>
    </div>
    <div className="truck-inspection-flags">
      <TruckAuthorityBadges authority={truck.authority}/>
      <CapacityCoverageIndicators planned={planned} preferred={preferred}/>
    </div>
    <div className="truck-inspection-people">
      <div className="truck-inspection-person transporter">
        <Building2 aria-hidden="true"/>
        <div><small><Text message="Transport Provider"/></small><strong>{truck.provider_name}</strong>{truck.account_is_demo===true?<small><Text message="Demo account"/></small>:null}</div>
        <div className="truck-inspection-person-actions"><a className="truck-inspection-action profile" href={`/@${truck.provider_handle}`}><Text message="Profile"/><span aria-hidden="true">↗</span></a>{!truck.assigned_driver_phone&&truck.contact_phone?<a className="truck-inspection-action call" href={`tel:${truck.contact_phone}`}><Phone aria-hidden="true"/><Text message="Call"/></a>:null}</div>
      </div>
      <div className="truck-inspection-person driver">
        <PublicIdentityImage path={truck.assigned_driver_portrait_url} kind="person" label={truck.assigned_driver_first_name||''} size="small" className="truck-inspection-avatar"/>
        <div><small><Text message={truck.driver_kind_label||'Driver'}/></small><strong>{truck.assigned_driver_first_name||<Text message="Driver not named"/>}</strong>
          {truck.assigned_driver_phone?<span className="truck-inspection-phone">{truck.assigned_driver_phone}</span>:<span className="truck-inspection-phone"><Text message="Phone not published"/></span>}
        </div>
        {truck.assigned_driver_phone?<a className="truck-inspection-action call" href={`tel:${truck.assigned_driver_phone}`}><Phone aria-hidden="true"/><Text message="Call driver"/></a>:null}
      </div>
    </div>
    <div className="truck-inspection-updates">
      <div><CalendarClock aria-hidden="true"/><p>{localizedUpdateLabel(truck.capacity_updated_label,t)}</p></div>
      {truck.current_signal_geometry_visible!==false?<div><MapPinned aria-hidden="true"/><p>{localizedUpdateLabel(truck.location_updated_label,t,'location')}</p></div>:null}
      {truck.capacity_confirmation_needed?<p className="truck-inspection-confirm"><Text message="Confirm availability directly."/></p>:null}
    </div>
    {!visible&&preferred?<p className="truck-inspection-private"><Text message="Current vehicle location isn’t shared."/></p>:null}
    {privatePhoto?<BusinessCargoSpacePhoto key={`${privatePhoto.workspaceId}:${privatePhoto.vehicleId}`} workspaceId={privatePhoto.workspaceId} vehicleId={privatePhoto.vehicleId}/>:null}
    <div className="map-truck-documents">
      <TruckDocumentSummary label="Driver documents" badges={truck.driver_verification_badges}/>
      <TruckDocumentSummary label="Vehicle documents" badges={truck.truck_verification_badges}/>
    </div>
  </section>;
}
