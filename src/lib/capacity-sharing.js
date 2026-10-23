export const CAPACITY_SHARING_CHOICES = [
  ['PUBLIC', 'Open to the public'],
  ['PRIVATE', 'Private network'],
  ['BOTH', 'Public + private network'],
  ['EXCLUSIVE', 'Exclusive to one email'],
];

export function capacitySharingMode(value, legacyVisibility) {
  return CAPACITY_SHARING_CHOICES.some(([mode]) => mode === value)
    ? value : legacyVisibility === 'OPEN' ? 'PUBLIC' : 'PRIVATE';
}

export function capacitySharingLabel(value) {
  return CAPACITY_SHARING_CHOICES.find(([mode]) => mode === value)?.[1] || 'Sharing not specified';
}
