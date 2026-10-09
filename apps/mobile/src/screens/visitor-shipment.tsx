import {useLanguage} from '../localization/provider';
import { TrackingMap } from '../components/tracking-map';
import { PrivateFile } from '../components/private-file';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { VisitorAccess } from '../components/visitor-access';
import { Page, Title, Copy, Card, Field, Button, ErrorText } from '../components/ui';
import { Choices } from '../components/choices';
import { useVisitorQuery } from '../hooks/visitor-query';
import { useVisitor } from '../session/visitor-provider';
import { statusLabel, type TrackingSummary } from '../api/tracking';
type Shipment = TrackingSummary & { provider: string; mode: string; canReview: boolean; canApprove:boolean; events: { id: string; status: string; note: string; hasProof: boolean; createdAt: string }[]; location: { latitude: number; longitude: number; area: string; radius: number; updatedAt: string } | null; review: { rating: number; note: string } | null };
export default function VisitorShipment() { const { id } = useLocalSearchParams<{ id: string }>(); return <Page><VisitorAccess scope="tracking"><ShipmentUpdates id={typeof id === 'string' ? id : ''} /></VisitorAccess></Page>; }
function ShipmentUpdates({ id }: { id: string }) {
 const {t}=useLanguage();
 const path = `/api/mobile/visitor/tracking/shipments/${encodeURIComponent(id)}`, query = useVisitorQuery<Shipment>('tracking', path), visitor = useVisitor();
 const [rating, setRating] = useState(''), [note, setNote] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
 async function approve(){if(busy)return;setBusy(true);setError('');try{await visitor.controller.request('tracking',`${path}/approve`,{});await query.reload();}catch(error){setError(error instanceof Error?error.message:'Could not confirm approval. Refresh before trying again.');}finally{setBusy(false);}}
 async function review() { if (busy) return; setBusy(true); setError(''); try { await visitor.controller.request('tracking', path, { rating: Number(rating), note }); await query.reload(); } catch (error) { setError(error instanceof Error ? error.message : 'Could not confirm the review. Refresh before trying again.'); } finally { setBusy(false); } }
 const data = query.data;
 return <><ErrorText message={query.error} />{query.loading && <ActivityIndicator accessibilityLabel="Loading shipment updates" />}<Button secondary message="Refresh updates" busy={query.loading} onPress={() => { void query.reload(); }} />
  {data && <><Title>{data.origin} → {data.destination}</Title><Copy>{data.code} · {t(statusLabel(data.status))}</Copy><Copy>{data.provider} · {data.truck}</Copy><Copy>{data.cargo}</Copy><Copy message={"Updates come from your transporter. Confirm timing and transport arrangements directly with them."}/>
   {data.mode === 'LOCATION_AND_STATUS' && <Card><Title message={"Approximate location"}/><Copy>{data.location ? `${data.location.area} · ${data.location.radius} km radius\nUpdated ${new Date(data.location.updatedAt).toLocaleString()}` : 'Waiting for the driver’s approximate location.'}</Copy>{data.location && <TrackingMap location={data.location} />}</Card>}
   <Card><Title message={"Shipment progress"}/>{data.events.map(event => <View key={event.id} style={{ gap: 6, paddingVertical: 10 }}><Copy>{t(statusLabel(event.status))} · {new Date(event.createdAt).toLocaleString()}</Copy>{!!event.note && <Copy>{event.note}</Copy>}{event.hasProof && <PrivateFile label={t('View photo proof')} load={() => visitor.controller.request('tracking', `${path}/proof/${event.id}`)} />}</View>)}</Card>
   {data.canApprove&&<Card><Title message="Approve unloading"/><Copy message="Check the unloading photo and confirm the shipment has arrived. Your approval completes this shipment."/><ErrorText message={error}/><Button message="Approve unloading" busy={busy} onPress={()=>void approve()}/></Card>}
   {data.canReview && <Card><Title message={"Review your transporter"}/><Choices value={rating} options={[5, 4, 3, 2, 1].map(value => ({ id: String(value), label: `${value} ${value === 1 ? 'star' : 'stars'}` }))} onChange={setRating} disabled={busy} /><Field message="Review comment (optional)" value={note} onChangeText={setNote} maxLength={1000} editable={!busy} multiline /><ErrorText message={error} /><Button message="Publish review" busy={busy} disabled={!rating} onPress={() => { void review(); }} /></Card>}
   {data.review && <Card><Title message={"Your review"}/><Copy>{data.review.rating} / 5</Copy><Copy>{data.review.note || 'No written comment.'}</Copy></Card>}
  </>}
 </>;
}
