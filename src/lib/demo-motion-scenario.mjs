import {createHash} from 'node:crypto';
import catalog from '../../resources/fixtures/demo-road-catalog.json' with {type:'json'};
import {DEMO_MOTION_COHORT} from './demo-motion-cohort.js';

// Updating any course/evidence needs a reviewed version and pin. A matching
// caller-supplied geometry hash alone is not trusted enrollment or provenance.
const CATALOG_SHA256='6b64282a8fd1dc465c10eb7c548477d9a56c7ed878965ac53bc1ea453b197159';
const SOURCE_SHA256='11f6475a36bae9c28d7eb8e5528086a4f287f600054abeb79b897941a5980a61';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const deny=()=>{throw Error('DEMO_MOTION_CATALOG_DENIED');};
const finite=(value,min,max)=>Number.isFinite(value)&&value>=min&&value<=max;
export const DEMO_MOTION_CAPTURE_SKEW_MS=5000;
export const DEMO_MOTION_CATALOG_VERSION=catalog.catalog_version;

/** Validate only the exact reviewed artifact; never enroll a new target. */
export function validateDemoMotionCatalog(candidate=catalog){
 if(!candidate||hash(candidate)!==CATALOG_SHA256||candidate.schema_version!==1
  ||candidate.catalog_version!=='2026-11-12.1'||candidate.coordinate_order!=='longitude,latitude'
  ||candidate.source?.sha256!==SOURCE_SHA256||candidate.source?.license!=='ODbL-1.0'
  ||candidate.source?.provider!=='Geofabrik'||candidate.source?.source_date!=='2026-11-12'
  ||candidate.source?.attribution!=='© OpenStreetMap contributors'
  ||Object.keys(candidate.courses||{}).sort().join(',')!==Object.keys(DEMO_MOTION_COHORT).sort().join(','))deny();
 for(const [target,course] of Object.entries(candidate.courses)){
  const binding=DEMO_MOTION_COHORT[target];
  if(course.vehicle_id!==binding.vehicleId||course.source!==binding.source||course.purpose!=='PROTOCOL_LOCAL'
   ||course.anchor?.latitude!==binding.latitude||course.anchor?.longitude!==binding.longitude
   ||!Array.isArray(course.coordinates)||course.geometry_sha256!==hash(course.coordinates))deny();
  for(const point of course.coordinates){
   if(!Array.isArray(point)||point.length!==2||!finite(point[0],-180,180)||!finite(point[1],-90,90)
    ||Math.abs(point[1]-binding.latitude)>0.035||Math.abs(point[0]-binding.longitude)>0.035)deny();
  }
  if(course.mode==='ROAD_LEG'){
   if(course.coordinates.length<2||course.speed_kph!==20||course.dwell_seconds!==60
    ||course.playback_policy!=='OUT_AND_BACK'||course.qualification!=='MAPPED_OSM_SOURCE_VERIFIED'
    ||!Number.isSafeInteger(course.osm_way_id)||!Number.isSafeInteger(course.osm_way_version)
    ||course.osm_node_ids?.length!==course.coordinates.length
    ||course.source_verification?.exact_original_node_coordinates!==true
    ||course.source_verification?.consecutive_single_way_nodes!==true
    ||course.source_verification?.independent_pbf_reparse!==true
    ||course.source_verification?.node_barrier_and_access_check!=='passed')deny();
  }else if(course.mode==='STATIONARY'){
   if(course.coordinates.length!==1||course.coordinates[0][0]!==binding.longitude
    ||course.coordinates[0][1]!==binding.latitude||course.speed_kph!==0
    ||course.playback_policy!=='STATIONARY'||course.reason!=='RADIUS_SCENARIO_EXPLICITLY_STATIONARY')deny();
  }else if(course.mode!=='UNAVAILABLE'||course.coordinates.length||course.speed_kph!==0
    ||course.playback_policy!=='NONE'||course.qualification!=='NO_QUALIFIED_ROAD_COURSE')deny();
 }
 return true;
}

function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
validateDemoMotionCatalog();freeze(catalog);

