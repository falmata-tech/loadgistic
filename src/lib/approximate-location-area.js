import {nearestEthiopiaPlace} from './ethiopia-places.js';
import {isValidCoordinate} from './location-privacy.js';

/** Label an already obscured fix; a distant catalog town is not its location. */
export function approximateLocationArea(latitude,longitude) {
  if(!isValidCoordinate(latitude,longitude))throw new Error('INVALID_LOCATION');
  const place=nearestEthiopiaPlace(latitude,longitude);
  return place&&place.distanceKm<=100 ? `Around ${place.name}, Ethiopia` : 'Around current device area';
}
