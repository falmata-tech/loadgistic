import FleetScreen from './fleet';
import {DriverHome} from './driver-home';
import {workspaceCapabilities} from '../navigation/destinations';
import {ActionLink} from '../components/action-link';
import {useLanguage} from '../localization/provider';
import { AppLink } from '../components/app-link';
import { ProfileSetup } from '../components/profile-setup';
import {Redirect,useLocalSearchParams} from 'expo-router';
import BusinessWorkspaces,{businessHome} from './business-workspaces';
import { statusLabel } from '../api/tracking';
import { useEffect, useRef, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { useAccountQuery } from '../hooks/account-query';
import { useAccount } from '../session/provider';
import { Page, Title, Copy, Card, Field, Button, ErrorText, LoadingSpinner } from '../components/ui';
const message = (error: unknown) => error instanceof Error ? error.message : 'Please try again.';
export default function AccountScreen() {
  const account = useAccount();
  const {setup}=useLocalSearchParams<{setup?:string}>();
  const [committed,setCommitted]=useState<{actorId:string;kind:'ONBOARDING'|'JOIN_FLEET'}|null>(null);
  if (account.busy) return <Page><LoadingSpinner accessibilityLabel="Restoring your account" /></Page>;
  if (!account.session) return <Login />;
  if ((account.session.state === 'ONBOARDING'||account.session.user.role==='CUSTOMER')&&setup==='provider') return <Onboarding key={account.session.user.id} committed={committed?.actorId===account.session.user.id&&committed.kind==='ONBOARDING'} onCommitted={()=>setCommitted({actorId:account.session!.user.id,kind:'ONBOARDING'})}/>;
  if (account.session.state === 'ONBOARDING') return <BusinessWorkspaces/>;
  if (account.session.state === 'JOIN_FLEET') return <Invitations key={account.session.user.id} committed={committed?.actorId===account.session.user.id&&committed.kind==='JOIN_FLEET'} onCommitted={()=>setCommitted({actorId:account.session!.user.id,kind:'JOIN_FLEET'})}/>;
  if(account.session.user.role==='CUSTOMER')return <Redirect href={businessHome(account.session.user.selectedBusinessWorkspace)}/>;
  const capabilities=workspaceCapabilities(account.session);
  if (capabilities.drivesTruck && account.session.access?.granted) return <DriverHome />;
  if (capabilities.canManageFleet && account.session.access?.granted) return <FleetScreen />;
  return <Dashboard />;
}
function Login() {
 const {t}=useLanguage();
  const account = useAccount();
  const [email, setEmail] = useState(''), [code, setCode] = useState(''), [handoff, setHandoff] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const submit = async () => { if (busy) return; setBusy(true); setError(''); try { if (!handoff) setHandoff(await account.requestCode(email.trim())); else await account.verifyCode(handoff, code.trim()); } catch (error) { setError(message(error)); } finally { setBusy(false); } };
  return <Page><Title message="Sign in"/><Copy message="Choose where you want to work."/>
    <ErrorText message={error || account.error} />
    {account.cleanupRequired && <Button secondary message="Retry sign-out" onPress={() => { void account.signOut(); }} />}
    {!handoff ? <Field message="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" editable={!busy} onSubmitEditing={submit} /> : <><Copy>{t('Enter the code sent to {email}.',{email})}</Copy><Field message="Sign-in code" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} editable={!busy} onSubmitEditing={submit} /></>}
    <Button label={t(handoff ? 'Sign in' : 'Send code')} onPress={submit} busy={busy} />
    {!!handoff && <Button secondary message="Use another email or resend" onPress={() => { setHandoff(''); setCode(''); setError(''); }} busy={busy} />}
    <Copy message={"Your email code signs you in securely. No password needed."}/>
    <AppLink href="/review-access" message="Review access" style={{color:'#526875',fontSize:13,paddingVertical:12,minHeight:44}}/>
  </Page>;
}
function SignOut() { const account = useAccount(); const [error, setError] = useState(''); return <><ErrorText message={error} /><Button secondary message="Sign out" onPress={() => { void account.signOut().catch(error => setError(message(error))); }} /></>; }
function Onboarding({committed,onCommitted}:{committed:boolean;onCommitted:()=>void}) {
 const {t}=useLanguage();
  const account = useAccount(),lock=useRef(false);
  const [firstName, setFirstName] = useState(''), [lastName, setLastName] = useState(''), [accountName, setAccountName] = useState(''), [handle,setHandle]=useState(''), [phone, setPhone] = useState(''), [drivesTruck,setDrivesTruck]=useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const submit = async () => { if(lock.current)return;lock.current=true;setBusy(true); setError(''); try { if(!committed){await account.request('/api/mobile/onboarding', { firstName,lastName,accountName,handle,phone,applicationType:'TRANSPORT_PROVIDER',drivesTruck });onCommitted();}await account.reload(); } catch (error) { setError(message(error)); } finally { lock.current=false;setBusy(false); } };
  if(committed)return <Page><Title message="Set up your transporter account"/><Copy message="Your account is saved. Try again to open your workspace."/><ErrorText message={error||account.error}/><Button message="Try again" busy={busy} onPress={submit}/><SignOut/></Page>;
  return <Page><Title message={"Set up your transporter account"}/><Copy message="Add vehicles and drivers from your workspace."/><ErrorText message={error} />
    <Field message="Account name" value={accountName} onChangeText={setAccountName} autoComplete="nickname" maxLength={140} editable={!busy}/><Copy message="Use your name or a name for your transport work."/>
    <Field message="Handle" value={handle} onChangeText={text=>setHandle(text.toLowerCase().replace(/^@/,''))} autoComplete="username" autoCapitalize="none" autoCorrect={false} maxLength={64} editable={!busy}/><Copy message="Use letters, numbers, underscores or hyphens."/>
    <Text style={{fontSize:17,fontWeight:'700',color:'#0b1d3a'}}>{t('Account manager')}</Text><Copy message="Only your first name is shown as Account manager."/>
    <Field message="First name" value={firstName} onChangeText={setFirstName} autoComplete="given-name" maxLength={100} editable={!busy} />
    <Field message="Last / father name" value={lastName} onChangeText={setLastName} autoComplete="family-name" maxLength={100} editable={!busy} /><Copy message="Private. Your last or father name is not shown publicly."/>
    <Field message="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" maxLength={32} editable={!busy} />
    <View style={{flexDirection:'row',alignItems:'center',gap:12}}><Switch accessibilityLabel={t('I drive a vehicle')} value={drivesTruck} onValueChange={setDrivesTruck} disabled={busy}/><View style={{flex:1}}><Copy message="I drive a vehicle"/><Copy message="Keep my driving controls on Home."/></View></View>
    <Button message="Create account" onPress={submit} busy={busy} /><SignOut />
  </Page>;
}
type Invitation = { id: string; organization_name: string; driver_name: string; can_accept: boolean };
function Invitations({committed,onCommitted}:{committed:boolean;onCommitted:()=>void}) {
 const {t}=useLanguage();
  const account = useAccount(),lock=useRef(false); const request = account.request; const [items, setItems] = useState<Invitation[]>([]), [busy, setBusy] = useState(false),[loading,setLoading]=useState(true), [error, setError] = useState('');
  useEffect(() => { let mounted = true;if(committed)return;request('/api/mobile/invitations').then(value => { if (mounted) setItems((value as { invitations: Invitation[] }).invitations); }).catch(error => { if (mounted) setError(message(error)); }).finally(()=>{if(mounted)setLoading(false);}); return () => { mounted = false; }; }, [request,committed]);
  const accept = async (id?: string) => { if(lock.current)return;lock.current=true;setBusy(true); setError(''); try { if(!committed){await account.request('/api/mobile/invitations', { invitationId: id });onCommitted();}await account.reload(); } catch (error) { setError(message(error)); } finally { lock.current=false;setBusy(false); } };
  if(committed)return <Page><Title message="Join your fleet"/><Copy message="Your fleet membership is saved. Try again to open your workspace."/><ErrorText message={error||account.error}/><Button message="Try again" busy={busy} onPress={()=>{void accept();}}/><SignOut/></Page>;
  return <Page><Title message={"Join your fleet"}/><ErrorText message={error} />{(busy||loading) && <LoadingSpinner />}{items.map(item => <Card key={item.id}><Title>{item.organization_name}</Title><Copy>{t('Join as {name}, company driver.',{name:item.driver_name})}</Copy>{item.can_accept && <Button message="Join fleet" busy={busy} onPress={() => accept(item.id)} />}</Card>)}{!busy&&!loading && !items.length && <Copy message={"No pending invitation. Ask your fleet owner to invite this email."}/>}<SignOut /></Page>;
}
type DashboardData = { profilePublished: boolean | null; counts: { label: string; value: number }[]; recent: { id: string; code: string; origin: string; destination: string; summary: string; status: string }[] };
function Dashboard() {
  const {t}=useLanguage();
  const account = useAccount(), session = account.session!;
  const { data, error, reload } = useAccountQuery<DashboardData>('/api/mobile/dashboard');
  return <Page><Title>{session.user.providerAccountName || session.user.organizationName || session.user.businessName || session.user.name}</Title><Copy>{t(session.user.role === 'DRIVER' ? 'Your driving workspace' : 'Your transport workspace')}</Copy><ErrorText message={error} />
    {!session.access?.granted ? <Card><Title message={"Workspace access is limited"}/><Copy message={"This account is not linked to a transport workspace."}/><ActionLink href="/support" message="Support" icon="help"/></Card> : <>
      {!data && !error && <LoadingSpinner accessibilityLabel="Loading your dashboard" />}
      {!!error && <Button message="Try again" onPress={() => { void reload(); }} />}
      <ProfileSetup published={data?.profilePublished} /><ActionLink href="/manage-capacity" message="Vehicle capacity" icon="location"/>
      <ActionLink href="/shipments" message="Tracking" icon="route"/>
      {session.user.operatingModel!=='COMPANY_DRIVER'&&<ActionLink href="/fleet" message="Vehicles and drivers" icon="truck"/>}
      <ActionLink href="/network" message="Who can see my vehicles" icon="network"/>
      {session.user.role!=='DRIVER'&&<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{data?.counts.map(item => <View key={item.label} style={{ width: '48%' }}><Card><Copy>{t(item.label)}</Copy><Title>{item.value}</Title></Card></View>)}</View>}
      <Title message={"Recent tracking"}/>{data?.recent.length === 0 && <Copy message={"No tracking activity yet."}/>}
      {data?.recent.map(item => <Card key={item.id}><Text>{item.code}</Text><Copy>{item.origin} → {item.destination}</Copy><Copy>{item.summary}</Copy><Copy>{t(statusLabel(item.status))}</Copy><AppLink href={{ pathname: '/shipment-detail', params: { id: item.id } }} style={{ color: '#155eef', paddingVertical: 12 }} message={"Open shipment"}/></Card>)}
    </>}
  </Page>;
}
