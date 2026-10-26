import {useLanguage} from '../localization/provider';
import {locationAreaLabel} from '../localization/location-copy';
import { AppLink } from '../components/app-link';
import { foregroundTrackingDue } from '../location/tracking-area';
import { FilePicker, PrivateFile, uploadBody, useFileSelection } from '../components/private-file';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import { Redirect, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { trackingLocationResult } from '../../../../src/lib/tracking-location-controls.js';
import { TRACKING_JOURNEY } from '../../../../src/lib/tracking-progress.js';
import { useAccount } from '../session/provider';
import { useAccountQuery } from '../hooks/account-query';
import { statusLabel, type TrackingDetail } from '../api/tracking';
import { captureCapacityLocation } from '../location/capture';
import { privacyRadii } from '../location/privacy';
import { Page, Title, Copy, Card, Field, Button, ErrorText, palette, LoadingSpinner } from '../components/ui';
import { Choices } from '../components/choices';
import {TrackingWorkspace} from '../components/tracking-workspace';
import {TrackingDemoLabel} from '../components/tracking-demo-label';
import {demoTrackingLabel,isDemoTrackingShipment} from '../../../../src/lib/demo-tracking-identity.js';
export default function ShipmentDetail() {
 const params = useLocalSearchParams<{ id?: string }>(), id = typeof params.id === 'string' ? params.id : '';
 const account = useAccount(), query = useAccountQuery<TrackingDetail>(`/api/mobile/shipments/${encodeURIComponent(id)}`);
 if (account.busy) return <Page><LoadingSpinner /></Page>;
 if (!account.session) return <Redirect href="/account" />;
 return query.data?<View style={{flex:1}}><Shipment key={account.session.user.id+id} data={query.data} reload={query.reload}/><ErrorText message={query.error}/></View>:<Page><ErrorText message={query.error}/>{!query.error&&<LoadingSpinner accessibilityLabel="Loading shipment"/>}<Button secondary message="Refresh shipment" onPress={()=>void query.reload()} busy={query.loading}/></Page>;
}
function Shipment({ data, reload }: { data: TrackingDetail; reload: () => Promise<void> }) {
 const {t}=useLanguage();
 const proof = useFileSelection();
 const account = useAccount(), [selected, setSelected] = useState(''), [note, setNote] = useState(''),[appealReason,setAppealReason]=useState('');
 const [showUpdate,setShowUpdate]=useState(false);
 const [radius, setRadius] = useState(String(Math.min(10,data.location?.radius || 10))), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''), [feedbackAt, setFeedbackAt] = useState('STATUS');
 const lock = useRef(false), active = useRef(false), generation = useRef(0), lastAttempt = useRef(0), autoUpdate = useRef<() => void>(() => undefined);
 useFocusEffect(useCallback(() => { active.current = true; return () => { active.current = false; generation.current++; }; }, []));
 useEffect(() => { const listener = AppState.addEventListener('change', state => { if (state !== 'active') generation.current++; }); return () => listener.remove(); }, []);
 const visible = (version: number) => active.current && generation.current === version && AppState.currentState === 'active';
 const locationMode = data.mode === 'LOCATION_AND_STATUS';
 const needsLocation = locationMode && ['TO_PICKUP', 'IN_TRANSIT'].includes(selected);
 const validChoice = data.nextStatuses.includes(selected);
 async function save(action: 'STATUS' | 'LOCATION') {
  if (lock.current) return;
  setFeedbackAt(action);
  if (action === 'STATUS' && (!validChoice || selected === 'ISSUE' && !note.trim())) { setError('Choose an available step. Add a note when reporting an issue.'); return; }
  if(action==='STATUS'&&['LOADING','UNLOADING'].includes(selected)&&!proof.file){setError(t('Attach photo proof when recording loading or unloading.'));return;}
  lock.current = true; setFeedbackAt(action); setBusy(true); setError(''); setMessage(''); const version = generation.current;
  try {
   const location = action === 'LOCATION' || action === 'STATUS' && needsLocation ? await captureCapacityLocation(Number(radius)) : undefined;
   // Never submit a late GPS fix after leaving the screen or locking the phone.
   if (!visible(version)) return;
   const body = action === 'STATUS' ? { action, nextStatus: selected, note, ...(location ? { location } : {}) } : { action, location };
   const result = await account.request(`/api/mobile/shipments/${data.id}`, action === 'STATUS' && proof.file && ['LOADING', 'UNLOADING', 'ISSUE'].includes(selected) ? uploadBody(body, proof.file) : body) as { recorded?: boolean; reason?: string };
   if (!visible(version)) return;
   setMessage(action === 'LOCATION' ? trackingLocationResult(result) === 'waiting' ? 'Your recent location is still current. You can update it again shortly.' : 'Approximate location saved.' : 'Status saved.');
   if (action === 'STATUS') { setSelected(''); setNote(''); proof.setFile(null); setShowUpdate(false); }
   await reload();
  } catch (error) { if (visible(version)) setError(`${error instanceof Error ? error.message : 'Could not confirm the update.'} Refresh the shipment to check its saved state before trying again.`); }
  finally { lock.current = false; setBusy(false); }
 }
 useEffect(() => { autoUpdate.current = () => {
  if (!foregroundTrackingDue({ status: data.status, canLocate: data.canLocate, mode: data.mode, foreground: active.current && AppState.currentState === 'active', busy: lock.current, lastAttempt: lastAttempt.current, lastUpdate: data.location?.updatedAt || '' })) return;
  lastAttempt.current = Date.now(); void save('LOCATION');
 }; });
 useFocusEffect(useCallback(() => {
  autoUpdate.current();
  const interval = setInterval(() => autoUpdate.current(), 10000);
  const listener = AppState.addEventListener('change', state => { if (state === 'active') autoUpdate.current(); });
  return () => { clearInterval(interval); listener.remove(); };
 }, []));
 async function appeal(){if(lock.current)return;lock.current=true;setBusy(true);setFeedbackAt('APPEAL');setError('');setMessage('');try{await account.request(`/api/mobile/shipments/${data.id}/appeal`,{reason:appealReason});await reload();setAppealReason('');setMessage('Your appeal is saved. The team can review this shipment and its proof.');}catch(error){setError(error instanceof Error?error.message:'Could not confirm the appeal. Refresh before trying again.');}finally{lock.current=false;setBusy(false);}}
 const feedback = <><ErrorText message={error} />{!!message && <Copy>{t(message)}</Copy>}</>;
 return <TrackingWorkspace presentation="provider" shipmentId={data.id} code={data.code} status={data.status} route={data.route} location={data.location} truck={data.publicTruck}><Button secondary message="Refresh shipment" onPress={()=>void reload()} busy={busy}/>
  {data.status==='UNLOADING'&&<Card><Title message="Waiting for shipment owner approval"/>{isDemoTrackingShipment(data.id)&&<TrackingDemoLabel kind="approval"/>}<Copy message="The shipment owner can approve unloading from their tracking page. If approval is delayed or disputed, ask our team to review."/>{data.canLocate&&!data.appeals?.some(item=>item.status==='OPEN')&&<><Field message="Explain the approval problem" value={appealReason} onChangeText={setAppealReason} multiline maxLength={1000} editable={!busy}/><Button message="Ask the team to review" busy={busy} disabled={appealReason.trim().length<5} onPress={()=>void appeal()}/></>}{data.appeals?.map(item=><View key={item.id}><Copy>{item.reason} · {t(item.status)}</Copy>{!!item.resolutionNote&&<Copy>{item.resolutionNote}</Copy>}</View>)}{feedbackAt==='APPEAL'&&feedback}</Card>}
  {data.nextStatuses.length>0&&!showUpdate&&<Button secondary message="Tracking update" onPress={()=>setShowUpdate(true)}/>}
  {feedbackAt==='STATUS'&&!showUpdate&&!!message&&<Copy>{t(message)}</Copy>}
  {showUpdate&&data.nextStatuses.length>0&&<Card><Title message={"Tracking update"}/>
   {TRACKING_JOURNEY.filter(status=>data.nextStatuses.includes(status)).map(status => {
    return <Pressable key={status} accessibilityRole="radio" accessibilityLabel={t(statusLabel(status))} accessibilityState={{ checked: selected === status, disabled: busy }} disabled={busy} onPress={() => { setSelected(status); proof.setFile(null); setError(''); }} style={{ padding: 14, minHeight: 60, borderWidth: 1, borderRadius: 12, borderColor: selected === status ? palette.blue : palette.border, backgroundColor: selected === status ? '#eaf1ff' : '#fff' }}><Text style={{ color: palette.ink, fontSize: 16, fontWeight: '600' }}>{selected === status ? '● ' : ''}{t(statusLabel(status))}</Text></Pressable>;
   })}
   {data.nextStatuses.includes('ISSUE') && <Button secondary message="Report an issue" busy={busy} onPress={() => { setSelected('ISSUE'); proof.setFile(null); }} />}
   {validChoice && <><Copy>{t('Selected: {status}',{status:t(statusLabel(selected))})}</Copy><Field label={t(selected === 'ISSUE' ? 'What happened? (required)' : 'Update note (optional)')} value={note} onChangeText={setNote} maxLength={1000} multiline editable={!busy} />
    {needsLocation && <Copy>{t(data.canLocate ? 'Saving this travel step also shares your approximate phone location.' : 'The assigned driver must save this travel step from their phone.')}</Copy>}
    {['LOADING', 'UNLOADING', 'ISSUE'].includes(selected) && <>{selected==='ISSUE'?<Copy message="Photo proof (optional)"/>:<Copy message="Photo proof required"/>}<FilePicker imagesOnly file={proof.file} onChange={proof.setFile} disabled={busy} /></>}
    <Button label={t('Save: {status}',{status:t(statusLabel(selected))})} busy={busy} disabled={needsLocation && !data.canLocate} onPress={() => { void save('STATUS'); }} /></>}
   {feedbackAt === 'STATUS' && feedback}
   <Button secondary message="Close" onPress={()=>{setShowUpdate(false);setSelected('');setNote('');proof.setFile(null);setError('');}}/>
  </Card>}
  {locationMode && <Card><Title message={"Approximate location"}/><Copy>{data.location ? `${locationAreaLabel(data.location.area,t)} · ${t('{radius} km radius',{radius:data.location.radius})}\n${t('Location updated {date}',{date:new Date(data.location.updatedAt).toLocaleString()})}` : t('No location shared yet.')}</Copy>
   {data.canLocate && data.nextStatuses.length > 0 && <><Copy message={"Location privacy"}/><Choices value={radius} options={privacyRadii.filter(value=>value<=10).map(value => ({ id: String(value), label: `${value} km radius` }))} onChange={setRadius} disabled={busy} /><Copy message="The assigned driver shares an approximate location until unloading is approved. This choice stays with the shipment."/><Button message="Share current location" busy={busy} onPress={() => { void save('LOCATION'); }} /></>}
   {feedbackAt === 'LOCATION' && feedback}
  </Card>}
  <Card><Title message="Shipment details"/><Copy>{data.cargo}</Copy>{!!data.pickupDate&&<Copy>{t('Pickup: {date}',{date:data.pickupDate})}</Copy>}{!!data.deliveryDate&&<Copy>{t('Delivery: {date}',{date:data.deliveryDate})}</Copy>}</Card>
  <Card><Title message="Shipment owner"/><Copy message="The shipment owner manages who can follow this shipment."/>
   {data.recipients.filter(person=>person.owner).map(person=><View key={person.id}><Copy>{person.email}</Copy></View>)}
   {data.deliveries.some(item=>item.status!=='SENT')&&<Copy message="The shipment owner's email is still awaiting delivery."/>}
  </Card>
  {data.canRecover && <AppLink href={{ pathname: '/shipment-manage', params: { id: data.id } }} style={{ paddingVertical: 14, color: palette.blue }} message="Manage shipment"/>}
  <Card><Title message={"Update history"}/>{data.events.map(event => <View key={event.id} style={{ gap: 4, paddingVertical: 8 }}><Copy>{t(statusLabel(event.status))} · {new Date(event.createdAt).toLocaleString()}</Copy>{isDemoTrackingShipment(data.id)&&<TrackingDemoLabel kind="event"/>}{!!event.note && <Copy>{event.note}</Copy>}{event.hasProof && <PrivateFile label={t(isDemoTrackingShipment(data.id)?demoTrackingLabel('proof'):'View photo proof')} load={() => account.request(`/api/mobile/shipments/${data.id}/proof/${event.id}`)} />}</View>)}</Card>
 </TrackingWorkspace>;
}
