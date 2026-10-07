import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { Redirect, useFocusEffect } from 'expo-router';
import { useAccount } from '../session/provider';
import { Page, Title, Copy, Field, Button, ErrorText } from '../components/ui';
export default function AccountDetails({embedded=false}:{embedded?:boolean}={}) {
  const account = useAccount(), dirty = useRef(false);
  const [name, setName] = useState(''), [phone, setPhone] = useState(''), [email, setEmail] = useState(''), [error, setError] = useState(''), [saved, setSaved] = useState(false), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const request = account.request, userId = account.session?.user.id;
 useFocusEffect(useCallback(() => { let mounted = true; if (!userId) return;
    request('/api/mobile/account').then(value => { if (mounted && !dirty.current) { const data = value as { name: string; phone: string; email: string }; setName(data.name); setPhone(data.phone); setEmail(data.email); } }).catch(error => { if (mounted) setError(error instanceof Error ? error.message : 'Could not load your account.'); }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [request, userId]));
  if (account.busy) return <Page embedded={embedded}><ActivityIndicator /></Page>;
  if (!account.session) return <Redirect href="/account" />;
  const save = async () => { setSaving(true); setError(''); setSaved(false); try { await account.request('/api/mobile/account', { name, phone }); dirty.current=false; setSaved(true); await account.reload(); } catch (error) { setError(error instanceof Error ? error.message : 'Could not save.'); } finally { setSaving(false); } };
  return <Page embedded={embedded}>{!embedded&&<Title message={"Account details"}/>}<Copy>{email}</Copy><ErrorText message={error} />{loading ? <ActivityIndicator /> : <><Field message="Your name" value={name} onChangeText={value=>{dirty.current=true;setSaved(false);setName(value);}} editable={!saving} /><Field message="Phone number" value={phone} onChangeText={value=>{dirty.current=true;setSaved(false);setPhone(value);}} keyboardType="phone-pad" editable={!saving} /><Button message="Save changes" onPress={save} busy={saving} />{saved && <Copy message={"Account details saved."}/>}</>}</Page>;
}
