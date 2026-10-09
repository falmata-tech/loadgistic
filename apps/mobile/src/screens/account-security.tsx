import { useRef, useState } from 'react';
import { AccountDeletion } from '../components/account-deletion';
import { ActivityIndicator } from 'react-native';
import { Link, Redirect } from 'expo-router';
import { useAccount } from '../session/provider';
import { useAccountQuery } from '../hooks/account-query';
import { Page, Title, Copy, Card, Field, Button, ErrorText } from '../components/ui';
type Operation = { action: 'EMAIL'; email: string } | { action: 'DEACTIVATE'; confirm: 'DEACTIVATE' };
type Security = { email: string; pendingEmail: string; pendingHandoff: string; blockers: string[] };
const blockers: Record<string, { text: string; path: '/shipments' | '/fleet' | '/support' }> = {
 ACTIVE_TRACKING: { text: 'Complete, cancel or reassign active tracking.', path: '/shipments' },
 ACTIVE_TRUCKS: { text: 'Retire your active trucks.', path: '/fleet' },
 DRIVER_ASSIGNMENT: { text: 'Ask your fleet owner to end your truck assignment.', path: '/support' },
 ACTIVE_FLEET_MEMBERS: { text: 'Resolve active fleet memberships.', path: '/fleet' },
 PENDING_INVITATIONS: { text: 'Cancel pending driver invitations.', path: '/fleet' },
 OPEN_SUPPORT: { text: 'End your open Support chat.', path: '/support' },
};
export default function AccountSecurityScreen({embedded=false}:{embedded?:boolean}={}) {
 const account = useAccount();
 if (account.busy) return <Page embedded={embedded}><ActivityIndicator /></Page>;
 if (!account.session) return <Redirect href="/account" />;
 return <SecurityControls key={account.session.user.id} embedded={embedded} />;
}
function SecurityControls({embedded}:{embedded:boolean}) {
 const account = useAccount(), query = useAccountQuery<Security>('/api/mobile/account/security');
 const [email, setEmail] = useState(''), [confirmation, setConfirmation] = useState(''), [code, setCode] = useState(''), [operation, setOperation] = useState<Operation | null>(null), [handoff, setHandoff] = useState(''), [pending, setPending] = useState<{ email: string; handoff: string } | null>(null);
 const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''), lock = useRef(false);
 const waiting = pending || (query.data?.pendingEmail ? { email: query.data.pendingEmail, handoff: query.data.pendingHandoff } : null);
 async function submit(step: 'REQUEST' | 'CONFIRM' | 'CHECK', chosen: Operation) {
  if (lock.current) return; lock.current = true; setBusy(true); setError(''); setMessage('');
  try {
   const result = await account.request('/api/mobile/account/security', { step, operation: chosen, ...(step === 'CONFIRM' ? { handoff, code: code.trim() } : step === 'CHECK' ? { handoff: waiting!.handoff } : {}) }) as { stage: string; handoff?: string };
   if (result.stage === 'CURRENT_EMAIL') { setOperation(chosen); setHandoff(result.handoff!); setCode(''); }
   if (result.stage === 'EMAIL_PENDING') { setOperation(null); setCode(''); setPending({ email: chosen.action === 'EMAIL' ? chosen.email : '', handoff: result.handoff || waiting!.handoff }); setMessage('Check both inboxes for the email-change confirmation links, then return here.'); await query.reload(); }
   if (result.stage === 'COMPLETE') { setPending(null); setEmail(''); setMessage('Your login email has changed.'); await query.reload(); await account.reload(); }
   if (result.stage === 'DEACTIVATED') await account.signOut();
  } catch (error) { setError(error instanceof Error ? error.message : 'Could not confirm this account change.'); await query.reload(); }
  finally { lock.current = false; setBusy(false); }
 }
 return <Page embedded={embedded}>{!embedded&&<Title message={"Account security"}/>}<ErrorText message={error || query.error} />{!!message && <Copy>{message}</Copy>}<Button secondary message="Refresh account security" busy={query.loading} disabled={busy} onPress={() => { void query.reload(); }} />
  {query.data && <><Copy>Login email: {query.data.email}</Copy>
   {operation ? <Card><Title message={"Confirm it is you"}/><Copy>Enter the code sent to your current login email. {operation.action === 'EMAIL' ? `This requests a change to ${operation.email}.` : 'This deactivates your account and retains its history.'}</Copy><Field message="Account verification code" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} editable={!busy} /><Button label={operation.action === 'EMAIL' ? 'Confirm email-change request' : 'Confirm account deactivation'} disabled={!/^\d{6}$/.test(code)} busy={busy} onPress={() => { void submit('CONFIRM', operation); }} /><Button secondary message="Cancel this action" disabled={busy} onPress={() => { setOperation(null); setCode(''); setHandoff(''); }} /></Card> : waiting ? <Card><Title message={"Confirm your new email"}/><Copy>Requested email: {waiting.email}</Copy><Copy message={"Open the confirmation links from your inboxes. Return here to check when the change is complete."}/><Button message="Check email change" busy={busy} onPress={() => { void submit('CHECK', { action: 'EMAIL', email: waiting.email }); }} /></Card> : <Card><Title message={"Change login email"}/><Field message="New login email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" editable={!busy} /><Button message="Verify current email" busy={busy} disabled={!email.trim()} onPress={() => { void submit('REQUEST', { action: 'EMAIL', email: email.trim().toLowerCase() }); }} /></Card>}
   <AccountDeletion email={query.data.email}/>
   {!operation && <Card><Title message={"Deactivate account"}/><Copy message={"Access will end. Shipment, audit and document history will be retained."}/>{query.data.blockers.length ? <><Copy message={"Resolve these items first:"}/>{query.data.blockers.map(key => { const item = blockers[key] || { text: 'Contact Support about outstanding account work.', path: '/support' as const }; return <Link key={key} href={item.path} style={{ color: '#0c7275', paddingVertical: 12 }}>{item.text}</Link>; })}</> : <><Field message="Type DEACTIVATE to confirm" value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" editable={!busy} /><Button secondary message="Send deactivation code" disabled={confirmation !== 'DEACTIVATE' || !!waiting} busy={busy} onPress={() => { void submit('REQUEST', { action: 'DEACTIVATE', confirm: 'DEACTIVATE' }); }} /></>}</Card>}
  </>}</Page>;
}
