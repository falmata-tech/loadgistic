export const CAPACITY_SHARING_CHOICES = [
  ['PUBLIC', 'Open Market'],
  ['PRIVATE', 'Private Network'],
  ['BOTH', 'Open Market + Private Network'],
];

export function capacitySharingMode(value, legacyVisibility) {
  if (value === 'EXCLUSIVE') return 'PRIVATE';
  return CAPACITY_SHARING_CHOICES.some(([mode]) => mode === value)
    ? value : legacyVisibility === 'OPEN' ? 'PUBLIC' : 'PRIVATE';
}

export function capacitySharingLabel(value) {
  if (value === 'EXCLUSIVE') return 'Private Network';
  return CAPACITY_SHARING_CHOICES.find(([mode]) => mode === value)?.[1] || 'Sharing not specified';
}
