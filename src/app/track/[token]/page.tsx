import { notFound } from 'next/navigation';
import { PublicHeader } from '@/components/public-header';
import { getTrackingByToken } from '@/lib/repository.js';
import { StatusPill } from '@/components/status-pill';

export default async function TrackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const shipment:any = getTrackingByToken(token);
  if (!shipment) notFound();
  return <><PublicHeader/><main className="section"><div className="container" style={{maxWidth:850}}><div className="page-header"><div><h1 className="page-title">Track {shipment.code}</h1><p className="page-subtitle">{shipment.origin} → {shipment.destination}</p></div><StatusPill status={shipment.operational_status}/></div><div className="two-col"><section className="card"><h2 style={{fontSize:'1.4rem'}}>Shipment timeline</h2><ol className="timeline">{shipment.events.map((event:any)=><li key={`${event.status}-${event.created_at}`}><strong>{event.status.replaceAll('_',' ')}</strong><div>{event.note}</div><div className="meta">{new Date(event.created_at).toLocaleString()}</div></li>)}</ol></section><aside className="card"><h3>Business parties</h3><p><strong>Shipper:</strong> {shipment.shipper_name}</p><p><strong>Receiver:</strong> {shipment.receiver_name || 'Not shared'}</p><p><strong>Provider:</strong> {shipment.provider_name || shipment.provider_profile_name || 'Not yet assigned'}</p><p className="meta">This page shows only customer-safe status events.</p></aside></div></div></main></>;
}
