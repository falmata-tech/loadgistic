import {DatePicker} from '../components/date-picker';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useAccount } from '../session/provider';
import { useAccountQuery } from '../hooks/account-query';
import { Page, Title, Copy, Card, Field, Button, ErrorText } from '../components/ui';
import { PlacePicker, type Place } from '../components/place-picker';
import { Choices } from '../components/choices';
import { ApiError } from '../api/http';
type Recovery = { id: string; revision: string; status: string; cargo: string; origin: Place; destination: Place; pickupDate: string; deliveryDate: string; vehicleId: string; actions: string[]; vehicles: { id: string; label: string }[] };
export default function ManageShipment() {
 const { id } = useLocalSearchParams<{ id: string }>(), account = useAccount();
 const query = useAccountQuery<Recovery>(`/api/mobile/shipments/${encodeURIComponent(typeof id === 'string' ? id : '')}/recovery`);
 if (account.busy) return <Page><ActivityIndicator /></Page>;
 if (!account.session) return <Redirect href="/account" />;
 return <Page><Title message={"Manage shipment"}/><ErrorText message={query.error} /><Button secondary message="Reload current details" busy={query.loading} onPress={() => { void query.reload(); }} />{query.data && <RecoveryForm key={query.data.revision} data={query.data} />}</Page>;
}
function RecoveryForm({ data }: { data: Recovery }) {
 const account = useAccount(), lock = useRef(false);
 const [action, setAction] = useState('CORRECT'), [reason, setReason] = useState(''), [cargo, setCargo] = useState(data.cargo);
 const [origin, setOrigin] = useState(data.origin), [destination, setDestination] = useState(data.destination);
 const [pickup, setPickup] = useState(data.pickupDate), [delivery, setDelivery] = useState(data.deliveryDate), [vehicle, setVehicle] = useState('');
 const [busy, setBusy] = useState(false), [error, setError] = useState(''), [mustReload, setMustReload] = useState(false);
 async function save() {
  if (lock.current || mustReload) return;
  if (reason.trim().length < 5) { setError('Add a short reason (at least 5 characters).'); return; }
  if (action === 'REASSIGN' && !vehicle) { setError('Choose a replacement truck.'); return; }
  lock.current = true; setBusy(true); setError('');
  try { const common = { action, revision: data.revision, reason: reason.trim() };
   await account.request(`/api/mobile/shipments/${data.id}/recovery`, action === 'CORRECT' ? { ...common, cargo_summary: cargo.trim(), origin_place_ref: origin.placeRef, destination_place_ref: destination.placeRef, expected_pickup_date: pickup.trim(), expected_delivery_date: delivery.trim() } : action === 'REASSIGN' ? { ...common, vehicle_id: vehicle } : { ...common, confirm: 'CANCEL' });
   router.back();
  } catch (error) { setError(error instanceof Error ? error.message : 'Could not confirm the change. Reload current details before trying again.'); if (!(error instanceof ApiError) || error.status === 0 || error.status >= 500 || error.status === 409) setMustReload(true); }
  finally { lock.current = false; setBusy(false); }
 }
 if (!data.actions.length) return <Copy message={"This shipment is closed. Its history is retained."}/>;
 const routeEditable = ['CREATED', 'TO_PICKUP'].includes(data.status);
 return <Card><Choices value={action} options={[{ id: 'CORRECT', label: 'Correct details' }, { id: 'REASSIGN', label: 'Change truck and driver' }, { id: 'CANCEL', label: 'Cancel tracking' }].filter(item => data.actions.includes(item.id))} onChange={setAction} disabled={busy} />
  {action === 'CORRECT' && <><Field message="Cargo" value={cargo} onChangeText={setCargo} maxLength={500} editable={!busy} />{routeEditable ? <><PlacePicker label="Pickup city" value={origin} onChange={setOrigin} disabled={busy} /><PlacePicker label="Delivery city" value={destination} onChange={setDestination} disabled={busy} /></> : <Copy>{origin.label} → {destination.label}. The route is retained after loading begins.</Copy>}<DatePicker message="Expected pickup" value={pickup} onChange={setPickup} disabled={busy} /><DatePicker message="Expected delivery" value={delivery} onChange={setDelivery} disabled={busy||!['CREATED','TO_PICKUP'].includes(data.status)} /></>}
  {action === 'REASSIGN' && <><Copy message={"The replacement truck’s assigned driver takes over. Earlier updates remain; a new location update is needed."}/><Choices value={vehicle} options={data.vehicles.filter(item => item.id !== data.vehicleId)} onChange={setVehicle} disabled={busy} />{!data.vehicles.some(item => item.id !== data.vehicleId) && <Copy message={"No other eligible truck is available. Assign a driver to a replacement truck in your fleet first."}/>}</>}
  {action === 'CANCEL' && <Copy message={"Cancellation ends customer access and keeps your shipment history. It cannot be undone here."}/>}
  <Field message="Reason for this change" value={reason} onChangeText={setReason} maxLength={500} multiline editable={!busy} /><ErrorText message={error} />
  {mustReload && <Copy message={"Reload current details above before making another change."}/>}
  <Button label={action === 'CANCEL' ? 'Cancel tracking' : 'Save change'} busy={busy} disabled={mustReload} onPress={() => action === 'CANCEL' ? Alert.alert('Cancel this tracking?', 'Customer access will end. Your shipment history will remain.', [{ text: 'Keep tracking', style: 'cancel' }, { text: 'Cancel tracking', style: 'destructive', onPress: () => { void save(); } }]) : void save()} />
 </Card>;
}
