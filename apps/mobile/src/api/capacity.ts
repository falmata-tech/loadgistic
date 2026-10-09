import type {Place} from '../components/place-picker';
export type CapacitySignal = { status: string; visibility: string; sharingMode: string; exclusiveEmail: string; exclusiveName: string; updatedAt: string; acceptedLoads: string | null; availabilityGeometry: string; route: Place[]; boundary: Place[]; areaCenter: Place; acceptsMultiPick: boolean; acceptsMultiDrop: boolean };
export type CapacityTruck = { id: string; label: string; plate: string; driver: string; canLocate: boolean; dutyConfigured: boolean; location: { area: string; radius: number; updatedAt: string; coordinate: number[] | null } | null; current: CapacitySignal | null };
export type CapacityWorkspace = { profilePublished: boolean | null; canPublish: boolean; vehicles: CapacityTruck[] };
