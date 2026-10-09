import type { Feature, Polygon } from 'geojson';
import {isValidCoordinate} from '../../../../src/lib/location-privacy.js';
export type TrackingArea = { latitude: number; longitude: number; radius: number; area: string; updatedAt: string };
export function trackingAreaGeometry(location: TrackingArea): Feature<Polygon> | null {
 const { latitude, longitude, radius } = location;
 if (!isValidCoordinate(latitude,longitude) || !Number.isFinite(radius) || ![1, 3, 5, 10, 20, 40].includes(radius)) return null;
 const lat = latitude * Math.PI / 180, lng = longitude * Math.PI / 180, distance = radius / 6371;
 const ring = Array.from({ length: 64 }, (_, index) => {
  const bearing = index * 2 * Math.PI / 64;
  const y = Math.asin(Math.sin(lat) * Math.cos(distance) + Math.cos(lat) * Math.sin(distance) * Math.cos(bearing));
  const x = lng + Math.atan2(Math.sin(bearing) * Math.sin(distance) * Math.cos(lat), Math.cos(distance) - Math.sin(lat) * Math.sin(y));
  return [x * 180 / Math.PI, y * 180 / Math.PI];
 }); ring.push([...ring[0]]);
 return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
}
export function foregroundTrackingDue(input: { status: string; canLocate: boolean; mode: string; foreground: boolean; busy: boolean; lastAttempt: number; lastUpdate: string }, now = Date.now()) {
 return input.foreground && !input.busy && input.canLocate && input.mode === 'LOCATION_AND_STATUS' && !['COMPLETED','CANCELLED'].includes(input.status)
  && now - Math.max(input.lastAttempt, Date.parse(input.lastUpdate) || 0) >= 10 * 60 * 1000;
}
