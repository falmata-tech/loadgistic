import { obscureCoordinate, isValidCoordinate, LOCAL_CAPACITY_PRIVACY_RADII_KM } from '../../../../src/lib/location-privacy.js';
export const privacyRadii = LOCAL_CAPACITY_PRIVACY_RADII_KM;
export type ApproximateFix = { approximateLat: number; approximateLng: number; locationPrecisionKm: number };
export function capacityLocation(latitude: number, longitude: number, accuracy: number | null, radius: number): ApproximateFix {
  if (!isValidCoordinate(latitude,longitude)) throw new Error('Your device returned an invalid location. Try again.');
  if (!privacyRadii.includes(radius)) throw new Error('Choose an approximate location radius.');
  if (accuracy === null || !Number.isFinite(accuracy) || accuracy < 0 || accuracy > radius * 1000) throw new Error('Your location is not accurate enough yet. Try again outside or choose a wider radius.');
  const point = obscureCoordinate(latitude, longitude, radius);
  return { approximateLat: point.lat, approximateLng: point.lng, locationPrecisionKm: radius };
}
