import { distanceBetweenKm } from './domain.js';

export function normalizePlace(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function coordinate(record, endpoint) {
  if(record?.[`${endpoint}_lat`]===null||record?.[`${endpoint}_lat`]===undefined||record?.[`${endpoint}_lat`]===''||record?.[`${endpoint}_lng`]===null||record?.[`${endpoint}_lng`]===undefined||record?.[`${endpoint}_lng`]==='')return null;
  const lat = Number(record?.[`${endpoint}_lat`]);
  const lng = Number(record?.[`${endpoint}_lng`]);
  return Number.isFinite(lat) && Number.isFinite(lng) ? {lat,lng} : null;
}

function boundedRadius(value, fallback = 50) {
  const radius = Number(value);
  return Number.isFinite(radius) && radius >= 5 && radius <= 300 ? radius : fallback;
}

function projectedPoint(point,referenceLatitude){
  const latitude=Number(point?.lat);
  const longitude=Number(point?.lng);
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude))return null;
  const longitudeScale=111.32*Math.cos(referenceLatitude*Math.PI/180);
  return {x:longitude*longitudeScale,y:latitude*110.57};
}

function pointToSegment(point,start,end,referenceLatitude){
  const projected=projectedPoint(point,referenceLatitude);
  const segmentStart=projectedPoint(start,referenceLatitude);
  const segmentEnd=projectedPoint(end,referenceLatitude);
  if(!projected||!segmentStart||!segmentEnd)return null;
  const dx=segmentEnd.x-segmentStart.x;
  const dy=segmentEnd.y-segmentStart.y;
  const lengthSquared=dx*dx+dy*dy;
  if(lengthSquared===0)return {distance_km:Math.hypot(projected.x-segmentStart.x,projected.y-segmentStart.y),progress:0};
  const rawProgress=((projected.x-segmentStart.x)*dx+(projected.y-segmentStart.y)*dy)/lengthSquared;
  const progress=Math.max(0,Math.min(1,rawProgress));
  const closestX=segmentStart.x+progress*dx;
  const closestY=segmentStart.y+progress*dy;
  return {distance_km:Math.hypot(projected.x-closestX,projected.y-closestY),progress};
}

function validGeometryPoints(value){
  let source=value;
  if(typeof source==='string'){
    try{source=JSON.parse(source);}catch{return [];}
  }
  return Array.isArray(source)?source
    .map(point=>({lat:Number(point?.lat),lng:Number(point?.lng),label:String(point?.label||''),place_ref:String(point?.place_ref||'')}))
    .filter(point=>Number.isFinite(point.lat)&&Number.isFinite(point.lng)):[];
}

function pointToPolyline(point,routePoints){
  const points=validGeometryPoints(routePoints);
  if(points.length<2)return null;
  const referenceLatitude=(Number(point?.lat)+points.reduce((sum,item)=>sum+item.lat,0)/points.length)/2;
  const lengths=[];
  let totalLength=0;
  for(let index=0;index<points.length-1;index+=1){
    const start=projectedPoint(points[index],referenceLatitude);
    const end=projectedPoint(points[index+1],referenceLatitude);
    const length=start&&end?Math.hypot(end.x-start.x,end.y-start.y):0;
    lengths.push(length);totalLength+=length;
  }
  let traversed=0,best=null;
  for(let index=0;index<points.length-1;index+=1){
    const evidence=pointToSegment(point,points[index],points[index+1],referenceLatitude);
    const length=lengths[index];
    if(evidence){
      const progress=totalLength>0?(traversed+evidence.progress*length)/totalLength:0;
      if(!best||evidence.distance_km<best.distance_km)best={...evidence,progress,segment_index:index};
    }
    traversed+=length;
  }
  return best;
}

