import { distanceBetweenKm } from './domain.js';

export function normalizePlace(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function coordinate(record, endpoint) {
  const lat = Number(record?.[`${endpoint}_lat`]);
  const lng = Number(record?.[`${endpoint}_lng`]);
  return Number.isFinite(lat) && Number.isFinite(lng) ? {lat,lng} : null;
}

function boundedRadius(value, fallback = 50) {
  const radius = Number(value);
  return Number.isFinite(radius) && radius >= 5 && radius <= 300 ? radius : fallback;
}

function orientationMatch(query, candidate, originRadiusKm, destinationRadiusKm, reversed) {
  const queryOrigin = coordinate(query,'origin');
  const queryDestination = coordinate(query,'destination');
  const candidateOrigin = coordinate(candidate,reversed ? 'destination' : 'origin');
  const candidateDestination = coordinate(candidate,reversed ? 'origin' : 'destination');
  if (!queryOrigin || !queryDestination || !candidateOrigin || !candidateDestination) return null;
  const originDistanceKm = distanceBetweenKm(queryOrigin,candidateOrigin);
  const destinationDistanceKm = distanceBetweenKm(queryDestination,candidateDestination);
  const originMatches = originDistanceKm <= originRadiusKm;
  const destinationMatches = destinationDistanceKm <= destinationRadiusKm;
  const matchedEndpoints = Number(originMatches) + Number(destinationMatches);
  const originRatio = originDistanceKm / originRadiusKm;
  const destinationRatio = destinationDistanceKm / destinationRadiusKm;
  return {
    matched:matchedEndpoints === 2,
    score:matchedEndpoints,
    origin_distance_km:originDistanceKm,
    destination_distance_km:destinationDistanceKm,
    worst_ratio:Math.max(originRatio,destinationRatio),
    total_distance_km:originDistanceKm + destinationDistanceKm,
    direction:reversed ? 'REVERSE' : 'DIRECT'
  };
}

export function geographicRouteMatch(query, candidate, options = {}) {
  const originRadiusKm = boundedRadius(options.originRadiusKm);
  const destinationRadiusKm = boundedRadius(options.destinationRadiusKm);
  const directionMode = options.directionMode === 'EITHER' ? 'EITHER' : 'DIRECT';
  const direct = orientationMatch(query,candidate,originRadiusKm,destinationRadiusKm,false);
  const reverse = directionMode === 'EITHER'
    ? orientationMatch(query,candidate,originRadiusKm,destinationRadiusKm,true)
    : null;
  const ranked = [direct,reverse].filter(Boolean).sort((first,second) =>
    second.score-first.score || first.worst_ratio-second.worst_ratio || first.total_distance_km-second.total_distance_km
  );
  const best = ranked[0];
  if (!best) {
    return {
      matched:false,score:0,label:'Location needs confirmation',direction:null,
      origin_distance_km:null,destination_distance_km:null,worst_ratio:null,total_distance_km:null
    };
  }
  const roundedOrigin = Math.round(best.origin_distance_km);
  const roundedDestination = Math.round(best.destination_distance_km);
  const label = best.score === 2
    ? `Route match · ${roundedOrigin} km / ${roundedDestination} km`
    : best.score === 1
      ? `One endpoint nearby · ${roundedOrigin} km / ${roundedDestination} km`
      : `Outside route radius · ${roundedOrigin} km / ${roundedDestination} km`;
  return {...best,label,origin_radius_km:originRadiusKm,destination_radius_km:destinationRadiusKm};
}

export function bestGeographicRouteMatch(query, candidates, options = {}) {
  return (candidates || []).map(candidate => ({
    ...candidate,
    ...geographicRouteMatch(query,candidate,options)
  })).sort((first,second) =>
    second.score-first.score
    || Number(first.worst_ratio ?? Number.POSITIVE_INFINITY)-Number(second.worst_ratio ?? Number.POSITIVE_INFINITY)
    || Number(first.total_distance_km ?? Number.POSITIVE_INFINITY)-Number(second.total_distance_km ?? Number.POSITIVE_INFINITY)
  )[0] || null;
}

export function uncertaintyAreasOverlap(queryArea, candidateArea) {
  const distanceKm = distanceBetweenKm(
    {lat:queryArea?.center_lat,lng:queryArea?.center_lng},
    {lat:candidateArea?.center_lat,lng:candidateArea?.center_lng}
  );
  const queryRadiusKm = boundedRadius(queryArea?.radius_km);
  const candidateRadiusKm = boundedRadius(candidateArea?.radius_km,40);
  return {
    matched:distanceKm !== null && distanceKm <= queryRadiusKm + candidateRadiusKm,
    distance_km:distanceKm,
    combined_radius_km:queryRadiusKm + candidateRadiusKm
  };
}
