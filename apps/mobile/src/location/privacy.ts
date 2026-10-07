import { obscureCoordinate, LOCAL_CAPACITY_PRIVACY_RADII_KM } from '../../../../src/lib/location-privacy.js';
export const privacyRadii = LOCAL_CAPACITY_PRIVACY_RADII_KM;
export type ApproximateFix = { approximateLat: number; approximateLng: number; locationPrecisionKm: number };
export function capacityLocation(latitude: number, longitude: number, accuracy: number | null, radius: number): ApproximateFix {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < 3 || latitude > 15 || longitude < 32 || longitude > 49) throw new Error('Truck location must be within the supported Ethiopia area.');
  if (!privacyRadii.includes(radius)) throw new Error('Choose an approximate location radius.');
  if (accuracy === null || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > radius * 1000) throw new Error('Your location is not accurate enough yet. Try again outside or choose a wider radius.');
  const point = obscureCoordinate(latitude, longitude, radius);
  if (point.lat < 3 || point.lat > 15 || point.lng < 32 || point.lng > 49) throw new Error('Choose a smaller radius near the edge of the supported area.');
  return { approximateLat: point.lat, approximateLng: point.lng, locationPrecisionKm: radius };
}
