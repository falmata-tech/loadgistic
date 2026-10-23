export type CapacitySharingMode = 'PUBLIC' | 'PRIVATE' | 'BOTH' | 'EXCLUSIVE';
export const CAPACITY_SHARING_CHOICES: [CapacitySharingMode, string][];
export function capacitySharingMode(value: unknown, legacyVisibility?: unknown): CapacitySharingMode;
export function capacitySharingLabel(value: unknown): string;
