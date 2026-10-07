import type {ApproximateFix} from './privacy';

export const capacityLocationInterval = 10 * 60 * 1000;
type LocatedTruck = { id: string; canLocate: boolean; current: {status: string} | null; location: {updatedAt: string; radius: number} | null };
export function foregroundCapacityDue(truck: LocatedTruck, lastAttempt: number, now = Date.now()) {
  return truck.canLocate && !!truck.current && ['EMPTY', 'PARTIAL'].includes(truck.current.status)
    && now - Math.max(lastAttempt, Date.parse(truck.location?.updatedAt || '') || 0) >= capacityLocationInterval;
}

// Capture and persistence are separate ports. Reauthorize before reading GPS and
// discard late fixes after blur/background/editor changes. The server command
// independently reauthorizes any assignment/duty change during capture.
export async function refreshForegroundCapacity(input: {
  vehicleId: string; lastAttempt: number; now?: number; active: () => boolean;
  read: () => Promise<{vehicles: LocatedTruck[]}>;
  capture: (radius: number) => Promise<ApproximateFix>;
  save: (body: ApproximateFix & {action: 'LOCATION'; vehicleId: string}) => Promise<unknown>;
}): Promise<'saved' | 'paused' | 'not-due'> {
  if (!input.active()) return 'paused';
  const truck = (await input.read()).vehicles.find(item => item.id === input.vehicleId);
  if (!input.active()) return 'paused';
  if (!truck || !foregroundCapacityDue(truck, input.lastAttempt, input.now)) return 'not-due';
  const fix = await input.capture(truck.location?.radius || 20);
  if (!input.active()) return 'paused';
  await input.save({action: 'LOCATION', vehicleId: truck.id, ...fix});
  return 'saved';
}
