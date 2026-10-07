import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiRequest } from '../api/http';
import { Button, ErrorText, Field, Title } from './ui';
export type Place = { placeRef: string; label: string; coordinate?: number[] | null };
export const emptyPlace = (): Place => ({ placeRef: '', label: '' });
export function PlacePicker({ label, value, onChange, disabled = false }: { label: string; value: Place; onChange: (place: Place) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState(''), [results, setResults] = useState<Place[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    if (!open || query.trim().length < 2) return;
    const timer = setTimeout(() => {
      apiRequest(`/api/mobile/places?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal })
        .then(value => { if (!controller.signal.aborted) setResults((value as { results: Place[] }).results); })
        .catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Could not find cities.'); })
        .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    }, 300);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [query, open]);
  return <View style={{ gap: 6 }}><Text style={{ color: '#172c46', fontWeight: '600' }}>{label}</Text><Button secondary label={value.label || 'Choose a city'} busy={disabled} onPress={() => { setQuery(''); setResults([]); setError(''); setBusy(false); setOpen(true); }} />
    <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}><SafeAreaView style={{ flex: 1, padding: 20, gap: 16 }}><Title>{label}</Title><Field message="Search cities" value={query} onChangeText={value => { setQuery(value); setResults([]); setError(''); setBusy(value.trim().length >= 2); }} autoFocus /><Button secondary message="Close" onPress={() => setOpen(false)} /><ErrorText message={error} />{busy && <ActivityIndicator accessibilityLabel="Finding cities" />}<ScrollView keyboardShouldPersistTaps="handled">{results.map(place => <Pressable key={place.placeRef} accessibilityRole="button" onPress={() => { onChange(place); setOpen(false); }} style={{ paddingVertical: 18, borderBottomWidth: 1, borderColor: '#cbdadb' }}><Text style={{ color: '#172c46', fontSize: 16 }}>{place.label}</Text></Pressable>)}{query.trim().length >= 2 && !busy && !error && !results.length && <Text>No matching cities. Try another spelling.</Text>}</ScrollView></SafeAreaView></Modal>
  </View>;
}
