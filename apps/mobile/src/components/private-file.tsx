import { File as NativeFile } from 'expo-file-system';
import { useLanguage } from '../localization/provider';
import { uploadForm, uploadLimit } from '../api/upload';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useEffect, useRef, useState } from 'react';
import {blockChatReading} from '../session/chat-visibility';
import { AppState, Image, Modal, Platform, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Button, Copy, ErrorText, Page, Title } from './ui';
export type SelectedFile = { uri: string; name: string; type: string; size: number; webFile?: globalThis.File };
export const maxFileSize = uploadLimit;
export function uploadBody(command: unknown, file: SelectedFile) {
 // SDK 57 global expo/fetch consumes File/Blob bytes; URI descriptors are unsupported.
 const source = Platform.OS === 'web' ? file.webFile : new NativeFile(file.uri);
 if (!source) throw new Error('Please choose the file again.');
 return uploadForm(command, source);
}
async function removeSelection(file: SelectedFile | null) {
 if (!file || Platform.OS === 'web') return;
 const { File, Paths } = await import('expo-file-system');
 // Delete only the copy created by DocumentPicker, never a user's original.
 if (file.uri.startsWith(Paths.cache.uri.replace(/\/?$/, '/') + 'DocumentPicker/')) { const copy = new File(file.uri); if (copy.exists) copy.delete(); }
}
export function useFileSelection() {
 const [file, setFile] = useState<SelectedFile | null>(null), current = useRef<SelectedFile | null>(null);
 const replace = useCallback((value: SelectedFile | null) => { const previous = current.current; current.current = value; setFile(value); if (previous && previous.uri !== value?.uri) void removeSelection(previous).catch(() => undefined); }, []);
 useEffect(() => () => { void removeSelection(current.current).catch(() => undefined); }, []);
 return { file, setFile: replace };
}
export function FilePicker({ file, onChange, imagesOnly = false, disabled = false }: { file: SelectedFile | null; onChange: (file: SelectedFile | null) => void; imagesOnly?: boolean; disabled?: boolean }) {
 const {t}=useLanguage();
 const [error, setError] = useState(''), [busy, setBusy] = useState(false), lock = useRef(false), mounted = useRef(true);
 useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
 async function choose() {
  if (lock.current) return; lock.current = true; setBusy(true); setError('');
  try { const types = ['image/jpeg', 'image/png', 'image/webp', ...imagesOnly ? [] : ['application/pdf']];
   const result = await DocumentPicker.getDocumentAsync({ type: types, multiple: false, copyToCacheDirectory: true });
   if (result.canceled) return;
   const asset = result.assets[0], selected: SelectedFile = { uri: asset.uri, name: asset.name, type: asset.mimeType || '', size: asset.size || 0, webFile: asset.file };
   if (!mounted.current || !types.includes(selected.type) || selected.size > maxFileSize || !selected.size) { await removeSelection(selected); if (mounted.current) setError(t('Choose a supported file smaller than 4 MB.')); return; }
   onChange(selected);
  } catch { if (mounted.current) setError(t('Could not open this file. Please choose it again.')); }
  finally { lock.current = false; if (mounted.current) setBusy(false); }
 }
 return <View style={{ gap: 8 }}><Copy>{imagesOnly ? t('JPG, PNG or WebP photo') : t('JPG, PNG, WebP or PDF')} · {t('Up to 4 MB')}</Copy>{file && <Copy>{file.name}</Copy>}<Button secondary label={file ? t('Choose another file') : t('Choose file')} onPress={() => { void choose(); }} busy={busy} disabled={disabled} />{file && <Button secondary message="Remove selected file" disabled={disabled || busy} onPress={() => onChange(null)} />}<ErrorText message={error} /></View>;
}
type FileData = { base64: string; mimeType: string };
export function PrivateFile({ load, label }: { load: () => Promise<unknown>; label?: string }) {
 const {t}=useLanguage();
 const [data, setData] = useState<FileData | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
 const overlay=useRef({});useEffect(()=>{const source=overlay.current;blockChatReading(source,!!data);return()=>blockChatReading(source,false);},[data]);
 const generation = useRef(0), lock = useRef(false), focused = useRef(false);
 useFocusEffect(useCallback(() => { focused.current = true; return () => { focused.current = false; generation.current++; setData(null); }; }, []));
 useEffect(() => { const subscription = AppState.addEventListener('change', state => { if (state !== 'active') { generation.current++; setData(null); } }); return () => subscription.remove(); }, []);
 async function open() {
  if (lock.current) return; lock.current = true; setBusy(true); setError(''); const version = generation.current;
  try { const value = await load() as FileData;
   if (!focused.current || generation.current !== version || AppState.currentState !== 'active') return;
   if (!value || !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(value.mimeType) || typeof value.base64 !== 'string' || value.base64.length > Math.ceil(maxFileSize / 3) * 4) throw new Error('This file cannot be opened.');
   setData(value);
  } catch (error) { if (generation.current === version && focused.current) setError(error instanceof Error ? error.message : 'Could not open this file.'); }
  finally { lock.current = false; setBusy(false); }
 }
 async function exportPdf() {
  if (!data || lock.current) return; lock.current = true; setBusy(true); setError('');
  let cleanup: (() => void) | undefined;
  try {
   const Sharing = await import('expo-sharing'), { File, Paths } = await import('expo-file-system');
   if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is unavailable on this device.');
   const temporary = new File(Paths.cache, `loadgistic-document-${Date.now()}.pdf`); cleanup = () => { if (temporary.exists) temporary.delete(); };
   temporary.write(data.base64, { encoding: 'base64' });
   await Sharing.shareAsync(temporary.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Open your document' });
  } catch (error) { setError(error instanceof Error ? error.message : 'Could not open the document.'); }
  finally { cleanup?.(); lock.current = false; setBusy(false); setData(null); }
 }
 return <><Button secondary label={label ?? t('Open document')} onPress={() => { void open(); }} busy={busy} /><ErrorText message={error} />
  <Modal visible={!!data} onRequestClose={() => setData(null)} animationType="slide"><SafeAreaView style={{ flex: 1 }}><Page><Title message={"Private document"}/><Button message="Close document" onPress={() => setData(null)} />{data?.mimeType.startsWith('image/') && <Image accessibilityLabel="Submitted document" source={{ uri: `data:${data.mimeType};base64,${data.base64}` }} resizeMode="contain" style={{ width: '100%', height: 520 }} />}{data?.mimeType === 'application/pdf' && <><Copy message={"Open, save or share a copy using an app on your phone. Only share it with people you trust."}/><Button message="Open or share PDF" busy={busy} onPress={() => { void exportPdf(); }} /></>}<ErrorText message={error} /></Page></SafeAreaView></Modal>
 </>;
}
