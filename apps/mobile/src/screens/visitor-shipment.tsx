import {AppLink} from '../components/app-link';
import {useLanguage} from '../localization/provider';
import {TrackingWorkspace} from '../components/tracking-workspace';
import {TrackingDemoLabel} from '../components/tracking-demo-label';
import {demoTrackingLabel,isDemoTrackingShipment} from '../../../../src/lib/demo-tracking-identity.js';
import {TrackingSharing} from '../components/tracking-sharing';
import { PrivateFile } from '../components/private-file';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { VisitorAccess } from '../components/visitor-access';
import { Title, Copy, Card, Field, Button, ErrorText, palette, LoadingSpinner } from '../components/ui';
import { Choices } from '../components/choices';
import { useVisitorQuery } from '../hooks/visitor-query';
import { useVisitor } from '../session/visitor-provider';
import { statusLabel } from '../api/tracking';
import {parseVisitorShipment,type VisitorShipment as Shipment} from '../api/runtime-content';
import {trackingRefreshAllowed,trackingRefreshDelay,trackingShipmentActiveStatus} from '../../../../src/lib/tracking-refresh-policy.js';
export default function VisitorShipment() { const { id } = useLocalSearchParams<{ id: string }>(); const shipmentId=typeof id === 'string' ? id : ''; return <View style={{flex:1}}><VisitorAccess scope="tracking"><ShipmentUpdates key={shipmentId} id={shipmentId} /></VisitorAccess></View>; }
function ShipmentUpdates({ id }: { id: string }) {
 const {t}=useLanguage();
 const path = `/api/mobile/visitor/tracking/shipments/${encodeURIComponent(id)}`, query = useVisitorQuery<Shipment>('tracking', path,parseVisitorShipment), visitor = useVisitor();
 const lastActive=useRef(false),failures=useRef(0);
 const {data:latest,loading,errorStatus,reload}=query;
 const status=latest?.status;
 useEffect(()=>{if(status)lastActive.current=trackingShipmentActiveStatus(status);},[status]);
 useEffect(()=>{if(query.error)failures.current=Math.min(2,failures.current+1);else if(latest)failures.current=0;},[query.error,latest]);
 const grant=visitor.snapshot.tracking,expiresAt=grant?grant.expiresAt-grant.clockOffsetMs:0;
 useFocusEffect(useCallback(()=>{
  const active=status?trackingShipmentActiveStatus(status):lastActive.current;
  const allowed=trackingRefreshAllowed({active,visible:visitor.snapshot.foreground,expiresAt,now:Date.now()});
  if(!allowed||loading||[401,403,404].includes(errorStatus))return;
  const timer=setTimeout(()=>{void reload(true);},trackingRefreshDelay(failures.current));
  return()=>clearTimeout(timer);
 },[expiresAt,status,loading,errorStatus,reload,visitor.snapshot.foreground]));
 const [rating, setRating] = useState(''), [note, setNote] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''),[termsAccepted,setTermsAccepted]=useState(false);
 async function approve(){if(busy)return;setBusy(true);setError('');try{await visitor.controller.request('tracking',`${path}/approve`,{});await query.reload();}catch(error){setError(error instanceof Error?error.message:'Could not confirm approval. Refresh before trying again.');}finally{setBusy(false);}}
 async function review() { if (busy||!termsAccepted) return; setBusy(true); setError(''); try { await visitor.controller.request('tracking', path, { rating: Number(rating), note,termsAccepted:true }); await query.reload(); } catch (error) { setError(error instanceof Error ? error.message : 'Could not confirm the review. Refresh before trying again.'); } finally { setBusy(false); } }
 const data = query.data;
 return <><ErrorText message={query.error} />{!data&&query.loading&&<LoadingSpinner accessibilityLabel="Loading shipment updates"/>}
  {!data&&!!query.error&&<Button secondary message="Refresh updates" busy={query.loading} onPress={()=>void query.reload()}/>}
  {data && <TrackingWorkspace shipmentId={id} code={data.code} status={data.status} route={data.route} location={data.location} truck={data.publicTruck} canViewLocation={data.canViewLocation} recordedStatuses={data.events.map(event=>event.status)}><Button secondary message="Refresh updates" busy={query.loading} onPress={()=>void query.reload()}/><Copy>{data.cargo}</Copy><Copy message={"Updates come from your transporter. Confirm timing and transport arrangements directly with them."}/>
   {data.canShare&&<TrackingSharing shipmentId={id}/>}<Card><Title message={"Shipment progress"}/>{data.events.map(event => <View key={event.id} style={{ gap: 6, paddingVertical: 10 }}><Copy>{t(statusLabel(event.status))} · {new Date(event.createdAt).toLocaleString()}</Copy>{isDemoTrackingShipment(id)&&<TrackingDemoLabel kind="event"/>}{!!event.note && <Copy>{event.note}</Copy>}{event.hasProof && <PrivateFile label={t(isDemoTrackingShipment(id)?demoTrackingLabel('proof'):'View photo proof')} load={() => visitor.controller.request('tracking', `${path}/proof/${event.id}`)} />}</View>)}</Card>
   {data.canApprove&&<Card><Title message="Approve unloading"/>{isDemoTrackingShipment(id)&&<TrackingDemoLabel kind="approval"/>}<Copy message="Check the unloading photo and confirm the shipment has arrived. Your approval completes this shipment."/><ErrorText message={error}/><Button message="Approve unloading" busy={busy} onPress={()=>void approve()}/></Card>}
   {data.canReview && <Card><Title message={"Review your transporter"}/><Choices value={rating} options={[5, 4, 3, 2, 1].map(value => ({ id: String(value), label: `${value} ${value === 1 ? 'star' : 'stars'}` }))} onChange={setRating} disabled={busy} /><Field message="Review comment (optional)" value={note} onChangeText={setNote} maxLength={1000} editable={!busy} multiline /><ErrorText message={error} /><Pressable accessibilityRole="checkbox" aria-checked={termsAccepted} accessibilityState={{checked:termsAccepted}} disabled={busy} onPress={()=>setTermsAccepted(!termsAccepted)} style={{minHeight:48,paddingVertical:12,flexDirection:'row',gap:10}}><Text style={{fontSize:22,color:palette.blue}}>{termsAccepted?'☑':'☐'}</Text><Text style={{flex:1,lineHeight:22,color:palette.ink}}>{t('I agree to the Terms and content rules.')}</Text></Pressable><AppLink href="/privacy" message="Privacy"/><Button message="Publish review" busy={busy} disabled={!rating||!termsAccepted} onPress={() => { void review(); }} /></Card>}
   {data.review && <Card><Title message={"Your review"}/><Copy>{data.review.rating} / 5</Copy><Copy>{data.review.note || 'No written comment.'}</Copy></Card>}
  </TrackingWorkspace>}
 </>;
}
