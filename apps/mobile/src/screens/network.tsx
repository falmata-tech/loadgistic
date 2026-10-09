import {capacitySharingLabel} from '../../../../src/lib/capacity-sharing';
import {useLanguage} from '../localization/provider';
import { ProfileSetup } from '../components/profile-setup';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAccount } from '../session/provider';
import { useAccountQuery } from '../hooks/account-query';
import { Page, Card, Title, Copy, Field, Button, ErrorText } from '../components/ui';
type Truck = { id: string; label: string; driver: string; sharingMode: string; exclusiveEmail: string; loadgistic: boolean; grants: { id: string; name: string; email: string; addedBy: string }[] };
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
 const {t}=useLanguage();
 const account = useAccount(), lock = useRef(false), [name, setName] = useState(''), [email, setEmail] = useState(''), [editing,setEditing]=useState<Truck['grants'][number]|null>(null),[editName,setEditName]=useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
 async function save(body: unknown) { if (lock.current) return; lock.current = true; setBusy(true); setError(''); setMessage(''); try { await account.request('/api/mobile/network', body); await reload(); setEmail(''); setName(''); setEditing(null); setMessage(t('Sharing updated.')); } catch (error) { setError(error instanceof Error ? error.message : 'Could not confirm the change. Refresh sharing before trying again.'); } finally { lock.current = false; setBusy(false); } }
 return <Card><Title>{truck.label}</Title><Copy>{truck.driver || t('No driver assigned')}</Copy><Copy>{t(capacitySharingLabel(truck.sharingMode))}</Copy><Copy message="Saved contacts get access only when the truck’s sharing setting allows them."/><Field message="Person or company name" value={name} onChangeText={setName} maxLength={100} editable={!busy}/><Field message="Share capacity with this email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" editable={!busy} /><Button message="Add access" busy={busy} disabled={!name.trim()||!email.trim()||(truck.sharingMode==='EXCLUSIVE'&&email.trim().toLowerCase()!==truck.exclusiveEmail)} onPress={()=>{void save({action:'GRANT',vehicleId:truck.id,email:email.trim(),name:name.trim()});}}/>
  <Copy message={"They verify this email when opening privately shared capacity. The driver’s location privacy radius stays the same."}/>
  {truck.grants.map(grant => <View key={grant.id} testID={'capacity-contact-'+grant.id} style={{ gap: 8, paddingVertical: 8 }}><Copy>{grant.name||grant.email}</Copy>{!!grant.name&&<Copy>{grant.email}</Copy>}<Copy>{t('Added by {name}',{name:grant.addedBy})}</Copy>{editing?.id===grant.id?<View style={{gap:8}}><Field message="Person or company name" value={editName} onChangeText={setEditName} maxLength={100} editable={!busy}/><Button message="Save name" disabled={!editName.trim()} busy={busy} onPress={()=>{void save({action:'NAME',grantId:grant.id,name:editName.trim()});}}/><Button secondary message="Cancel" disabled={busy} onPress={()=>setEditing(null)}/><ErrorText message={error}/></View>:<Button secondary message="Edit name" disabled={busy} onPress={()=>{setEditing(grant);setEditName(grant.name);setError('');setMessage('');}}/>}<Button secondary message="Remove" busy={busy} onPress={() => Alert.alert('Remove capacity access?', 'This email will no longer see this truck in privately shared capacity.', [{ text: 'Keep access', style: 'cancel' }, { text: 'Remove access', style: 'destructive', onPress: () => { void save({ action: 'REVOKE', grantId: grant.id }); } }])} /></View>)}
  {!truck.grants.length && <Copy message={"No email access added for this truck."}/>}
  <Copy message={"Share with Loadgistic so our brokerage team can consider this truck for transport requests."}/><Button secondary label={truck.loadgistic ? 'Stop sharing with Loadgistic' : 'Share with Loadgistic'} busy={busy} disabled={truck.sharingMode==='EXCLUSIVE'&&!truck.loadgistic} onPress={() => { void save({ action: 'LOADGISTIC', vehicleId: truck.id, enabled: !truck.loadgistic }); }} />
  <ErrorText message={error} />{!!message && <Copy>{message}</Copy>}
 </Card>;
}
