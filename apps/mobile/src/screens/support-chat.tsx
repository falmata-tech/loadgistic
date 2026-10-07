import { AppLink } from '../components/app-link';
import { useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useAccount } from '../session/provider';
import { useAccountQuery } from '../hooks/account-query';
import { useLanguage } from '../localization/provider';
import { useForegroundRefresh } from '../hooks/foreground-refresh';
import { type SupportThread, supportTopic } from '../api/support';
import { Page, Title, Copy, Card, Field, Button, ErrorText, palette } from '../components/ui';
import { FilePicker, PrivateFile, uploadBody, useFileSelection } from '../components/private-file';
export default function SupportChatScreen() {
 const account = useAccount(), params = useLocalSearchParams<{ id: string }>();
 if (account.busy) return <Page><ActivityIndicator /></Page>;
 if (!account.session) return <Redirect href="/account" />;
 if (typeof params.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(params.id)) return <Page><Title message={"Chat unavailable"}/><AppLink href="/support" message={"Return to Support"}/></Page>;
 return <MemberThread key={`${account.session.user.id}:${params.id}`} id={params.id} />;
}
function MemberThread({ id }: { id: string }) {
 const {t,locale}=useLanguage();
 const account = useAccount(), [before, setBefore] = useState(''), [body, setBody] = useState(''), [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
 const file = useFileSelection(), lock = useRef(false), path = `/api/mobile/support/${id}`;
 const query = useAccountQuery<SupportThread>(path + (before ? `?before=${encodeURIComponent(before)}` : ''));
 const closed = query.data?.status === 'CLOSED';
 useForegroundRefresh(query.refresh, !!query.data && !closed && !before && !busy);
 async function submit(end = false) { if (lock.current) return; lock.current = true; setBusy(true); setError('');
  try { const command = end ? { action: 'END', confirm: true } : { action: 'SEND', body: body.trim() };
   await account.request(path, !end && file.file ? uploadBody(command, file.file) : command);
   setBody(''); file.setFile(null); setConfirm(false); await query.reload();
  } catch (error) { setError(`${error instanceof Error ? error.message : t('Could not confirm the update.')} ${t('Refresh the chat before trying again.')}`); }
  finally { lock.current = false; setBusy(false); }
 }
 return <Page><AppLink href="/support" style={{ paddingVertical: 8, color: palette.teal }} message={"Support home"}/><Title>{query.data ? t(supportTopic(query.data.category)) : t('Your chat')}</Title><ErrorText message={query.error || error} /><Button secondary message="Refresh chat" busy={query.loading} onPress={() => { void query.reload(); }} />
  {query.data && <><Copy>{closed ? t('Chat ended · history is retained') : query.data.agent ? t('{agent} is helping',{agent:query.data.agent}) : t('Waiting for an available support agent. You can leave a message or end this chat.')}</Copy>
  {query.data.hasOlder && <Button secondary message="Older messages" disabled={query.loading || busy} onPress={() => setBefore(query.data!.nextBefore)} />}{!!before && <Button message="Latest messages" disabled={query.loading || busy} onPress={() => setBefore('')} />}
  {query.data.messages.map(item => <View key={item.id} style={{ padding: 14, gap: 8, borderRadius: 14, backgroundColor: item.mine ? '#eaf5f4' : '#f2f5f7', marginLeft: item.mine ? 20 : 0, marginRight: item.mine ? 0 : 20 }}><Text style={{ color: palette.ink, fontWeight: '700' }}>{item.mine ? t('You') : t('Loadgistic Support')}</Text><Text selectable style={{ color: palette.ink, lineHeight: 23 }}>{item.body}</Text>{item.attachment && <PrivateFile label={t('Open {name}',{name:item.attachment.name || t('attachment')})} load={() => account.request(`${path}/attachments/${item.attachment!.id}`)} />}<Copy>{new Date(item.createdAt).toLocaleString(locale)}</Copy></View>)}
  {closed ? <AppLink href="/support" style={{ paddingVertical: 12, color: palette.teal }} message={"Return to Support to start a new chat"}/> : !before && <Card><Field message="Message" value={body} onChangeText={setBody} multiline maxLength={2000} editable={!busy} /><Copy message={"Attachment (optional)"}/><FilePicker file={file.file} onChange={file.setFile} disabled={busy} /><Button message="Send message" busy={busy} disabled={!body.trim()} onPress={() => { void submit(); }} />{!confirm ? <Button secondary message="End chat" disabled={busy} onPress={() => setConfirm(true)} /> : <><Copy message={"End this chat? Your conversation will remain in Past chats."}/><Button message="Confirm end chat" busy={busy} onPress={() => { void submit(true); }} /><Button secondary message="Keep chatting" disabled={busy} onPress={() => setConfirm(false)} /></>}</Card>}
  </>}</Page>;
}
