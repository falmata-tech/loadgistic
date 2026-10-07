import { useState } from 'react';
import { Image, Modal, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiOrigin } from '../api/http';
import { Page, Title, Button } from './ui';
export type Configuration = { name: string; image: string };
export function ConfigurationPicker({ value, options, onChange, disabled = false, label = 'Choose truck configuration' }: { value: string; options: Configuration[]; onChange: (value: string) => void; disabled?: boolean; label?: string }) {
 const [open, setOpen] = useState(false), selected = options.find(item => item.name === value);
 return <View style={{ gap: 8 }}>{selected && <Image source={{ uri: apiOrigin + selected.image }} accessibilityLabel={selected.name} style={{ width: 140, height: 100 }} resizeMode="contain" />}<Button secondary label={value || label} disabled={disabled} onPress={() => setOpen(true)} />
 <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}><SafeAreaView style={{ flex: 1 }}><Page><Title>{label}</Title><Button secondary message="Close" onPress={() => setOpen(false)} />{options.map(item => <Pressable key={item.name} accessibilityRole="button" accessibilityLabel={item.name} onPress={() => { onChange(item.name); setOpen(false); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1, borderColor: '#cbdadb', borderRadius: 12 }}><Image source={{ uri: apiOrigin + item.image }} style={{ width: 90, height: 70 }} resizeMode="contain" /><Text style={{ flex: 1, color: '#172c46' }}>{item.name}</Text></Pressable>)}</Page></SafeAreaView></Modal></View>;
}
