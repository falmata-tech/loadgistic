import { notFound, redirect } from 'next/navigation';
import { PublicHeader } from '@/components/public-header';
import { getBusinessTracking } from '@/lib/repository.js';
import { StatusPill } from '@/components/status-pill';
import { getCurrentUser, hasTrackingGrant } from '@/lib/auth';
import { TrackingIdleGuard } from '@/components/tracking-idle-guard';

export default async function TrackPage({ params }: { params: Promise<{ id: string }> }) {
  const user=await getCurrentUser();
  const { id } = await params;
  const shipment:any = getBusinessTracking(user,id);
  if (!shipment) notFound();
  if(!await hasTrackingGrant(shipment.id))redirect('/track?error=Enter+the+secret+shipment+code+to+open+tracking.');
    const radius=shipment.load_type==='FTL'?20:40;
    const shipmentSize=shipment.load_type==='FTL'?'Full Truckload (FTL)':'Partial Truckload (PTL)';
    return <><PublicHeader/><main className="section"><div className="container" style={{maxWidth:900}}><div className="page-header"><div><h1 className="page-title">Track {shipment.code}</h1><p className="page-subtitle">{shipment.origin} → {shipment.destination}</p></div><div className="stack status-stack"><StatusPill status={shipment.operational_status}/><TrackingIdleGuard shipmentId={shipment.id}/></div></div><div className="tracking-mode-banner"><strong>{shipment.tracking_mode==='LOCATION_AND_STATUS'?'Automatic location + status':'Status only'}</strong><span>{shipment.tracking_mode==='LOCATION_AND_STATUS'?`Driver device locations are generalized to a ${radius} km privacy area for this ${shipmentSize} shipment.`:'This shipment uses timestamped shipment actions.'}</span></div><div className="two-col"><section className="card"><h2 style={{fontSize:'1.4rem'}}>Shipment timeline</h2><ol className="timeline">{shipment.events.map((event:any)=><li key={`${event.event_type}-${event.created_at}`}><strong>{event.event_type==='LOCATION'?'Location update':event.event_type==='TRACKING_MODE'?'Tracking preference changed':event.status.replaceAll('_',' ')}</strong><div>{event.note||'Status updated'}</div>{event.location_area?<div className="tracking-location-line"><strong>{event.location_area}</strong><span>{event.location_source==='DEVICE_OBSCURED'?`Approximate device area · ${event.location_precision_km} km privacy zone`:'Recorded general area'}</span></div>:null}<div className="meta">{new Date(event.created_at).toLocaleString()}</div></li>)}</ol></section><aside className="card"><h3>Shipment parties</h3><p><strong>Shipper:</strong> {shipment.shipper_name}</p><p><strong>Receiver:</strong> {shipment.receiver_name || 'Not shared'}</p><p><strong>Transporter:</strong> {shipment.provider_name || shipment.provider_profile_name || 'Not yet assigned'}</p><p className="meta">Only recorded customer-safe tracking events appear here. No exact device coordinate is displayed.</p></aside></div></div></main></>;
}
