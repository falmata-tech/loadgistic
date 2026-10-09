import { useRef, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { Link, Redirect, router } from 'expo-router';
import { useAccount } from '../session/provider';
import { useAccountQuery } from '../hooks/account-query';
import { useForegroundRefresh } from '../hooks/foreground-refresh';
import { supportTopic, supportTopics, type SupportList, type SupportSummary } from '../api/support';
import { Page, Title, Copy, Card, Field, Button, ErrorText } from '../components/ui';
import { Choices } from '../components/choices';
import { useLanguage } from '../localization/provider';
export default function SupportScreen() {
 const account = useAccount();
 if (account.busy) return <Page><ActivityIndicator /></Page>;
 if (!account.session) return <Redirect href="/account" />;
 return <MemberSupport key={account.session.user.id} />;
}
function ChatCard({ item }: { item: SupportSummary }) {
 const {t,locale}=useLanguage();
 return <Card><Title>{t(supportTopic(item.category))}</Title><Copy>{item.preview}</Copy><Copy>{item.status === 'CLOSED' ? t('Ended') : item.agent ? t('Assigned to {agent}',{agent:item.agent}) : t('Waiting for an available support agent')}</Copy><Copy>{new Date(item.updatedAt).toLocaleString(locale)}</Copy><Link href={{ pathname: '/support-chat', params: { id: item.id } }} style={{ paddingVertical: 12, color: '#0c7275' }}>{item.status === 'CLOSED' ? t('View past chat') : t('Continue chat')}</Link></Card>;
}
function MemberSupport() {
 const {t}=useLanguage();
 const account = useAccount(), [page, setPage] = useState(1), [starting, setStarting] = useState(false), [category, setCategory] = useState('ACCOUNT'), [body, setBody] = useState('');
 const [busy, setBusy] = useState(false), [error, setError] = useState(''), lock = useRef(false);
 const query = useAccountQuery<SupportList>(`/api/mobile/support?page=${page}`);
 useForegroundRefresh(query.refresh, !!query.data?.open && !starting);
 async function start() { if (lock.current) return; lock.current = true; setBusy(true); setError('');
  try { const result = await account.request('/api/mobile/support', { category, body: body.trim() }) as { id: string }; setBody(''); setStarting(false); router.push({ pathname: '/support-chat', params: { id: result.id } }); }
  catch (error) { setError(`${error instanceof Error ? error.message : t('Could not confirm the request.')} ${t('Refresh Support before trying again.')}`); }
  finally { lock.current = false; setBusy(false); }
 }
 return <Page><Title message={"Support"}/><Copy message={"Help with your account, trucks or shipments."}/><ErrorText message={query.error || error} /><Button secondary message="Refresh Support" busy={query.loading} onPress={() => { void query.reload(); }} />
  {query.data && <>{query.data.open ? <><ChatCard item={query.data.open} /><Copy message={"One active chat at a time. End it when you no longer need help."}/></> : starting ? <Card><Title message={"How can we help?"}/><Choices value={category} options={supportTopics.map(item=>({...item,label:t(item.label)}))} onChange={setCategory} disabled={busy} /><Field message="What do you need help with?" value={body} onChangeText={setBody} multiline maxLength={2000} editable={!busy} /><Button message="Send to support" busy={busy} disabled={!body.trim()} onPress={() => { void start(); }} /><Button secondary message="Cancel" disabled={busy} onPress={() => setStarting(false)} /></Card> : <Button message="New chat" onPress={() => setStarting(true)} />}
  <Title message={"Past chats"}/>{!query.data.history.length && <Copy message={"No past chats yet."}/>}{query.data.history.map(item => <ChatCard key={item.id} item={item} />)}
  {query.data.pageCount > 1 && <><Copy>{t('Page {page} of {pages}',{page:query.data.page,pages:query.data.pageCount})}</Copy><Button secondary message="Previous chats" disabled={page <= 1 || query.loading} onPress={() => setPage(value => value - 1)} /><Button secondary message="Next chats" disabled={page >= query.data!.pageCount || query.loading} onPress={() => setPage(value => value + 1)} /></>}
  </>}<Copy message={"Support never asks for passwords, PINs or sign-in codes."}/></Page>;
}
