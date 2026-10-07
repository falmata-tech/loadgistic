import { ProfileSetup } from '../components/profile-setup';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAccount } from '../session/provider';
import { useAccountQuery } from '../hooks/account-query';
import { Page, Card, Title, Copy, Field, Button, ErrorText } from '../components/ui';
type Truck = { id: string; label: string; driver: string; loadgistic: boolean; grants: { id: string; email: string; addedBy: string }[] };
export default function Network() {
 const account = useAccount(), query = useAccountQuery<{ profilePublished: boolean | null; vehicles: Truck[] }>('/api/mobile/network');
 if (account.busy) return <Page><ActivityIndicator /></Page>;
 if (!account.session) return <Redirect href="/account" />;
 return <Page><Title message={"Who can see my trucks"}/><Copy message={"Share privately with the brokers and customers you work with. Each email gets access only to the trucks you choose."}/><ErrorText message={query.error} /><Button secondary message="Refresh sharing" busy={query.loading} onPress={() => { void query.reload(); }} />
  <ProfileSetup published={query.data?.profilePublished} />{query.data?.vehicles.length === 0 && <Copy message={"No trucks are available to manage here. Add your truck or ask your fleet owner to enable capacity management."}/>}
  {query.data?.vehicles.map(truck => <Sharing key={truck.id} truck={truck} reload={query.reload} />)}
 </Page>;
}
function Sharing({ truck, reload }: { truck: Truck; reload: () => Promise<void> }) {
 const account = useAccount(), lock = useRef(false), [email, setEmail] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
 async function save(body: unknown) { if (lock.current) return; lock.current = true; setBusy(true); setError(''); setMessage(''); try { await account.request('/api/mobile/network', body); await reload(); setEmail(''); setMessage('Sharing updated.'); } catch (error) { setError(error instanceof Error ? error.message : 'Could not confirm the change. Refresh sharing before trying again.'); } finally { lock.current = false; setBusy(false); } }
 return <Card><Title>{truck.label}</Title><Copy>{truck.driver || 'No assigned driver'}</Copy><Field message="Share capacity with this email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" editable={!busy} /><Button message="Add email access" busy={busy} disabled={!email.trim()} onPress={() => { void save({ action: 'GRANT', vehicleId: truck.id, email: email.trim() }); }} />
  <Copy message={"They verify this email when opening privately shared capacity. The driver’s location privacy radius stays the same."}/>
  {truck.grants.map(grant => <View key={grant.id} style={{ gap: 8, paddingVertical: 8 }}><Copy>{grant.email}</Copy><Copy>Added by {grant.addedBy}</Copy><Button secondary label={`Remove access for ${grant.email}`} busy={busy} onPress={() => Alert.alert('Remove capacity access?', 'This email will no longer see this truck in privately shared capacity.', [{ text: 'Keep access', style: 'cancel' }, { text: 'Remove access', style: 'destructive', onPress: () => { void save({ action: 'REVOKE', grantId: grant.id }); } }])} /></View>)}
  {!truck.grants.length && <Copy message={"No email access added for this truck."}/>}
  <Copy message={"Share with Loadgistic so our brokerage team can consider this truck for transport requests."}/><Button secondary label={truck.loadgistic ? 'Stop sharing with Loadgistic' : 'Share with Loadgistic'} busy={busy} onPress={() => { void save({ action: 'LOADGISTIC', vehicleId: truck.id, enabled: !truck.loadgistic }); }} />
  <ErrorText message={error} />{!!message && <Copy>{message}</Copy>}
 </Card>;
}
