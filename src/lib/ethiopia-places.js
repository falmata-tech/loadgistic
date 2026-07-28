import { normalizePlace } from './route-matching.js';

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
  'wolaita sodo': { name:'Wolaita Sodo', lat:6.86, lng:37.76 }
});

export function getPlaceCoordinate(value) {
  return PLACE_COORDINATES[normalizePlace(value)] || null;
}
