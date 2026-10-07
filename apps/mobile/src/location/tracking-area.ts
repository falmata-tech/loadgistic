import type { Feature, Polygon } from 'geojson';
export type TrackingArea = { latitude: number; longitude: number; radius: number; area: string; updatedAt: string };
export function trackingAreaGeometry(location: TrackingArea): Feature<Polygon> | null {
 const { latitude, longitude, radius } = location;
 if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(radius) || latitude < 3 || latitude > 15 || longitude < 32 || longitude > 49 || ![1, 3, 5, 10, 20, 40].includes(radius)) return null;
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
 return input.foreground && !input.busy && input.canLocate && input.mode === 'LOCATION_AND_STATUS' && ['TO_PICKUP', 'IN_TRANSIT'].includes(input.status)
  && now - Math.max(input.lastAttempt, Date.parse(input.lastUpdate) || 0) >= 10 * 60 * 1000;
}
