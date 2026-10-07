import { View } from 'react-native';
import { Button } from './ui';
import { PlacePicker, emptyPlace, type Place } from './place-picker';
export function Cities({ items, onChange, minimum, label, busy }: { items: Place[]; onChange: (items: Place[]) => void; minimum: number; label: string; busy: boolean }) {
  return <View style={{ gap: 14 }}>{items.map((item, index) => <View key={index} style={{ gap: 6 }}><PlacePicker label={`${label} ${index + 1}`} value={item} onChange={place => onChange(items.map((old, at) => at === index ? place : old))} disabled={busy} />{items.length > minimum && <Button secondary label={`Remove ${label.toLowerCase()} ${index + 1}`} busy={busy} onPress={() => onChange(items.filter((_, at) => at !== index))} />}</View>)}{items.length < 5 && <Button secondary message="Add city" busy={busy} onPress={() => onChange([...items, emptyPlace()])} />}</View>;
}
