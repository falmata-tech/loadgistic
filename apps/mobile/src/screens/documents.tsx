import {DatePicker} from '../components/date-picker';
import {useLanguage} from '../localization/provider';
import {documentSubjects,type DocumentScope} from '../navigation/document-scope';
import { useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAccount } from '../session/provider';
import { useAccountQuery } from '../hooks/account-query';
import { Page, Title, Copy, Card, Field, Button, ErrorText } from '../components/ui';
import { Choices } from '../components/choices';
import { FilePicker, PrivateFile, uploadBody, useFileSelection } from '../components/private-file';
const labels: Record<string, string> = { IDENTITY: 'National ID', BUSINESS_LICENSE: 'Business license', BUSINESS_ADDRESS: 'Business address', DRIVER_IDENTITY: 'Driver license', VEHICLE_OWNERSHIP: 'Truck ownership', VEHICLE_AUTHORIZATION: 'Permission to use truck', VEHICLE_AUTHORITY: 'Ownership or permission to use', TRUCK_AUTHORIZATION: 'Permission to use truck' };
type Subject = { id: string; kind: string; name: string; allowedTypes: string[]; pending: number; vehicles: { id: string; label: string }[]; badges: { type: string; verified: boolean; expired: boolean; expiresOn: string | null; vehicleLabel: string }[] };
type Request = { id: string; subjectId: string; subjectKind: string; name: string; type: string; status: string; submittedAt: string; expiresOn: string | null; note: string };
type Center = { subjects: Subject[]; requests: Request[] };
export default function Documents({embedded=false,scope}:{embedded?:boolean;scope?:DocumentScope}={}) {
 const {t}=useLanguage();
 const account = useAccount(), query = useAccountQuery<Center>('/api/mobile/verification');
 const subjects=documentSubjects(query.data?.subjects||[],scope);
 if (account.busy) return <Page embedded={embedded}><ActivityIndicator /></Page>;
 if (!account.session) return <Redirect href="/account" />;
 return <Page embedded={embedded}>{!embedded&&<Title message={"Your documents"}/>}<Copy message={"Submit documents for review. Each review belongs to the company, driver or truck shown below."}/><ErrorText message={query.error} /><Button secondary message="Refresh documents" busy={query.loading} onPress={() => { void query.reload(); }} />
  {subjects.map(subject => <Card key={subject.kind + subject.id}><Title>{scope?.kind==='ACCOUNT'&&scope.includeDriver&&subject.kind==='PROVIDER_PROFILE'&&account.session!.user.role==='DRIVER'?account.session!.user.name:subject.name}</Title><Copy>{t(scope?.kind==='ACCOUNT'&&scope.includeDriver&&subject.kind==='PROVIDER_PROFILE'&&account.session!.user.role==='DRIVER'?'Driver':subject.kind === 'ORGANIZATION' ? 'Company' : subject.kind === 'VEHICLE' ? 'Truck' : subject.kind === 'DRIVER' ? 'Driver' : 'Transporter')}</Copy>
   {subject.badges.map((badge, index) => <Copy key={badge.type + index}>{t(labels[badge.type] || badge.type)}{badge.vehicleLabel ? ` · ${badge.vehicleLabel}` : ''}: {t(badge.verified ? 'Loadgistic reviewed' : badge.expired ? 'Expired' : 'Not reviewed')}{badge.expiresOn ? ' · '+t('Expires {date}.',{date:badge.expiresOn}) : ''}</Copy>)}
   {query.data?.requests.filter(item => item.subjectId === subject.id && item.subjectKind === subject.kind).map(item => <View key={item.id} style={{ gap: 6, paddingVertical: 12 }}><Copy>{item.name || t(labels[item.type])} · {t(item.status === 'PENDING' ? 'Awaiting review' : item.status === 'APPROVED' ? 'Reviewed' : 'Not approved')}</Copy>{!!item.note && <Copy>{item.note}</Copy>}<PrivateFile label={`Open ${item.name || t(labels[item.type])}`} load={() => account.request(`/api/mobile/verification/${item.id}`)} /></View>)}
   {!!subject.allowedTypes.length && <Submit key={subject.allowedTypes.join(',')} subject={subject} reload={query.reload} />}
  </Card>)}{query.data && !subjects.length && <Copy message={"No document profiles are available for this account yet."}/>}
 </Page>;
}
function Submit({ subject, reload }: { subject: Subject; reload: () => Promise<void> }) {
 const {t}=useLanguage();
 const account = useAccount(), selection = useFileSelection();
 const [open, setOpen] = useState(false), [type, setType] = useState(''), [name, setName] = useState(''), [vehicle, setVehicle] = useState(''), [expiry, setExpiry] = useState('');
 const [minimumDate]=useState(()=>new Date(Date.now()+86_400_000).toISOString().slice(0,10));
 const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''); const lock = useRef(false);
 async function submit() {
  if (!selection.file || lock.current) return; lock.current = true; setBusy(true); setError(''); setMessage('');
  try { await account.request('/api/mobile/verification', uploadBody({ subjectId: subject.id, subjectType: subject.kind, verificationType: type, documentName: name.trim() || labels[type], relatedVehicleId: type === 'VEHICLE_AUTHORIZATION' ? subject.kind === 'VEHICLE' ? subject.id : vehicle : '', expiresOn: type === 'VEHICLE_AUTHORIZATION' ? expiry.trim() : '' }, selection.file));
   selection.setFile(null); setOpen(false); setMessage('Document submitted for review.'); await reload();
  } catch (error) { setError(`${error instanceof Error ? error.message : 'Could not confirm submission.'} Refresh documents before trying again.`); }
  finally { lock.current = false; setBusy(false); }
 }
 return <><ErrorText message={error} />{!!message && <Copy>{t(message)}</Copy>}{!open ? <Button message="Submit a document" onPress={() => setOpen(true)} /> : <><Copy message={"Document type"}/><Choices value={type} options={subject.allowedTypes.map(id => ({ id, label: t(labels[id] || id) }))} onChange={setType} disabled={busy} /><Field message="Document name (optional)" value={name} onChangeText={setName} maxLength={150} editable={!busy} />
  {type === 'VEHICLE_AUTHORIZATION' && <>{subject.kind !== 'VEHICLE' && <><Copy message={"Truck covered by this permission"}/><Choices value={vehicle} options={subject.vehicles.map(item => ({ id: item.id, label: item.label }))} onChange={setVehicle} disabled={busy} /></>}<DatePicker message="Permission expires" value={expiry} onChange={setExpiry} min={minimumDate} required disabled={busy} /></>}
  <FilePicker file={selection.file} onChange={selection.setFile} disabled={busy} /><Button message="Send for review" busy={busy} disabled={!type || !selection.file || type === 'VEHICLE_AUTHORIZATION' && (!expiry || subject.kind !== 'VEHICLE' && !vehicle)} onPress={() => { void submit(); }} /><Button secondary message="Cancel submission" disabled={busy} onPress={() => { setOpen(false); selection.setFile(null); }} />
 </>}</>;
}
