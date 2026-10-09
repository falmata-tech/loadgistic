import FleetScreen from './fleet';
import {DriverHome} from './driver-home';
import {ActionLink} from '../components/action-link';
import {useLanguage} from '../localization/provider';
import { AppLink } from '../components/app-link';
import { ProfileSetup } from '../components/profile-setup';
import { statusLabel } from '../api/tracking';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useAccountQuery } from '../hooks/account-query';
import { useAccount } from '../session/provider';
import { Page, Title, Copy, Card, Field, Button, ErrorText } from '../components/ui';
const message = (error: unknown) => error instanceof Error ? error.message : 'Please try again.';
export default function AccountScreen() {
  const account = useAccount();
  if (account.busy) return <Page><ActivityIndicator accessibilityLabel="Restoring your account" /></Page>;
  if (!account.session) return <Login />;
  if (account.session.state === 'ONBOARDING') return <Onboarding />;
  if (account.session.state === 'JOIN_FLEET') return <Invitations />;
  if (account.session.user.role === 'DRIVER' && account.session.access?.granted) return <DriverHome />;
  if (account.session.user.role === 'TRANSPORTER' && account.session.access?.granted) return <FleetScreen />;
  return <Dashboard />;
}
function Login() {
 const {t}=useLanguage();
  const account = useAccount();
  const [email, setEmail] = useState(''), [code, setCode] = useState(''), [handoff, setHandoff] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const submit = async () => { if (busy) return; setBusy(true); setError(''); try { if (!handoff) setHandoff(await account.requestCode(email.trim())); else await account.verifyCode(handoff, code.trim()); } catch (error) { setError(message(error)); } finally { setBusy(false); } };
  return <Page><Title message={"Transporter login"}/><Copy message={"Manage your trucks, share availability and keep customers informed."}/>
    <ErrorText message={error || account.error} />
    {account.cleanupRequired && <Button secondary message="Retry sign-out" onPress={() => { void account.signOut(); }} />}
    {!handoff ? <Field message="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" editable={!busy} onSubmitEditing={submit} /> : <><Copy>{t('Enter the code sent to {email}.',{email})}</Copy><Field message="Sign-in code" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} editable={!busy} onSubmitEditing={submit} /></>}
    <Button label={t(handoff ? 'Sign in' : 'Send code')} onPress={submit} busy={busy} />
    {!!handoff && <Button secondary message="Use another email or resend" onPress={() => { setHandoff(''); setCode(''); setError(''); }} busy={busy} />}
    <Copy message={"Your email code signs you in securely. No password needed."}/>
  </Page>;
}
function SignOut() { const account = useAccount(); const [error, setError] = useState(''); return <><ErrorText message={error} /><Button secondary message="Sign out" onPress={() => { void account.signOut().catch(error => setError(message(error))); }} /></>; }
function Onboarding() {
 const {t}=useLanguage();
  const account = useAccount();
  const [name, setName] = useState(''), [businessName, setBusinessName] = useState(''), [phone, setPhone] = useState(''), [applicationType, setType] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const submit = async () => { setBusy(true); setError(''); try { await account.request('/api/mobile/onboarding', { name, businessName, phone, applicationType }); await account.reload(); } catch (error) { setError(message(error)); } finally { setBusy(false); } };
  return <Page><Title message={"Set up your transporter account"}/><Copy message={"Choose how you operate. You can add trucks and documents next."}/><ErrorText message={error} />
    <Field message="Your name" value={name} onChangeText={setName} autoComplete="name" editable={!busy} />
    <Field message="Transporter name" value={businessName} onChangeText={setBusinessName} editable={!busy} />
    <Field message="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" editable={!busy} />
    {([['TRANSPORT_COMPANY', 'Transport company'], ['SELF_MANAGED_DRIVER', 'Independent driver']] as const).map(([value, label]) => <Button key={value} secondary={applicationType !== value} label={t(label)} onPress={() => setType(value)} busy={busy} />)}
    {applicationType==='SELF_MANAGED_DRIVER'&&<Copy message="Drive one truck you own, rent or use with permission."/>}
    <Button message="Create account" onPress={submit} busy={busy} /><SignOut />
  </Page>;
}
type Invitation = { id: string; organization_name: string; driver_name: string; can_accept: boolean };
function Invitations() {
 const {t}=useLanguage();
  const account = useAccount(); const request = account.request; const [items, setItems] = useState<Invitation[]>([]), [busy, setBusy] = useState(true), [error, setError] = useState('');
  useEffect(() => { let mounted = true; request('/api/mobile/invitations').then(value => { if (mounted) setItems((value as { invitations: Invitation[] }).invitations); }).catch(error => { if (mounted) setError(message(error)); }).finally(() => { if (mounted) setBusy(false); }); return () => { mounted = false; }; }, [request]);
  const accept = async (id: string) => { setBusy(true); setError(''); try { await account.request('/api/mobile/invitations', { invitationId: id }); await account.reload(); } catch (error) { setError(message(error)); } finally { setBusy(false); } };
  return <Page><Title message={"Join your fleet"}/><ErrorText message={error} />{busy && <ActivityIndicator />}{items.map(item => <Card key={item.id}><Title>{item.organization_name}</Title><Copy>{t('Join as {name}, company driver.',{name:item.driver_name})}</Copy>{item.can_accept && <Button message="Join fleet" busy={busy} onPress={() => accept(item.id)} />}</Card>)}{!busy && !items.length && <Copy message={"No pending invitation. Ask your fleet owner to invite this email."}/>}<SignOut /></Page>;
}
type DashboardData = { profilePublished: boolean | null; counts: { label: string; value: number }[]; recent: { id: string; code: string; origin: string; destination: string; summary: string; status: string }[] };
function Dashboard() {
  const {t}=useLanguage();
  const account = useAccount(), session = account.session!;
  const { data, error, reload } = useAccountQuery<DashboardData>('/api/mobile/dashboard');
  return <Page><Title>{session.user.organizationName || session.user.businessName || session.user.name}</Title><Copy>{t(session.user.role === 'DRIVER' ? 'Your driving workspace' : 'Your transport workspace')}</Copy><ErrorText message={error} />
    {!session.access?.granted ? <Card><Title message={"Workspace access is limited"}/><Copy message={"This account is not linked to a transport workspace."}/><ActionLink href="/support" message="Support" icon="help"/></Card> : <>
      {!data && !error && <ActivityIndicator accessibilityLabel="Loading your dashboard" />}
      {!!error && <Button message="Try again" onPress={() => { void reload(); }} />}
      <ProfileSetup published={data?.profilePublished} /><ActionLink href="/manage-capacity" message="Truck capacity" icon="location"/>
      <ActionLink href="/shipments" message="Tracking" icon="route"/>
      {session.user.operatingModel!=='COMPANY_DRIVER'&&<ActionLink href="/fleet" message="Trucks and drivers" icon="truck"/>}
      <ActionLink href="/network" message="Who can see my trucks" icon="network"/>
      {session.user.role!=='DRIVER'&&<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{data?.counts.map(item => <View key={item.label} style={{ width: '48%' }}><Card><Copy>{t(item.label)}</Copy><Title>{item.value}</Title></Card></View>)}</View>}
      <Title message={"Recent tracking"}/>{data?.recent.length === 0 && <Copy message={"No tracking activity yet."}/>}
      {data?.recent.map(item => <Card key={item.id}><Text>{item.code}</Text><Copy>{item.origin} → {item.destination}</Copy><Copy>{item.summary}</Copy><Copy>{t(statusLabel(item.status))}</Copy><AppLink href={{ pathname: '/shipment-detail', params: { id: item.id } }} style={{ color: '#0c7275', paddingVertical: 12 }} message={"Open shipment"}/></Card>)}
    </>}
  </Page>;
}