const meters=(a,b)=>Math.hypot((b[1]-a[1])*111195,(b[0]-a[0])*111195*Math.cos((a[1]+b[1])*Math.PI/360));
const heading=(a,b)=>(Math.atan2((b[0]-a[0])*Math.cos((a[1]+b[1])*Math.PI/360),b[1]-a[1])*180/Math.PI+360)%360;
const courses=new Map(Object.entries(catalog.courses).map(([target,course])=>{
 const segments=course.coordinates.slice(1).map((b,index)=>({a:course.coordinates[index],b,length:meters(course.coordinates[index],b)}))
  .filter(segment=>segment.length>0);
 return [target,{course,segments,distance:segments.reduce((sum,segment)=>sum+segment.length,0)}];
}));

/** Stable local protocol course; never progress on a regional market trip. */
export function demoMotionScenarioFix(target,atMs){
 const selected=courses.get(target);
 if(!selected||!Number.isFinite(atMs)||atMs<0)throw Error('DEMO_MOTION_SCENARIO_DENIED');
 const {course,segments,distance}=selected;
 if(course.mode==='UNAVAILABLE')throw Error('DEMO_MOTION_SCENARIO_UNAVAILABLE');
 const metadata={scenarioId:course.course_id,scenarioVersion:catalog.catalog_version,purpose:course.purpose};
 if(course.mode==='STATIONARY')return {latitude:course.coordinates[0][1],longitude:course.coordinates[0][0],speedKph:0,course:0,step:'STATIONARY',...metadata};
 if(!Number.isFinite(distance)||distance<=0)throw Error('DEMO_MOTION_SCENARIO_UNAVAILABLE');
 const dwell=course.dwell_seconds,speed=course.speed_kph/3.6,travel=distance/speed;
 const phase=(atMs/1000)%(2*(travel+dwell));
 let progress,step,speedKph=course.speed_kph;
 if(phase<dwell){progress=0;step='DWELL_START';speedKph=0;}
 else if(phase<dwell+travel){progress=(phase-dwell)*speed;step='OUTBOUND';}
 else if(phase<2*dwell+travel){progress=distance;step='DWELL_END';speedKph=0;}
 else{progress=distance-(phase-2*dwell-travel)*speed;step='RETURNING';}
 for(const segment of segments){
  if(progress<=segment.length){const ratio=Math.max(0,Math.min(1,progress/segment.length));
   return {latitude:segment.a[1]+(segment.b[1]-segment.a[1])*ratio,
    longitude:segment.a[0]+(segment.b[0]-segment.a[0])*ratio,speedKph,
    course:speedKph?heading(step==='RETURNING'?segment.b:segment.a,step==='RETURNING'?segment.a:segment.b):0,step,...metadata};}
  progress-=segment.length;
 }
 const last=course.coordinates.at(-1);
 return {latitude:last[1],longitude:last[0],speedKph:0,course:0,step:'DWELL_END',...metadata};
}

/** Signed capture time must match deterministic position before storage. */
export function assertDemoMotionReport(command,{now=Date.now(),issuedAt=now}={}){
 if(!['GPS','PHONE'].includes(command?.action))return null;
 const capture=typeof issuedAt==='string'?Date.parse(issuedAt):issuedAt;
 if(!Number.isFinite(now)||!Number.isFinite(capture)||Math.abs(now-capture)>DEMO_MOTION_CAPTURE_SKEW_MS
  ||!Number.isFinite(command.latitude)||!Number.isFinite(command.longitude)
  ||DEMO_MOTION_COHORT[command.target]?.source!==(command.action==='GPS'?'GPS':'MOBILE'))throw Error('DEMO_MOTION_REPORT_DENIED');
 const expected=demoMotionScenarioFix(command.target,capture);
 const distance=meters([command.longitude,command.latitude],[expected.longitude,expected.latitude]);
 // Covers GT06 quantization and millisecond serialization, not another point
 // elsewhere on the same road or arbitrary points inside the old DB box.
 if(!Number.isFinite(distance)||distance>1)throw Error('DEMO_MOTION_REPORT_DENIED');
 return {scenarioId:expected.scenarioId,scenarioVersion:expected.scenarioVersion,step:expected.step,purpose:expected.purpose};
}
