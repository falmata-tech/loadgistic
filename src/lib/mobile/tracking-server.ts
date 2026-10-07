import { MobileError } from './server';
import { nearestEthiopiaPlace } from '@/lib/ethiopia-places.js';
import { errorMessage } from '@/lib/errors';
export function nativeTrackingLocation(input: { approximateLat: number; approximateLng: number; locationPrecisionKm: number } | undefined) {
  if (!input) return null;
  const place = nearestEthiopiaPlace(input.approximateLat, input.approximateLng);
  if (!place) throw new MobileError(400, 'INVALID_INPUT', 'Location is outside the supported area.');
  return { ...input, locationArea: `Around ${place.name}, Ethiopia`, locationSource: 'DEVICE_OBSCURED' };
}
export function trackingFailure(error: unknown): never {
  if (error instanceof MobileError) throw error;
  const code = error instanceof Error ? error.message : '';
  if (['FORBIDDEN', 'SUBSCRIPTION_ACCESS_REQUIRED', 'INVALID_VEHICLE', 'ASSIGNED_DRIVER_LOCATION_REQUIRED'].includes(code)) throw new MobileError(403, 'FORBIDDEN', 'This action is not available for this shipment and account.');
  if (code === 'TRACKING_CHANGED') throw new MobileError(409, 'CHANGED', 'This shipment has changed. Reload its current details before editing again.');
  if (code === 'LIFECYCLE_CONFIRMATION_REQUIRED') throw new MobileError(400, 'INVALID_INPUT', 'Confirm cancellation before continuing.');
  if (code === 'NOT_FOUND') throw new MobileError(404, 'NOT_FOUND', 'This shipment is not available.');
  if (/^(INVALID_|TRACKING_|DRIVER_REQUIRED_|ISSUE_NOTE_|LOCALITY_|ROUTE_LOCATIONS_|PROOF_NOT_ALLOWED_)/.test(code)) throw new MobileError(400, 'INVALID_INPUT', errorMessage(error));
  throw error;
}
