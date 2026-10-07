import { Pressable, Text, View } from 'react-native';
import { palette } from './ui';
export function Choices({ value, options, onChange, disabled = false }: { value: string; options: { id: string; label: string }[]; onChange: (value: string) => void; disabled?: boolean }) {
 return <View style={{ gap: 8 }}>{options.map(option => <Pressable key={option.id} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ checked: value === option.id, disabled }} disabled={disabled} onPress={() => onChange(option.id)} style={{ minHeight: 48, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: value === option.id ? palette.teal : palette.border, backgroundColor: value === option.id ? '#eaf5f4' : '#fff' }}><Text style={{ color: palette.ink, fontWeight: value === option.id ? '700' : '400' }}>{value === option.id ? '● ' : '○ '}{option.label}</Text></Pressable>)}</View>;
}
