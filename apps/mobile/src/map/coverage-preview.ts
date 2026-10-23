import type {Feature,LineString,Polygon} from 'geojson';
type Place={placeRef:string;coordinate?:number[]|null};
export function coverageGeometry(kind:string,places:Place[]):Feature<LineString|Polygon>|null {
 const minimum=kind==='RADIUS'?3:2;
 if(!['ROUTE','RADIUS'].includes(kind)||places.length<minimum||places.length>5)return null;
 const points:number[][]=[];
 for(const place of places){
  const point=place.coordinate;
  if(!place.placeRef||!point||point.length!==2||!point.every(Number.isFinite)||Math.abs(point[0])>180||Math.abs(point[1])>90)return null;
  points.push([...point]);
 }
 if(new Set(places.map(place=>place.placeRef)).size!==places.length||new Set(points.map(point=>point.join(','))).size!==points.length)return null;
 if(kind==='RADIUS'){
  const area=points.reduce((sum,p,i)=>{const next=points[(i+1)%points.length];return sum+p[0]*next[1]-next[0]*p[1];},0);
  if(Math.abs(area)<1e-10)return null;
  return {type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:[[...points,[...points[0]]]]}};
 }
 return {type:'Feature',properties:{},geometry:{type:'LineString',coordinates:points}};
}
export function coverageBounds(feature:Feature<LineString|Polygon>):[number,number,number,number]{
 const points=feature.geometry.type==='Polygon'?feature.geometry.coordinates[0]:feature.geometry.coordinates;
 const lng=points.map(point=>point[0]),lat=points.map(point=>point[1]);
 const west=Math.min(...lng),east=Math.max(...lng),south=Math.min(...lat),north=Math.max(...lat);
 // Keep horizontal/vertical routes and tiny city clusters visible to the camera.
 return [west-.01,south-.01,east+.01,north+.01];
}