export function capacityRouteAlignmentMatch(query,routePoints,options={}){
  const queryOrigin=coordinate(query,'origin');
  const queryDestination=coordinate(query,'destination');
  const points=validGeometryPoints(routePoints);
  if(!queryOrigin||!queryDestination||points.length<2)return {matched:false,label:'Location needs confirmation',direction:null,origin_distance_km:null,destination_distance_km:null};
  const originEvidence=pointToPolyline(queryOrigin,points);
  const destinationEvidence=pointToPolyline(queryDestination,points);
  if(!originEvidence||!destinationEvidence)return {matched:false,label:'Location needs confirmation',direction:null,origin_distance_km:null,destination_distance_km:null};
  const originRadiusKm=boundedRadius(options.originRadiusKm);
  const destinationRadiusKm=boundedRadius(options.destinationRadiusKm);
  const eitherDirection=options.directionMode==='EITHER';
  const direct=originEvidence.progress<=destinationEvidence.progress+.000001;
  const withinTolerance=originEvidence.distance_km<=originRadiusKm&&destinationEvidence.distance_km<=destinationRadiusKm;
  const matched=withinTolerance&&(eitherDirection||direct);
  return {
    matched,
    score:matched?2:withinTolerance?1:0,
    label:matched?`Capacity route alignment · ${Math.round(originEvidence.distance_km)} km / ${Math.round(destinationEvidence.distance_km)} km`:withinTolerance?'Capacity route direction differs':'Outside route tolerance',
    direction:direct?'DIRECT':'REVERSE',
    origin_distance_km:originEvidence.distance_km,
    destination_distance_km:destinationEvidence.distance_km,
    origin_progress:originEvidence.progress,
    destination_progress:destinationEvidence.progress,
    origin_segment_index:originEvidence.segment_index,
    destination_segment_index:destinationEvidence.segment_index,
    origin_radius_km:originRadiusKm,
    destination_radius_km:destinationRadiusKm
  };
}

export function capacityRoutePointMatch(point,routePoints,options={}){
  const query={lat:Number(point?.lat),lng:Number(point?.lng)};
  const points=validGeometryPoints(routePoints);
  if(!Number.isFinite(query.lat)||!Number.isFinite(query.lng)||points.length<2)return {matched:false,label:'Capacity route needs confirmation',distance_km:null,segment_index:null};
  const evidence=pointToPolyline(query,points);
  if(!evidence)return {matched:false,label:'Capacity route needs confirmation',distance_km:null,segment_index:null};
  const radiusKm=boundedRadius(options.radiusKm);
  const matched=evidence.distance_km<=radiusKm;
  return {
    matched,
    score:matched?1:0,
    label:matched?`Near Capacity route · ${Math.round(evidence.distance_km)} km`:'Outside route tolerance',
    distance_km:evidence.distance_km,
    progress:evidence.progress,
    segment_index:evidence.segment_index,
    radius_km:radiusKm
  };
}

function pointInsidePolygon(point,boundary){
  const points=validGeometryPoints(boundary);
  if(points.length<3)return false;
  let inside=false;
  for(let current=0,previous=points.length-1;current<points.length;previous=current++){
    const first=points[current],second=points[previous];
    const crosses=(first.lat>point.lat)!==(second.lat>point.lat)
      && point.lng<(second.lng-first.lng)*(point.lat-first.lat)/(second.lat-first.lat)+first.lng;
    if(crosses)inside=!inside;
  }
  return inside;
}

export function serviceAreaGeometryMatch(point,boundary,options={}){
  const query={lat:Number(point?.lat),lng:Number(point?.lng)};
  const points=validGeometryPoints(boundary);
  if(!Number.isFinite(query.lat)||!Number.isFinite(query.lng)||points.length<3)return {matched:false,label:'Service area needs confirmation',inside:false,distance_km:null};
  const inside=pointInsidePolygon(query,points);
  const referenceLatitude=(query.lat+points.reduce((sum,item)=>sum+item.lat,0)/points.length)/2;
  const closed=[...points,points[0]];
  const distances=[];
  for(let index=0;index<closed.length-1;index+=1){
    const evidence=pointToSegment(query,closed[index],closed[index+1],referenceLatitude);
    if(evidence)distances.push(evidence.distance_km);
  }
  const distanceKm=distances.length?Math.min(...distances):null;
  const searchRadiusKm=boundedRadius(options.searchRadiusKm);
  const matched=inside||(distanceKm!==null&&distanceKm<=searchRadiusKm);
  return {matched,score:matched?2:0,label:inside?'Inside Service area':matched?`Near Service area · ${Math.round(distanceKm)} km`:'Outside Service area',inside,distance_km:distanceKm,search_radius_km:searchRadiusKm};
}

export function corridorAlignmentMatch(query,candidate,options={}){
  const candidateOrigin=coordinate(candidate,'origin');
  const candidateDestination=coordinate(candidate,'destination');
  return capacityRouteAlignmentMatch(query,candidateOrigin&&candidateDestination?[candidateOrigin,candidateDestination]:[],options);
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
