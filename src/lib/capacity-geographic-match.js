import {capacityRouteAlignmentMatch,capacityRoutePointMatch,serviceAreaGeometryMatch} from './route-matching.js';

// Eligibility is separate from its presentation: every supplied criterion must pass.
export function capacityGeographicMatch(item,filters={},originPlace=null,destinationPlace=null,areaPlace=null){
  const geometry=String(filters.geometry||'').toUpperCase();
  const recurring=item.recurring_corridors||[];
  const routes=[],areas=[];
  if(!geometry||geometry==='ROUTE'){
    if(item.availability_geometry==='ROUTE')routes.push({points:item.current_route_points,source:'Current capacity route',directionMode:filters.directionMode==='EITHER'?'EITHER':'DIRECT'});
    for(const signal of recurring.filter(entry=>entry.geometry==='ROUTE'))routes.push({points:signal.route_points,source:'Regular capacity route',directionMode:'EITHER'});
  }
  if(item.status==='EMPTY'&&(!geometry||geometry==='RADIUS')){
    if(item.availability_geometry==='RADIUS')areas.push({points:item.capacity_area_boundary,source:'Current service area'});
    for(const signal of recurring.filter(entry=>entry.geometry==='RADIUS'))areas.push({points:signal.area_boundary,source:'Regular service area'});
  }
  const labels=[];
  const point=place=>({lat:place.center_lat,lng:place.center_lng});
  const areaMatches=(place,radius)=>areas.map(area=>({...area,...serviceAreaGeometryMatch(point(place),area.points,{searchRadiusKm:radius})})).filter(area=>area.matched);
  if(originPlace&&destinationPlace){
    const query={origin_lat:originPlace.center_lat,origin_lng:originPlace.center_lng,destination_lat:destinationPlace.center_lat,destination_lng:destinationPlace.center_lng};
    const routeMatch=routes.map(route=>({...route,...capacityRouteAlignmentMatch(query,route.points,{originRadiusKm:filters.originRadiusKm,destinationRadiusKm:filters.destinationRadiusKm,directionMode:route.directionMode})}))
      .filter(route=>route.matched).sort((a,b)=>a.origin_distance_km+a.destination_distance_km-b.origin_distance_km-b.destination_distance_km)[0];
    const areaMatch=areaMatches(originPlace,filters.originRadiusKm).find(area=>serviceAreaGeometryMatch(point(destinationPlace),area.points,{searchRadiusKm:filters.destinationRadiusKm}).matched);
    if(routeMatch)labels.push(`${routeMatch.source} aligns · ${Math.round(routeMatch.origin_distance_km)} km / ${Math.round(routeMatch.destination_distance_km)} km`);
    else if(areaMatch)labels.push(`${areaMatch.source} covers both shipment endpoints`);
    else return {matched:false,label:null};
  }else if(originPlace||destinationPlace){
    const place=originPlace||destinationPlace;
    const radius=originPlace?filters.originRadiusKm:filters.destinationRadiusKm;
    const routeMatch=routes.map(route=>({...route,...capacityRoutePointMatch(point(place),route.points,{radiusKm:radius})})).find(route=>route.matched);
    const areaMatch=areaMatches(place,radius)[0];
    if(routeMatch)labels.push(`${routeMatch.source} passes within ${Math.round(routeMatch.distance_km)} km of ${place.place_label}`);
    else if(areaMatch)labels.push(`${areaMatch.source} reaches ${place.place_label}`);
    else return {matched:false,label:null};
  }
  if(areaPlace){
    const match=areaMatches(areaPlace,filters.currentAreaRadiusKm)[0];
    if(!match)return {matched:false,label:null};
    labels.push(`${match.source} reaches ${areaPlace.place_label}`);
  }
  // Nearby eligibility is checked using uncertainty-aware distance by each adapter.
  // Never infer it from Number('') or use it to rescue failed endpoint/area filters.
  return {matched:true,label:labels.length?labels.join(' · '):null};
}
