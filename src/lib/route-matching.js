import { placeIdentity } from './place-labels.js';

export function normalizePlace(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function splitPlaces(value) {
  return String(value || '')
    .split(/[;\n]|(?:\s+[↔→-]\s+)/)
    .map(placeIdentity)
    .filter(Boolean);
}

export function routeMatch(origin, destination, targetOrigin, targetDestination) {
  const route = [placeIdentity(origin), placeIdentity(destination)].filter(Boolean);
  const target = [placeIdentity(targetOrigin), placeIdentity(targetDestination)].filter(Boolean);
  if (!route.length || !target.length) return { score: 0, label: 'Route not recorded' };

  const matches = target.filter(place => route.includes(place)).length;
  if (matches >= 2) return { score: 2, label: 'Full route match' };
  if (matches === 1) return { score: 1, label: 'One city aligns' };
  return { score: 0, label: 'No route match' };
}

export function textIncludes(value, search) {
  const needle = normalizePlace(search);
  return !needle || normalizePlace(value).includes(needle);
}
