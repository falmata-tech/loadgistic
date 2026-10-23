// Read-only local proof that a fresh fictional GT06 fix reached public Capacity.
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {DEMO_MOTION_COHORT} from '../../src/lib/demo-motion-cohort.js';

const vehicle=DEMO_MOTION_COHORT['company-truck'];
const appContainer='supabase_db_loadgistic-local';
const gatewayContainer='loadgistic-telematics-database-1';

function localSql(container,database,user,sql,expectedFields){
 const child=spawnSync('docker',['exec','-i',container,'psql','-X','-Atq','-v','ON_ERROR_STOP=1','-U',user,'-d',database],
  {input:sql,encoding:'utf8',timeout:10000,maxBuffer:4096});
 if(child.status!==0)throw Error('LOCAL_GPS_DATABASE_UNAVAILABLE');
 const fields=child.stdout.trim().split('|');
 if(fields.length!==expectedFields)throw Error('LOCAL_GPS_DATABASE_INVALID');
 return fields;
}

export function assessDemoGpsPipeline({decoded,delivered,reservations,appPositions,capacityAgeSeconds,
 capacitySource,capacityDemo,publicFound,apiAgeSeconds,apiSource,apiDemo},windowSeconds){
 return decoded>0&&delivered>0&&reservations>0&&appPositions>0
  &&capacitySource==='TELEMATICS'&&capacityDemo===true
  &&Number.isFinite(capacityAgeSeconds)&&capacityAgeSeconds>=0&&capacityAgeSeconds<=windowSeconds
  &&publicFound===true&&apiSource==='TELEMATICS'&&apiDemo===true
  &&Number.isFinite(apiAgeSeconds)&&apiAgeSeconds>=0&&apiAgeSeconds<=windowSeconds;
}

async function publicFix(){
 let cursor='',pages=0,rows=0,target=null;
 do{
  const url=new URL('http://127.0.0.1:3100/api/public/capacity');
  if(cursor)url.searchParams.set('cursor',cursor);
  const response=await fetch(url,{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('LOCAL_GPS_PUBLIC_API_UNAVAILABLE');
  const page=await response.json();
  if(!Array.isArray(page.items)||typeof page.nextCursor!=='string'&&page.nextCursor!==null)
   throw Error('LOCAL_GPS_PUBLIC_API_INVALID');
  pages++;rows+=page.items.length;
  target??=page.items.find(item=>item.vehicle_id===vehicle.vehicleId);
  cursor=page.nextCursor||'';
  if(pages>20)throw Error('LOCAL_GPS_PUBLIC_API_INVALID');
 }while(cursor);
 return {pages,rows,publicFound:!!target,apiAgeSeconds:target?.location_updated_at
  ?Math.round((Date.now()-Date.parse(target.location_updated_at))/1000):null,
  apiSource:target?.location_source||null,apiDemo:target?.location_is_demo===true};
}

export async function verifyDemoGpsLocal(windowSeconds=180){
 if(!Number.isInteger(windowSeconds)||windowSeconds<60||windowSeconds>600)throw Error('LOCAL_GPS_WINDOW_INVALID');
 const appSql=`with target as (select * from public.capacities where vehicle_id='${vehicle.vehicleId}'::uuid order by updated_at desc,id desc limit 1)
 select (select count(*) from public.demo_motion_gps_reports where vehicle_id='${vehicle.vehicleId}'::uuid and observed_at>now()-interval '${windowSeconds} seconds' and upstream_event_key is not null),
 (select count(*) from public.telematics_positions where vehicle_id='${vehicle.vehicleId}'::uuid and observed_at>now()-interval '${windowSeconds} seconds' and demo_epoch is not null),
 coalesce((select round(extract(epoch from(now()-location_updated_at)))::integer from target),-1),
 coalesce((select location_source from target),'NONE'),
 coalesce((select demo_epoch is not null from target),false);`;
 const [reservations,appPositions,capacityAgeSeconds,capacitySource,capacityDemo]=localSql(appContainer,'postgres','postgres',appSql,5);
 const bridgeSql=`select (select count(*) from public.tc_positions p join public.tc_devices d on d.id=p.deviceid where d.uniqueid='${vehicle.imei}' and p.fixtime>now()-interval '${windowSeconds} seconds'),
 (select count(*) from loadgistic_bridge.outbox o join public.tc_positions p on p.id=o.source_id join public.tc_devices d on d.id=p.deviceid
  where d.uniqueid='${vehicle.imei}' and p.fixtime>now()-interval '${windowSeconds} seconds' and o.delivered_at is not null);`;
 const [decoded,delivered]=localSql(gatewayContainer,'traccar','traccar',bridgeSql,2);
 const publicState=await publicFix();
 const evidence={decoded:Number(decoded),delivered:Number(delivered),reservations:Number(reservations),appPositions:Number(appPositions),
  capacityAgeSeconds:Number(capacityAgeSeconds),capacitySource,capacityDemo:capacityDemo==='t',...publicState};
 return {...evidence,pass:assessDemoGpsPipeline(evidence,windowSeconds)};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{
  if(process.argv.length>3)throw Error('LOCAL_GPS_WINDOW_INVALID');
  const result=await verifyDemoGpsLocal(process.argv[2]===undefined?180:Number(process.argv[2]));
  console.log(JSON.stringify({event:'local_demo_gps_pipeline',...result}));
  if(!result.pass)process.exitCode=1;
 }catch{console.error('LOCAL_GPS_VERIFICATION_FAILED');process.exitCode=1;}
}
