import { apiOrigin } from '../api/http';
import { FilePicker, PrivateFile, uploadBody, useFileSelection } from '../components/private-file';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect } from 'expo-router';
import { useAccount } from '../session/provider';
import { useAccountQuery } from '../hooks/account-query';
import { Page, Card, Title, Copy, Field, Button, ErrorText } from '../components/ui';
import { Choices } from '../components/choices';
import { PlacePicker } from '../components/place-picker';
type Profile = { headline: string; about: string; services: string; basePlaceRef: string; basePlaceLabel: string; baseRegionCode: string; contactPhone: string; contactWhatsapp: string; contactEmail: string; contactWebsite: string; showContactPhone: boolean; showContactWhatsapp: boolean; showContactEmail: boolean; showContactWebsite: boolean; published: boolean };
type Workspace = { imageUrl: string; customImage: boolean; name: string; handle: string; profile: Profile; regions: { code: string; label: string }[] };
export default function ProfileScreen({embedded=false}:{embedded?:boolean}={}) {
 const account = useAccount(), query = useAccountQuery<Workspace>('/api/mobile/profile');
 if (account.busy) return <Page embedded={embedded}><ActivityIndicator /></Page>;
 if (!account.session) return <Redirect href="/account" />;
 return <Page embedded={embedded}>{!embedded&&<Title message={"Transporter profile"}/>}<ErrorText message={query.error} />{!query.data && !query.error && <ActivityIndicator />}{query.error && <Button secondary message="Try again" onPress={() => { void query.reload(); }} />}{query.data && <ProfileEditor key={account.session.user.id} workspace={query.data} />}</Page>;
}
function ProfileEditor({ workspace }: { workspace: Workspace }) {
 const account = useAccount(), lock = useRef(false), [value, setValue] = useState(workspace.profile), [regionsOpen, setRegionsOpen] = useState(false);
 const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
 const update = <K extends keyof Profile>(key: K, field: Profile[K]) => setValue(previous => ({ ...previous, [key]: field }));
 async function save() { if (lock.current) return; lock.current = true; setBusy(true); setError(''); setMessage(''); try { const { basePlaceLabel, ...command } = value; void basePlaceLabel; await account.request('/api/mobile/profile', command); const saved = await account.request('/api/mobile/profile') as Workspace; setValue(saved.profile); setMessage(saved.profile.published ? 'Your transporter profile is published.' : 'Profile saved as unpublished.'); } catch (error) { setError(error instanceof Error ? error.message : 'Could not confirm the update. Reopen this screen before trying again.'); } finally { lock.current = false; setBusy(false); } }
 return <><Portrait initial={workspace} /><Copy>{workspace.name} · @{workspace.handle}</Copy><Copy message={"Introduce your transport business. A published profile lets customers find your eligible trucks in public and privately shared capacity."}/><Card><Field message="Headline" value={value.headline} onChangeText={text => update('headline', text)} maxLength={120} editable={!busy} /><Field message="About your business" value={value.about} onChangeText={text => update('about', text)} maxLength={2000} multiline editable={!busy} /><Field message="Transport services" value={value.services} onChangeText={text => update('services', text)} maxLength={1000} multiline editable={!busy} />
  <Copy message={"Region or city administration"}/><Button secondary label={workspace.regions.find(region => region.code === value.baseRegionCode)?.label || 'Choose a region'} disabled={busy} onPress={() => setRegionsOpen(true)} />
  <PlacePicker label="Base city or town" value={{ placeRef: value.basePlaceRef, label: value.basePlaceLabel }} onChange={place => setValue(previous => ({ ...previous, basePlaceRef: place.placeRef, basePlaceLabel: place.label }))} disabled={busy} />
 </Card><Card><Title message={"Public contact details"}/><Copy message={"Your login email and phone remain private. Choose which business contact details customers can see."}/>
  {([{ field: 'contactPhone', show: 'showContactPhone', label: 'Business phone' }, { field: 'contactWhatsapp', show: 'showContactWhatsapp', label: 'WhatsApp' }, { field: 'contactEmail', show: 'showContactEmail', label: 'Business email' }, { field: 'contactWebsite', show: 'showContactWebsite', label: 'Website (https://)' }] as const).map(item => <View key={item.field} style={{ gap: 8 }}><Field label={item.label} value={value[item.field]} onChangeText={text => update(item.field, text)} autoCapitalize="none" editable={!busy} /><View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}><Switch accessibilityLabel={`Show ${item.label}`} value={value[item.show]} onValueChange={show => update(item.show, show)} disabled={busy} /><Copy message={"Show to customers"}/></View></View>)}
 </Card><Card><View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}><Switch accessibilityLabel="Publish transporter profile" value={value.published} onValueChange={show => update('published', show)} disabled={busy} /><Copy message={"Publish transporter profile"}/></View><Copy message={"When off, customers cannot find your profile or shared truck signals."}/><ErrorText message={error} />{!!message && <Copy>{message}</Copy>}<Button message="Save transporter profile" busy={busy} onPress={() => { void save(); }} /></Card>
 <Modal visible={regionsOpen} animationType="slide" onRequestClose={() => setRegionsOpen(false)}><SafeAreaView style={{ flex: 1 }}><Page><Title message={"Choose a region"}/><Button secondary message="Close" onPress={() => setRegionsOpen(false)} /><Choices value={value.baseRegionCode} options={workspace.regions.map(region => ({ id: region.code, label: region.label }))} onChange={code => { update('baseRegionCode', code); setRegionsOpen(false); }} /></Page></SafeAreaView></Modal></>;
}

function Portrait({ initial }: { initial: Workspace }) {
 const account = useAccount(), selection = useFileSelection(), lock = useRef(false);
 const [workspace, setWorkspace] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState('');
 async function change(remove = false) {
  if (lock.current || !remove && !selection.file) return; lock.current = true; setBusy(true); setError('');
  try { await account.request('/api/mobile/profile/image', remove ? { action: 'REMOVE', confirm: true } : uploadBody({ action: 'UPLOAD' }, selection.file!));
   selection.setFile(null); setWorkspace(await account.request('/api/mobile/profile') as Workspace);
  } catch (error) { setError(error instanceof Error ? error.message : 'Could not confirm the image update. Reopen your profile before trying again.'); }
  finally { lock.current = false; setBusy(false); }
 }
 return <Card><Title message={"Profile image"}/>{!!workspace.imageUrl && !workspace.customImage && <Image accessibilityLabel="Your transporter profile image" source={{ uri: new URL(workspace.imageUrl, apiOrigin).href }} style={{ width: 120, height: 120, borderRadius: 60 }} />}<Copy message={"Your image appears on your published transporter profile."}/>{workspace.customImage && <PrivateFile label="View profile image" load={() => account.request('/api/mobile/profile/image')} />}<FilePicker imagesOnly file={selection.file} onChange={selection.setFile} disabled={busy} /><ErrorText message={error} />{selection.file && <Button message="Save profile image" busy={busy} onPress={() => { void change(); }} />}{workspace.customImage && <Button secondary message="Remove profile image" busy={busy} onPress={() => Alert.alert('Remove your profile image?', 'Your profile will return to its default image.', [{ text: 'Keep image', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => { void change(true); } }])} />}</Card>;
}
