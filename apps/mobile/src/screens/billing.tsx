import { useRef, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAccount } from '../session/provider';
import { useAccountQuery } from '../hooks/account-query';
import { Page, Title, Copy, Card, Field, Button, ErrorText } from '../components/ui';
import { FilePicker, PrivateFile, uploadBody, useFileSelection } from '../components/private-file';
type Billing = { plan: string; status: string; granted: boolean; endsAt: string; canSubmit: boolean; page: number; pageCount: number; proofs: { id: string; amountMinor: number; reference: string; hasFile: boolean; status: string; submittedAt: string }[] };
const states: Record<string, string> = { FREE_ACCESS: 'Free access · no payment needed', SPONSORED: 'Sponsored access', TRIAL: 'Trial', ACTIVE: 'Active', PAYMENT_UNDER_REVIEW: 'Payment awaiting review', EXPIRED_UNPAID: 'Expired · payment needed' };
export default function BillingScreen({embedded=false}:{embedded?:boolean}={}) {
 const account = useAccount(), [page, setPage] = useState(1), query = useAccountQuery<Billing>(`/api/mobile/billing?page=${page}`);
 if (account.busy) return <Page embedded={embedded}><ActivityIndicator /></Page>;
 if (!account.session) return <Redirect href="/account" />;
 return <Page embedded={embedded}>{!embedded&&<Title message={"Plan and payments"}/>}<ErrorText message={query.error} /><Button secondary message="Refresh plan and history" busy={query.loading} onPress={() => { void query.reload(); }} />{query.data && <><Card><Title>{query.data.plan || 'Your account access'}</Title><Copy>{states[query.data.status] || query.data.status.replaceAll('_', ' ')}</Copy>{!!query.data.endsAt && <Copy>{query.data.granted ? 'Access through' : 'Access ended'} {new Date(query.data.endsAt).toLocaleDateString()}</Copy>}</Card>
  {query.data.canSubmit && <Payment reload={async () => { setPage(1); await query.reload(); await account.reload(); }} />}
  <Title message={"Payment history"}/>{!query.data.proofs.length && <Copy message={"No payments submitted."}/>}{query.data.proofs.map(item => <Card key={item.id}><Title>{(item.amountMinor / 100).toLocaleString()} ETB</Title><Copy>{item.status === 'PENDING' ? 'Awaiting review' : item.status === 'APPROVED' ? 'Approved' : 'Not approved'} · {new Date(item.submittedAt).toLocaleDateString()}</Copy>{!!item.reference && <Copy>{item.reference}</Copy>}{item.hasFile && <PrivateFile label="Open receipt" load={() => account.request(`/api/mobile/billing/${item.id}`)} />}</Card>)}
  {query.data.pageCount > 1 && <><Copy>Page {query.data.page} of {query.data.pageCount}</Copy><Button secondary message="Previous payments" disabled={page <= 1 || query.loading} onPress={() => setPage(value => value - 1)} /><Button secondary message="Next payments" disabled={page >= query.data!.pageCount || query.loading} onPress={() => setPage(value => value + 1)} /></>}
 </>}</Page>;
}
function Payment({ reload }: { reload: () => Promise<void> }) {
 const account = useAccount(), file = useFileSelection(), lock = useRef(false);
 const [amount, setAmount] = useState(''), [reference, setReference] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
 async function submit() { if (lock.current) return; lock.current = true; setBusy(true); setError(''); setMessage('');
  try { const command = { amountEtb: Number(amount), reference: reference.trim() }; await account.request('/api/mobile/billing', file.file ? uploadBody(command, file.file) : command);
   file.setFile(null); setAmount(''); setReference(''); setMessage('Payment submitted for review.'); await reload();
  } catch (error) { setError(`${error instanceof Error ? error.message : 'Could not confirm submission.'} Refresh your payment history before trying again.`); }
  finally { lock.current = false; setBusy(false); }
 }
 return <Card><Title message={"Submit payment details"}/><Copy message={"Add the amount you paid and its transfer reference. Never upload passwords, PINs or sign-in codes."}/><Field message="Amount paid (ETB)" keyboardType="decimal-pad" value={amount} onChangeText={setAmount} editable={!busy} /><Field message="Transfer reference" value={reference} onChangeText={setReference} maxLength={160} editable={!busy} /><Copy message={"Receipt (optional)"}/><FilePicker file={file.file} onChange={file.setFile} disabled={busy} /><ErrorText message={error} />{!!message && <Copy>{message}</Copy>}<Button message="Submit for review" busy={busy} disabled={!Number.isFinite(Number(amount)) || Number(amount) <= 0} onPress={() => { void submit(); }} /></Card>;
}
