import {capacitySharingLabel} from '@/lib/capacity-sharing';
import Link from 'next/link';
import {Building2, CalendarClock, MapPinned, Phone, UserRound} from 'lucide-react';
import {Text} from './localization';
import {capacityLoadPreference,capacityLoadLabel} from '@/lib/capacity-load-preferences';
import {TruckDocumentSummary} from './truck-document-summary';
import type {VerificationBadge} from './verification-badges';
import {vehicleConfigurationImage} from '@/lib/vehicle-configurations';

type TruckDetails = {
  provider_name: string; provider_handle: string; provider_organization_id?: string | null;
  vehicle_make?: string; vehicle_model?: string; cargo_configuration?: string;
  status: string; sharing_mode?: string; assigned_driver_first_name?: string; assigned_driver_phone?: string | null;
  accepts_full_load?: boolean | number; accepts_partial_load?: boolean | number;
  contact_phone?: string | null; driver_kind_label?: string;
  capacity_updated_label?: string; location_updated_label?: string;
  capacity_confirmation_needed?: boolean; current_signal_geometry_visible?: boolean;
  owner_verification_badges?: VerificationBadge[]; driver_verification_badges?: VerificationBadge[];
  truck_verification_badges?: VerificationBadge[];
};

export function MapTruckDetails({truck}:{truck:TruckDetails}) {
  const loadPreference=capacityLoadPreference(truck.status,truck.accepts_full_load,truck.accepts_partial_load);
  return <section className="map-capacity-sheet truck-inspection" aria-label={`${truck.provider_name} truck summary`}>
    <div className="truck-inspection-hero">
      <div className="truck-inspection-image"><img src={vehicleConfigurationImage(truck.cargo_configuration)} alt=""/></div>
      <div className="truck-inspection-identity">
        <span className={`status ${truck.status==='PARTIAL'?'yellow':'green'}`}><Text message={truck.status==='PARTIAL'?'Partial capacity':'Empty truck'}/></span>
        <h3>{truck.vehicle_make} {truck.vehicle_model}</h3>
        {truck.cargo_configuration?<p><Text message={truck.cargo_configuration}/></p>:null}
        {truck.sharing_mode?<p><Text message={capacitySharingLabel(truck.sharing_mode)}/></p>:null}
        {loadPreference?<p className="truck-load-preference"><Text message={capacityLoadLabel(loadPreference)}/></p>:null}
      </div>
    </div>
    <div className="truck-inspection-people">
      <div className="truck-inspection-person transporter">
        <Building2 aria-hidden="true"/>
        <div><small><Text message="Transporter"/></small><strong>{truck.provider_name}</strong></div>
        <div className="truck-inspection-person-actions"><Link className="truck-inspection-action profile" href={`/@${truck.provider_handle}`}><Text message="Profile"/><span aria-hidden="true">↗</span></Link>{!truck.assigned_driver_phone&&truck.contact_phone?<a className="truck-inspection-action call" href={`tel:${truck.contact_phone}`}><Phone aria-hidden="true"/><Text message="Call"/></a>:null}</div>
      </div>
      <div className="truck-inspection-person driver">
        <UserRound aria-hidden="true"/>
        <div><small><Text message={truck.driver_kind_label||'Driver'}/></small><strong>{truck.assigned_driver_first_name||<Text message="Driver not named"/>}</strong>
          {truck.assigned_driver_phone?<span className="truck-inspection-phone">{truck.assigned_driver_phone}</span>:<span className="truck-inspection-phone"><Text message="Phone not published"/></span>}
        </div>
        {truck.assigned_driver_phone?<a className="truck-inspection-action call" href={`tel:${truck.assigned_driver_phone}`}><Phone aria-hidden="true"/><Text message="Call driver"/></a>:null}
      </div>
    </div>
    <div className="truck-inspection-updates">
      <div><CalendarClock aria-hidden="true"/><p>{truck.capacity_updated_label||<Text message="Capacity update unavailable"/>}</p></div>
      {truck.current_signal_geometry_visible!==false?<div><MapPinned aria-hidden="true"/><p>{truck.location_updated_label||<Text message="Location update unavailable"/>}</p></div>:null}
      {truck.capacity_confirmation_needed?<p className="truck-inspection-confirm"><Text message="Confirm availability directly."/></p>:null}
    </div>
    {truck.current_signal_geometry_visible===false?<p className="truck-inspection-private"><strong><Text message="Regular service—not current location"/></strong><Text message="Call for current details or ask the Driver to share private capacity with your email."/></p>:null}
    <div className="map-truck-documents">
      <TruckDocumentSummary label={truck.provider_organization_id?'Company documents':'Owner documents'} badges={truck.owner_verification_badges}/>
      <TruckDocumentSummary label="Driver documents" badges={truck.driver_verification_badges}/>
      <TruckDocumentSummary label="Truck documents" badges={truck.truck_verification_badges}/>
    </div>
  </section>;
}
