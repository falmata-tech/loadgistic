import {DEMO_MOTION_COHORT} from '../../src/lib/demo-motion-cohort.js';

const meters=(a,b)=>Math.hypot((b[0]-a[0])*111195,(b[1]-a[1])*111195*Math.cos((a[0]+b[0])*Math.PI/360));

/** A stable fictional circuit; wall time keeps movement continuous across worker restarts. */
export function hostedRouteFix(target,atMs){
 const base=DEMO_MOTION_COHORT[target];
 if(!base||!Number.isFinite(atMs)||atMs<0)throw Error('HOSTED_MOTION_ROUTE_DENIED');
 const route=[[base.latitude,base.longitude],[base.latitude,base.longitude+0.008],
  [base.latitude+0.005,base.longitude+0.008],[base.latitude+0.005,base.longitude]];
 const segments=route.map((point,index)=>({a:point,b:route[(index+1)%route.length],length:meters(point,route[(index+1)%route.length])}));
 let distance=(atMs/1000)*(20000/3600)%segments.reduce((sum,segment)=>sum+segment.length,0);
 for(const segment of segments){
  if(distance<=segment.length)return {latitude:segment.a[0]+(segment.b[0]-segment.a[0])*distance/segment.length,
   longitude:segment.a[1]+(segment.b[1]-segment.a[1])*distance/segment.length};
  distance-=segment.length;
 }
 throw Error('HOSTED_MOTION_ROUTE_DENIED');
}
