export type CapacityLoadPreference = 'FTL' | 'PTL' | 'BOTH';
export function capacityLoadPreference(status: unknown, acceptsFull: unknown, acceptsPartial: unknown): CapacityLoadPreference | null;
export const CAPACITY_LOAD_CHOICES: [CapacityLoadPreference, string][];
export function capacityLoadLabel(preference: string | null | undefined): string | null;
export function capacityLoadExplanation(preference: string | null | undefined): string;
