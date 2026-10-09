import {dateOnly} from '../../../../src/lib/date-calendar';
import {DatePicker} from '../components/date-picker';
import {useLanguage} from '../localization/provider';
import { AppLink } from '../components/app-link';
import { useRef, useState } from 'react';
import { ActivityIndicator, Switch, View } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useAccount } from '../session/provider';
import { useAccountQuery } from '../hooks/account-query';
import { ApiError } from '../api/http';
import { statusLabel, type TrackingWorkspace } from '../api/tracking';
import { Page, Title, Copy, Card, Field, Button, ErrorText } from '../components/ui';
import { Choices } from '../components/choices';
import { PlacePicker, emptyPlace } from '../components/place-picker';
export default function Shipments() {
 const {t}=useLanguage();
 const account = useAccount(), query = useAccountQuery<TrackingWorkspace>('/api/mobile/shipments');
 const [creating, setCreating] = useState(false);
 if (account.busy) return <Page><ActivityIndicator /></Page>;
 if (!account.session) return <Redirect href="/account" />;
 return <Page><Title message={"Tracking"}/><Copy message={"Keep customers informed after you agree the transport work."}/><ErrorText message={query.error} />
  {!query.data && !query.error && <ActivityIndicator accessibilityLabel="Loading shipments" />}
  <Button secondary message="Refresh shipments" onPress={() => { void query.reload(); }} busy={query.loading} />
  {query.data?.canManage && !creating && <Button message="Start tracking" onPress={() => setCreating(true)} />}
  {creating && query.data && <CreateTracking workspace={query.data} onClose={() => { setCreating(false); void query.reload(); }} />}
  {query.data && !query.data.canManage && <Copy message={"Your fleet owner can enable Tracking access for you."}/>}
  {query.data?.shipments.length === 0 && <Copy message={"No shipments yet."}/>}
  {query.data?.shipments.map(item => <Card key={item.id}><Title>{item.origin} → {item.destination}</Title><Copy>{item.code} · {t(statusLabel(item.status))}</Copy><Copy>{item.truck} · {item.driver}</Copy><Copy>{item.cargo}</Copy><AppLink href={{ pathname: '/shipment-detail', params: { id: item.id } }} style={{ color: '#0c7275', paddingVertical: 12 }} message={"Open shipment"}/></Card>)}
  {!!query.data?.shipments.length && <Copy>Showing the latest {query.data.shipments.length} shipments.</Copy>}
 </Page>;
}
function CreateTracking({ workspace, onClose }: { workspace: TrackingWorkspace; onClose: () => void }) {
 const account = useAccount(), lock = useRef(false);
 const [vehicleId, setVehicle] = useState(workspace.vehicles.length === 1 ? workspace.vehicles[0].id : '');
 const [origin, setOrigin] = useState(emptyPlace), [destination, setDestination] = useState(emptyPlace);
 const [cargo, setCargo] = useState(''), [email, setEmail] = useState(''), [others, setOthers] = useState('');
 const [pickup, setPickup] = useState(''), [delivery, setDelivery] = useState(''), [location, setLocation] = useState(false);
 const [busy, setBusy] = useState(false), [error, setError] = useState(''), [uncertain, setUncertain] = useState(false);
 async function create() {
  if (lock.current || uncertain) return;
  if (!vehicleId || !origin.placeRef || !destination.placeRef || cargo.trim().length < 3 || !email.trim()) { setError('Choose a truck and both cities, then add the cargo and customer email.'); return; }
  if(!dateOnly(delivery)){setError('Choose an expected delivery date.');return;}
  lock.current = true; setBusy(true); setError('');
  try {
   const result = await account.request('/api/mobile/shipments', { vehicleId, originPlaceRef: origin.placeRef, destinationPlaceRef: destination.placeRef, cargoSummary: cargo.trim(), customerEmail: email.trim(), additionalRecipientEmails: others.split(/[\s,;]+/).filter(Boolean), expectedPickupDate: pickup.trim(), expectedDeliveryDate: delivery.trim(), trackingMode: location ? 'LOCATION_AND_STATUS' : 'STATUS_ONLY' }) as { id: string };
   onClose(); router.push({ pathname: '/shipment-detail', params: { id: result.id } });
  } catch (error) {
   if (error instanceof ApiError && (error.status === 0 || error.status >= 500)) { setUncertain(true); setError('We could not confirm the result. Check your shipments before starting again; this shipment may already be saved.'); }
   else setError(error instanceof Error ? error.message : 'Could not start tracking.');
  } finally { lock.current = false; setBusy(false); }
 }
 return <Card><Title message={"New shipment"}/>{workspace.vehicles.length ? <><Copy message={"Truck and assigned driver"}/>{account.session?.user.role==='DRIVER'?<Copy>{workspace.vehicles[0]?.label}</Copy>:<Choices value={vehicleId} options={workspace.vehicles} onChange={setVehicle} disabled={busy} />}
  <PlacePicker label="Pickup city" value={origin} onChange={setOrigin} disabled={busy} /><PlacePicker label="Delivery city" value={destination} onChange={setDestination} disabled={busy} />
  <Field message="Cargo" value={cargo} onChangeText={setCargo} maxLength={500} editable={!busy} />
  <Field message="Shipment owner email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" editable={!busy} />
  <Field message="Other recipients (optional)" value={others} onChangeText={setOthers} autoCapitalize="none" editable={!busy} /><Copy message={"Separate additional emails with commas. Each person receives their own access by email."}/>
  <DatePicker message="Expected pickup" value={pickup} onChange={setPickup} disabled={busy} /><DatePicker message="Expected delivery" value={delivery} onChange={setDelivery} required disabled={busy} />
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Switch accessibilityLabel="Include approximate location" value={location} onValueChange={setLocation} disabled={busy} /><Copy message={"Include approximate location"}/></View>
  {location?<Copy message="The assigned driver shares an approximate location until unloading is approved. This choice stays with the shipment."/>:<Copy message="Customers see shipment status updates without a location."/>}
  <ErrorText message={error} /><Button message="Create shipment" busy={busy} disabled={uncertain} onPress={() => { void create(); }} /></> : <Copy message={"No assigned truck is available. Add a truck and assign its driver first."}/>}
  <Button secondary label={uncertain ? 'Check saved shipments' : 'Close'} busy={busy} onPress={onClose} />
 </Card>;
}
