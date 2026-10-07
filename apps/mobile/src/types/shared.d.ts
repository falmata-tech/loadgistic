declare module '*location-privacy.js' {
  export function obscureCoordinate(lat: number, lng: number, distanceKm: number): { lat: number; lng: number };
  export const LOCAL_CAPACITY_PRIVACY_RADII_KM: readonly number[];
}

declare module '*tracking-progress.js' {
 export const TRACKING_JOURNEY: readonly string[];
 export function trackingProgress(status: string, currentStatus: string, recordedStatuses: string[], nextStatuses: string[]): string;
}

declare module '*tracking-location-controls.js' {
 export function trackingLocationResult(result: { recorded?: boolean; reason?: string }): 'saved' | 'waiting';
}
