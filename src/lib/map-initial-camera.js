export const DEFAULT_CAPACITY_CAMERA=Object.freeze({latitude:9.1,longitude:40.2,zoom:6});

/** @param {unknown} value @returns {{latitude:number,longitude:number}|null} */
const validPoint=value=>{
  if(!value||typeof value!=='object')return null;
  const latitude=Number(value.latitude??value.lat),longitude=Number(value.longitude??value.lng);
  if(!Number.isFinite(latitude)||Math.abs(latitude)>90||!Number.isFinite(longitude)||Math.abs(longitude)>180)return null;
  return {latitude,longitude};
};

function distanceKm(first,second){
  const radians=value=>value*Math.PI/180;
  const latitudeDelta=radians(second.latitude-first.latitude);
  const longitudeDelta=radians(((second.longitude-first.longitude+540)%360)-180);
  const latitudeA=radians(first.latitude),latitudeB=radians(second.latitude);
  const haversine=Math.sin(latitudeDelta/2)**2+Math.cos(latitudeA)*Math.cos(latitudeB)*Math.sin(longitudeDelta/2)**2;
  return 6371*2*Math.asin(Math.sqrt(Math.max(0,Math.min(1,haversine))));
}

/**
 * Choose only the initial camera from the most populated local signal cluster.
 * The source list is already bounded by the public-map first page. This never
 * changes which signals the map requests, filters or renders.
 */
/** @param {unknown[]} values @param {{radiusKm?:number,zoom?:number,fallback?:{latitude:number,longitude:number,zoom:number}}} [options] @returns {{latitude:number,longitude:number,zoom:number}} */
export function initialCapacityCamera(values,{radiusKm=500,zoom=DEFAULT_CAPACITY_CAMERA.zoom,fallback=DEFAULT_CAPACITY_CAMERA}={}){
  const points=(Array.isArray(values)?values:[]).map(validPoint).filter(Boolean)
    .sort((first,second)=>first.latitude-second.latitude||first.longitude-second.longitude);
  if(!points.length)return {...fallback,zoom};
  const center={latitude:Number(fallback.latitude),longitude:Number(fallback.longitude)};
  /** @type {{latitude:number,longitude:number,neighbors:number,marketDistance:number}|null} */
  let best=null;
  for(const point of points){
    const neighbors=points.filter(other=>distanceKm(point,other)<=radiusKm).length;
    const candidate={...point,neighbors,marketDistance:distanceKm(point,center)};
    if(!best||candidate.neighbors>best.neighbors
      ||candidate.neighbors===best.neighbors&&candidate.marketDistance<best.marketDistance
      ||candidate.neighbors===best.neighbors&&candidate.marketDistance===best.marketDistance
        &&(candidate.latitude<best.latitude||candidate.latitude===best.latitude&&candidate.longitude<best.longitude))best=candidate;
  }
  return {latitude:best.latitude,longitude:best.longitude,zoom};
}
