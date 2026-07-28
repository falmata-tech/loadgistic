import { normalizePlace } from './route-matching.js';
import { placeLocalName } from './place-labels.js';

const PLACE_COORDINATES = Object.freeze({
  'addis ababa': { name:'Addis Ababa', lat:9.03, lng:38.74 },
  adama: { name:'Adama', lat:8.54, lng:39.27 },
  'bahir dar': { name:'Bahir Dar', lat:11.59, lng:37.39 },
  bishoftu: { name:'Bishoftu', lat:8.75, lng:38.99 },
  dessie: { name:'Dessie', lat:11.13, lng:39.63 },
  'dire dawa': { name:'Dire Dawa', lat:9.60, lng:41.87 },
  gambela: { name:'Gambela', lat:8.25, lng:34.59 },
  gondar: { name:'Gondar', lat:12.60, lng:37.47 },
  harar: { name:'Harar', lat:9.31, lng:42.12 },
  hawassa: { name:'Hawassa', lat:7.06, lng:38.48 },
  'jijiga': { name:'Jijiga', lat:9.35, lng:42.80 },
  jimma: { name:'Jimma', lat:7.67, lng:36.83 },
  mekelle: { name:'Mekelle', lat:13.50, lng:39.48 },
  nekemte: { name:'Nekemte', lat:9.09, lng:36.55 },
  'shashamane': { name:'Shashamane', lat:7.20, lng:38.60 },
  semera: { name:'Semera', lat:11.79, lng:41.01 },
  wolaita: { name:'Wolaita', lat:6.86, lng:37.76 },
  'wolaita sodo': { name:'Wolaita Sodo', lat:6.86, lng:37.76 },
  arba_minch: { name:'Arba Minch', lat:6.04, lng:37.55 },
  'arba minch': { name:'Arba Minch', lat:6.04, lng:37.55 },
  asella: { name:'Asella', lat:7.95, lng:39.13 },
  axum: { name:'Axum', lat:14.13, lng:38.72 },
  bale_robe: { name:'Bale Robe', lat:7.12, lng:40.00 },
  'bale robe': { name:'Bale Robe', lat:7.12, lng:40.00 },
  debre_birhan: { name:'Debre Birhan', lat:9.68, lng:39.53 },
  'debre birhan': { name:'Debre Birhan', lat:9.68, lng:39.53 },
  debre_markos: { name:'Debre Markos', lat:10.34, lng:37.73 },
  'debre markos': { name:'Debre Markos', lat:10.34, lng:37.73 },
  dilla: { name:'Dilla', lat:6.41, lng:38.31 },
  hosanna: { name:'Hosanna', lat:7.55, lng:37.85 },
  kombolcha: { name:'Kombolcha', lat:11.08, lng:39.74 },
  mettu: { name:'Mettu', lat:8.30, lng:35.58 },
  mojo: { name:'Mojo', lat:8.59, lng:39.12 },
  shire: { name:'Shire', lat:14.10, lng:38.28 },
  woldiya: { name:'Woldiya', lat:11.83, lng:39.60 }
});

export const ETHIOPIA_PLACES = Object.freeze(
  [...new Map(Object.values(PLACE_COORDINATES).map(place => [place.name,place])).values()]
    .sort((a,b) => a.name.localeCompare(b.name))
);

export function getPlaceCoordinate(value) {
  return PLACE_COORDINATES[normalizePlace(placeLocalName(value))] || null;
}

export function nearestEthiopiaPlace(lat,lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return ETHIOPIA_PLACES.map(place => {
    const latitudeScale = 111;
    const longitudeScale = 111 * Math.cos((lat * Math.PI) / 180);
    const distanceKm = Math.hypot((place.lat-lat)*latitudeScale,(place.lng-lng)*longitudeScale);
    return {...place,distanceKm};
  }).sort((a,b) => a.distanceKm-b.distanceKm)[0] || null;
}
