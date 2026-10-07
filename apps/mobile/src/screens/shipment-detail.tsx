import {useLanguage} from '../localization/provider';
import {locationAreaLabel} from '../localization/location-copy';
import { AppLink } from '../components/app-link';
import { foregroundTrackingDue } from '../location/tracking-area';
import { FilePicker, PrivateFile, uploadBody, useFileSelection } from '../components/private-file';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Pressable, Text, View } from 'react-native';
import { Redirect, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { trackingLocationResult } from '../../../../src/lib/tracking-location-controls.js';
import { TRACKING_JOURNEY, trackingProgress } from '../../../../src/lib/tracking-progress.js';
import { useAccount } from '../session/provider';
import { useAccountQuery } from '../hooks/account-query';
import { statusLabel, type TrackingDetail } from '../api/tracking';
import { captureCapacityLocation } from '../location/capture';
import { privacyRadii } from '../location/privacy';
import { Page, Title, Copy, Card, Field, Button, ErrorText, palette } from '../components/ui';
import { Choices } from '../components/choices';
export default function ShipmentDetail() {
 const params = useLocalSearchParams<{ id?: string }>(), id = typeof params.id === 'string' ? params.id : '';
 const account = useAccount(), query = useAccountQuery<TrackingDetail>(`/api/mobile/shipments/${encodeURIComponent(id)}`);
 if (account.busy) return <Page><ActivityIndicator /></Page>;
 if (!account.session) return <Redirect href="/account" />;
 return <Page><ErrorText message={query.error} />{!query.data && !query.error && <ActivityIndicator accessibilityLabel="Loading shipment" />}
  <Button secondary message="Refresh shipment" onPress={() => { void query.reload(); }} busy={query.loading} />
  {query.data && <Shipment key={account.session.user.id + id} data={query.data} reload={query.reload} />}
 </Page>;
}
function Shipment({ data, reload }: { data: TrackingDetail; reload: () => Promise<void> }) {
 const {t}=useLanguage();
 const proof = useFileSelection();
 const account = useAccount(), [selected, setSelected] = useState(''), [note, setNote] = useState(''), [email, setEmail] = useState('');
 const [radius, setRadius] = useState(String(data.location?.radius || 20)), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''), [feedbackAt, setFeedbackAt] = useState('STATUS');
 const lock = useRef(false), active = useRef(false), generation = useRef(0), lastAttempt = useRef(0), autoUpdate = useRef<() => void>(() => undefined);
 useFocusEffect(useCallback(() => { active.current = true; return () => { active.current = false; generation.current++; }; }, []));
 useEffect(() => { const listener = AppState.addEventListener('change', state => { if (state !== 'active') generation.current++; }); return () => listener.remove(); }, []);
 const visible = (version: number) => active.current && generation.current === version && AppState.currentState === 'active';
 const locationMode = data.mode === 'LOCATION_AND_STATUS';
 const needsLocation = locationMode && ['TO_PICKUP', 'IN_TRANSIT'].includes(selected);
 const validChoice = data.nextStatuses.includes(selected);
 async function save(action: 'STATUS' | 'LOCATION' | 'ADD_RECIPIENT' | 'REVOKE_RECIPIENT', recipientId?: string) {
  if (lock.current) return;
  setFeedbackAt(action);
  if (action === 'STATUS' && (!validChoice || selected === 'ISSUE' && !note.trim())) { setError('Choose an available step. Add a note when reporting an issue.'); return; }
  if (action === 'ADD_RECIPIENT' && !email.trim()) { setError('Enter the recipient’s email.'); return; }
  lock.current = true; setFeedbackAt(action); setBusy(true); setError(''); setMessage(''); const version = generation.current;
  try {
   const location = action === 'LOCATION' || action === 'STATUS' && needsLocation ? await captureCapacityLocation(Number(radius)) : undefined;
   // Never submit a late GPS fix after leaving the screen or locking the phone.
   if (!visible(version)) return;
   const body = action === 'STATUS' ? { action, nextStatus: selected, note, ...(location ? { location } : {}) } : action === 'LOCATION' ? { action, location } : action === 'ADD_RECIPIENT' ? { action, email: email.trim() } : { action, recipientId };
   const result = await account.request(`/api/mobile/shipments/${data.id}`, action === 'STATUS' && proof.file && ['LOADING', 'UNLOADING', 'ISSUE'].includes(selected) ? uploadBody(body, proof.file) : body) as { recorded?: boolean; reason?: string };
   if (!visible(version)) return;
   setMessage(action === 'LOCATION' ? trackingLocationResult(result) === 'waiting' ? 'Your recent location is still current. You can update it again shortly.' : 'Approximate location saved.' : action === 'ADD_RECIPIENT' ? 'Recipient added. Their access email is queued for delivery.' : action === 'REVOKE_RECIPIENT' ? 'Recipient access removed.' : 'Status saved.');
   if (action === 'STATUS') { setSelected(''); setNote(''); proof.setFile(null); } if (action === 'ADD_RECIPIENT') setEmail('');
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
 const recorded = data.events.map(item => item.status);
 const feedback = <><ErrorText message={error} />{!!message && <Copy>{t(message)}</Copy>}</>;
 return <><Title>{data.origin} → {data.destination}</Title><Copy>{data.code} · {t(statusLabel(data.status))}</Copy><Copy>{data.truck} · {data.driver}</Copy><Copy>{data.cargo}</Copy>
  {!!data.pickupDate && <Copy>{t('Pickup: {date}',{date:data.pickupDate})}</Copy>}{!!data.deliveryDate && <Copy>{t('Delivery: {date}',{date:data.deliveryDate})}</Copy>}
  <Card><Title message={"Shipment progress"}/><Copy message={"Choose the next step, then save it."}/>
   {TRACKING_JOURNEY.map(status => { const enabled = data.nextStatuses.includes(status), progress = trackingProgress(status, data.status, recorded, data.nextStatuses);
    return <Pressable key={status} accessibilityRole="radio" accessibilityLabel={`${t(statusLabel(status))} · ${t(progress)}`} accessibilityState={{ checked: selected === status, disabled: busy || !enabled }} disabled={busy || !enabled} onPress={() => { setSelected(status); proof.setFile(null); setError(''); }} style={{ padding: 14, minHeight: 60, borderWidth: 1, borderRadius: 12, borderColor: selected === status ? palette.teal : palette.border, backgroundColor: selected === status ? '#eaf5f4' : '#fff' }}><Text style={{ color: palette.ink, fontSize: 16, fontWeight: '600' }}>{progress === 'Completed' ? '✓ ' : selected === status ? '● ' : ''}{t(statusLabel(status))}</Text><Text style={{ color: progress === 'Next' ? palette.teal : palette.muted }}>{t(progress)}</Text></Pressable>;
   })}
   {data.nextStatuses.includes('ISSUE') && <Button secondary message="Report an issue" busy={busy} onPress={() => { setSelected('ISSUE'); proof.setFile(null); }} />}
   {validChoice && <><Copy>{t('Selected: {status}',{status:t(statusLabel(selected))})}</Copy><Field label={t(selected === 'ISSUE' ? 'What happened? (required)' : 'Update note (optional)')} value={note} onChangeText={setNote} maxLength={1000} multiline editable={!busy} />
    {needsLocation && <Copy>{t(data.canLocate ? 'Saving this travel step also shares your approximate phone location.' : 'The assigned driver must save this travel step from their phone.')}</Copy>}
    {['LOADING', 'UNLOADING', 'ISSUE'].includes(selected) && <><Copy message={"Photo proof (optional)"}/><FilePicker imagesOnly file={proof.file} onChange={proof.setFile} disabled={busy} /></>}
    <Button label={t('Save: {status}',{status:t(statusLabel(selected))})} busy={busy} disabled={needsLocation && !data.canLocate} onPress={() => { void save('STATUS'); }} /></>}
   {!data.nextStatuses.length && <Copy message={"This shipment is closed."}/>}{feedbackAt === 'STATUS' && feedback}
  </Card>
  {locationMode && <Card><Title message={"Approximate location"}/><Copy>{data.location ? `${locationAreaLabel(data.location.area,t)} · ${t('{radius} km radius',{radius:data.location.radius})}\n${t('Location updated {date}',{date:new Date(data.location.updatedAt).toLocaleString()})}` : t('No location shared yet.')}</Copy>
   {data.canLocate && data.nextStatuses.length > 0 && <><Copy message={"Location privacy"}/><Choices value={radius} options={privacyRadii.map(value => ({ id: String(value), label: `${value} km radius` }))} onChange={setRadius} disabled={busy} /><Copy message={"While going to pickup or on the way, this screen updates your approximate location every 10 minutes. Updates pause when you leave this screen or lock your phone. You can also share it now."}/><Button message="Share current location" busy={busy} onPress={() => { void save('LOCATION'); }} /></>}
   {feedbackAt === 'LOCATION' && feedback}
  </Card>}
  <Card><Title message={"Tracking recipients"}/><Copy message={"Customers sign in with a code sent to their email."}/>
   {data.recipients.map(person => <View key={person.id} style={{ gap: 8, paddingVertical: 8 }}><Copy>{person.email}{person.owner ? ' · Customer' : ''}{person.revoked ? ' · Access removed' : ''}</Copy>{data.canManageRecipients && !person.owner && !person.revoked && <Button secondary label={`Remove access for ${person.email}`} busy={busy} onPress={() => Alert.alert('Remove tracking access?', 'This person will no longer be able to view this shipment.', [{ text: 'Keep access', style: 'cancel' }, { text: 'Remove access', style: 'destructive', onPress: () => { void save('REVOKE_RECIPIENT', person.id); } }])} />}</View>)}
   {data.canManageRecipients && <><Field message="Recipient email" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} editable={!busy} /><Button message="Add recipient" busy={busy} onPress={() => { void save('ADD_RECIPIENT'); }} /></>}
   {['ADD_RECIPIENT', 'REVOKE_RECIPIENT'].includes(feedbackAt) && feedback}
   {data.deliveries.some(item => item.status !== 'SENT') && <Copy message={"Some emails are still awaiting delivery. You do not need to add those recipients again."}/>}
  </Card>
  {data.canRecover && <AppLink href={{ pathname: '/shipment-manage', params: { id: data.id } }} style={{ paddingVertical: 14, color: palette.teal }} message={"Correct, reassign or cancel shipment"}/>}
  <Card><Title message={"Update history"}/>{data.events.map(event => <View key={event.id} style={{ gap: 4, paddingVertical: 8 }}><Copy>{t(statusLabel(event.status))} · {new Date(event.createdAt).toLocaleString()}</Copy>{!!event.note && <Copy>{event.note}</Copy>}{event.hasProof && <PrivateFile label={t('View photo proof')} load={() => account.request(`/api/mobile/shipments/${data.id}/proof/${event.id}`)} />}</View>)}</Card>
 </>;
}
