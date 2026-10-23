import { useRef, useState } from 'react';
import { AccountDeletion } from '../components/account-deletion';

import { Link, Redirect } from 'expo-router';
import { useAccount } from '../session/provider';
import { useAccountQuery } from '../hooks/account-query';
import { Page, Title, Copy, Card, Field, Button, ErrorText, LoadingSpinner } from '../components/ui';
import {WorkspaceAction,WorkspaceFact} from '../components/workspace-task';
import {useLanguage} from '../localization/provider';
type Operation = { action: 'EMAIL'; email: string } | { action: 'DEACTIVATE'; confirm: 'DEACTIVATE' };
type Security = { email: string; pendingEmail: string; pendingHandoff: string; blockers: string[] };
const blockers: Record<string, { text: string; path: '/shipments' | '/fleet' | '/support' | '/workspaces' }> = {
 BUSINESS_OWNER_HANDOVER_REQUIRED:{text:'Transfer ownership or archive your workspace before closing your account.',path:'/workspaces'},
 ACTIVE_TRACKING: { text: 'Complete, cancel or reassign active tracking.', path: '/shipments' },
 ACTIVE_TRUCKS: { text: 'Retire your active vehicles.', path: '/fleet' },
 DRIVER_ASSIGNMENT: { text: 'Ask your fleet owner to end your vehicle assignment.', path: '/support' },
 ACTIVE_FLEET_MEMBERS: { text: 'Resolve active fleet memberships.', path: '/fleet' },
 PENDING_INVITATIONS: { text: 'Cancel pending driver invitations.', path: '/fleet' },
 OPEN_SUPPORT: { text: 'End your open Support chat.', path: '/support' },
};
export default function AccountSecurityScreen({embedded=false}:{embedded?:boolean}={}) {
 const account = useAccount();
 if (account.busy) return <Page embedded={embedded}><LoadingSpinner /></Page>;
 if (!account.session) return <Redirect href="/account" />;
 return <SecurityControls key={account.session.user.id} embedded={embedded} />;
}
function SecurityControls({embedded}:{embedded:boolean}) {
 const {t}=useLanguage();
 const account = useAccount(), query = useAccountQuery<Security>('/api/mobile/account/security');
 const [task,setTask]=useState('');
 const [email, setEmail] = useState(''), [confirmation, setConfirmation] = useState(''), [code, setCode] = useState(''), [operation, setOperation] = useState<Operation | null>(null), [handoff, setHandoff] = useState(''), [pending, setPending] = useState<{ email: string; handoff: string } | null>(null);
 const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''), lock = useRef(false);
 const waiting = pending || (query.data?.pendingEmail ? { email: query.data.pendingEmail, handoff: query.data.pendingHandoff } : null);
 async function submit(step: 'REQUEST' | 'CONFIRM' | 'CHECK', chosen: Operation) {
  if (lock.current) return; lock.current = true; setBusy(true); setError(''); setMessage('');
  try {
   const result = await account.request('/api/mobile/account/security', { step, operation: chosen, ...(step === 'CONFIRM' ? { handoff, code: code.trim() } : step === 'CHECK' ? { handoff: waiting!.handoff } : {}) }) as { stage: string; handoff?: string };
   if (result.stage === 'CURRENT_EMAIL') { setOperation(chosen); setHandoff(result.handoff!); setCode(''); }
   if (result.stage === 'EMAIL_PENDING') { setOperation(null); setCode(''); setPending({ email: chosen.action === 'EMAIL' ? chosen.email : '', handoff: result.handoff || waiting!.handoff }); setMessage('Check both inboxes for the email-change confirmation links, then return here.'); await query.reload(); }
   if (result.stage === 'COMPLETE') { setTask('');setPending(null); setEmail(''); setMessage('Your login email has changed.'); await query.reload(); await account.reload(); }
   if (result.stage === 'DEACTIVATED') await account.signOut();
  } catch (error) { setError(error instanceof Error ? error.message : 'Could not confirm this account change.'); await query.reload(); }
  finally { lock.current = false; setBusy(false); }
 }
 return <Page embedded={embedded}>{!embedded&&<Title message={"Account security"}/>}<ErrorText message={t(error || query.error || '')} />{!!message && <Copy>{t(message)}</Copy>}<Button secondary message="Refresh account security" busy={query.loading} disabled={busy} onPress={() => { void query.reload(); }} />
  {query.data&&<><WorkspaceFact message="Login email" value={query.data.email}/>{(task==='DELETE'||!operation&&!waiting&&Boolean(task))&&<Button secondary message="Back to security" busy={busy} onPress={()=>{setTask('');setEmail('');setConfirmation('');setError('');}}/>}
   {task!=='DELETE'&&(operation ? <Card><Title message={"Confirm it is you"}/><Copy>{t('Enter the code sent to your current login email.')} {operation.action === 'EMAIL' ? t('This requests a change to {email}.',{email:operation.email}) : t('This deactivates your account and retains its history.')}</Copy><Field message="Account verification code" value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} editable={!busy} /><Button label={t(operation.action === 'EMAIL' ? 'Confirm email-change request' : 'Confirm account deactivation')} disabled={!/^\d{6}$/.test(code)} busy={busy} onPress={() => { void submit('CONFIRM', operation); }} /><Button secondary message="Cancel this action" disabled={busy} onPress={() => { setOperation(null);setTask('');setCode('');setHandoff(''); }} /></Card> : waiting ? <Card><Title message={"Confirm your new email"}/><Copy>{t('Requested email: {email}',{email:waiting.email})}</Copy><Copy message={"Open the confirmation links from your inboxes. Return here to check when the change is complete."}/><Button message="Check email change" busy={busy} onPress={() => { void submit('CHECK', { action: 'EMAIL', email: waiting.email }); }} /></Card> : task==='EMAIL'?<Card><Title message="Change login email"/><Field message="New login email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" editable={!busy} /><Button message="Verify current email" busy={busy} disabled={!email.trim()} onPress={() => { void submit('REQUEST', { action: 'EMAIL', email: email.trim().toLowerCase() }); }} /></Card>:null)}
   {task==='DELETE'&&<AccountDeletion email={query.data.email}/>}
   {task==='DEACTIVATE'&&!operation&&!waiting&&<Card><Title message="Deactivate account"/><Copy message={"Access will end. Shipment, audit and document history will be retained."}/>{query.data.blockers.length ? <><Copy message={"Resolve these items first:"}/>{query.data.blockers.map(key => { const item = blockers[key] || { text: 'Contact Support about outstanding account work.', path: '/support' as const }; return <Link key={key} href={item.path} style={{ color: '#155eef', paddingVertical: 12 }}>{t(item.text)}</Link>; })}</> : <><Field message="Type DEACTIVATE to confirm" value={confirmation} onChangeText={setConfirmation} autoCapitalize="characters" editable={!busy} /><Button secondary message="Send deactivation code" disabled={confirmation !== 'DEACTIVATE' || !!waiting} busy={busy} onPress={() => { void submit('REQUEST', { action: 'DEACTIVATE', confirm: 'DEACTIVATE' }); }} /></>}</Card>}
   {!task&&!operation&&!waiting&&<><WorkspaceAction message="Change login email" icon="key" onPress={()=>setTask('EMAIL')}/><WorkspaceAction message="Deactivate account" icon="shield" onPress={()=>setTask('DEACTIVATE')}/><WorkspaceAction message="Delete account and data" icon="documents" onPress={()=>setTask('DELETE')}/></>}
   {Boolean(waiting)&&task!=='DELETE'&&<WorkspaceAction message="Delete account and data" icon="documents" onPress={()=>setTask('DELETE')}/>}
  </>}</Page>;
}
