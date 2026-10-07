import { offsetSignalPath } from '../../../../src/lib/map-signal-offset.js';
import type { CapacitySignal, SignalPoint } from '../api/public-capacity.ts';
export type LngLat=[number,number];
export function project([longitude,latitude]:LngLat,zoom:number) {
 const scale=512*2**zoom,lat=Math.max(-85.05112878,Math.min(85.05112878,latitude))*Math.PI/180;
 return {x:(longitude+180)/360*scale,y:(1-Math.log(Math.tan(lat)+1/Math.cos(lat))/Math.PI)/2*scale};
}
export function unproject({x,y}:{x:number;y:number},zoom:number):LngLat {const scale=512*2**zoom;return[x/scale*360-180,Math.atan(Math.sinh(Math.PI*(1-2*y/scale)))*180/Math.PI];}
const coordinates=(points:SignalPoint[]):LngLat[]=>points.map(p=>[p.longitude,p.latitude]);
const close=(points:LngLat[])=>points.length?[...points,points[0]]:points;
export function markerLocation(item:CapacitySignal):LngLat|null {
 if(item.currentVisible&&item.latitude!==null&&item.longitude!==null)return[item.longitude,item.latitude];
 if(item.currentVisible&&item.geometry==='ROUTE'&&item.currentPoints.length>=2){
  const points=coordinates(item.currentPoints),lengths=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));
  let half=lengths.reduce((a,b)=>a+b,0)/2;for(let i=0;i<lengths.length;i++){if(half<=lengths[i]){const t=lengths[i]?half/lengths[i]:0;return[points[i][0]+(points[i+1][0]-points[i][0])*t,points[i][1]+(points[i+1][1]-points[i][1])*t];}half-=lengths[i];}
 }
 return null;
}
export function locationRing(item:CapacitySignal):LngLat[] {
 if(!item.currentVisible||item.latitude===null||item.longitude===null)return[];
 const angular=Math.min(1000,item.precisionKm)/6371,lat=item.latitude*Math.PI/180,lng=item.longitude*Math.PI/180;
 return Array.from({length:73},(_,i)=>{const bearing=i/72*2*Math.PI,y=Math.asin(Math.sin(lat)*Math.cos(angular)+Math.cos(lat)*Math.sin(angular)*Math.cos(bearing));const x=lng+Math.atan2(Math.sin(bearing)*Math.sin(angular)*Math.cos(lat),Math.cos(angular)-Math.sin(lat)*Math.sin(y));return[x*180/Math.PI,y*180/Math.PI];});
}
export function signalPaths(item:CapacitySignal,zoom:number):{kind:'location'|'current'|'regular';points:LngLat[]}[] {
 const paths:{kind:'location'|'current'|'regular';points:LngLat[]}[]=[],ring=locationRing(item);
 if(ring.length)paths.push({kind:'location',points:ring});
 let reference:{x:number;y:number}[]=[];
 if(item.currentVisible&&item.currentPoints.length>=(item.geometry==='RADIUS'?3:2)){
  const closed=item.geometry==='RADIUS'; const points=coordinates(item.currentPoints);
  reference=offsetSignalPath((closed?close(points):points).map(p=>project(p,zoom)),closed?-12:-6,closed);
  paths.push({kind:'current',points:reference.map(p=>unproject(p,zoom))});
 }
 for(const regular of item.regular){const closed=regular.geometry==='RADIUS',points=coordinates(regular.points);if(points.length<(closed?3:2))continue;
  const pixels=offsetSignalPath((closed?close(points):points).map(p=>project(p,zoom)),closed?12:6,closed,reference.length?[reference]:[]);
  paths.push({kind:'regular',points:pixels.map(p=>unproject(p,zoom))});
 }
 return paths;
}
export function signalBounds(items:CapacitySignal[]):[number,number,number,number]|null {
 const points=items.flatMap(item=>[...(markerLocation(item)?[markerLocation(item)!]:[]),...(item.currentVisible?coordinates(item.currentPoints):[]),...item.regular.flatMap(row=>coordinates(row.points)),...locationRing(item)]);
 if(!points.length)return null;
 let west=Infinity,south=Infinity,east=-Infinity,north=-Infinity;
 for(const [lng,lat]of points){west=Math.min(west,lng);south=Math.min(south,lat);east=Math.max(east,lng);north=Math.max(north,lat);}
 return[west-.005,south-.005,east+.005,north+.005];
}
/** Display-only offsets for coincident points after native clustering expands. */
export function separateMarkers(points:{id:string;coordinate:LngLat}[],zoom:number):Record<string,[number,number]> {
 const groups:{x:number;y:number;members:string[]}[]=[];
 for(const row of [...points].sort((a,b)=>a.id.localeCompare(b.id))){const p=project(row.coordinate,zoom);const group=groups.find(g=>Math.hypot(g.x-p.x,g.y-p.y)<40);if(group)group.members.push(row.id);else groups.push({...p,members:[row.id]});}
 const result:Record<string,[number,number]>={};
 for(const group of groups)group.members.forEach((id,i)=>{if(group.members.length===1){result[id]=[0,0];return;}const radius=Math.max(48,group.members.length*58/(Math.PI*2)),angle=i/group.members.length*Math.PI*2;result[id]=[Math.cos(angle)*radius,Math.sin(angle)*radius];});
 return result;
}
