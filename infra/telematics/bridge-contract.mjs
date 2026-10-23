import {createHash,createHmac,randomUUID} from 'node:crypto';
const alarms=new Set(['sos','powerCut','overspeed','vibration','lowBattery','tampering']);
export function normalizePosition(row){
 if(Object.hasOwn(row.attributes||{},'result'))throw new Error('COMMAND_RESULT_NOT_POSITION');
 if(!Number.isSafeInteger(row.deviceId)||row.deviceId<=0||!['gt06','teltonika','h02','jt808'].includes(row.protocol)
  ||!/^[A-Za-z0-9_-]{5,40}$/.test(row.uniqueId)||typeof row.valid!=='boolean'
  ||!Number.isFinite(row.latitude)||Math.abs(row.latitude)>90||!Number.isFinite(row.longitude)||Math.abs(row.longitude)>180
  ||!Number.isFinite(row.speed)||row.speed<0||row.speed*1.852>300
  ||row.course!=null&&(!Number.isFinite(row.course)||row.course<0||row.course>=360)
  ||!(/^[1-9][0-9]*$/).test(String(row.id)))throw new Error('INVALID_GATEWAY_POSITION');
 const attributes={};if(typeof row.attributes?.ignition==='boolean')attributes.ignition=row.attributes.ignition;
 if(Number.isFinite(row.attributes?.batteryLevel)&&row.attributes.batteryLevel>=0&&row.attributes.batteryLevel<=100)attributes.battery=row.attributes.batteryLevel;
 if(Number.isFinite(row.attributes?.power)&&row.attributes.power>=0&&row.attributes.power<=1000)attributes.power=row.attributes.power;
 const alarm=String(row.attributes?.alarm||'').split(',').find(value=>alarms.has(value));if(alarm)attributes.alarm=alarm;
 return {eventKey:`position:${row.id}`,gatewayDeviceId:row.deviceId,protocol:row.protocol,protocolDeviceId:row.uniqueId,
  observedAt:new Date(row.fixTime).toISOString(),receivedAt:new Date(row.serverTime).toISOString(),valid:row.valid,
  latitude:row.latitude,longitude:row.longitude,speedKph:row.speed*1.852,course:row.course??null,attributes};
}
export function signedHeaders(config,body,now=new Date(),nonce=randomUUID()){
 const issued=now.toISOString(),digest=createHash('sha256').update(body).digest('hex');
 const signature=createHmac('sha256',config.secret).update(['POST','/api/telematics/gateway',config.id,issued,nonce,digest].join('\n')).digest('hex');
 return {'Content-Type':'application/json','x-telematics-gateway':config.id,'x-telematics-issued-at':issued,'x-telematics-nonce':nonce,'x-telematics-signature':signature};
}
/** Synthetic vocabulary has no executable hardware relay template. */
export function syntheticCommand(job,now=Date.now()){
 if(job.synthetic!==true||job.modelProfile!=='SYNTHETIC_GT06'||job.protocol!=='gt06'||Date.parse(job.expiresAt)<=now
  ||!(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/).test(job.id)||!['LOCATE','REBOOT','REPORT_INTERVAL','ENGINE_CUT','ENGINE_RESTORE'].includes(job.command))throw new Error('DEVICE_COMMAND_UNSUPPORTED');
 if(job.command==='REPORT_INTERVAL'&&(!Number.isInteger(job.intervalSeconds)||job.intervalSeconds<30||job.intervalSeconds>3600))throw new Error('INVALID_REPORT_INTERVAL');
 return {deviceId:job.gatewayDeviceId,type:'custom',attributes:{noQueue:true,
  data:`LOADGISTIC:${job.id}:${job.command}${job.command==='REPORT_INTERVAL'?`:${job.intervalSeconds}`:''}#`}};
}
export function correlatedSyntheticResult(value){
 const match=/^LOADGISTIC:([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}):(LOCATE|REBOOT|REPORT_INTERVAL|ENGINE_CUT|ENGINE_RESTORE)(?::[0-9]{2,4})?#:ACK$/.exec(String(value||''));
 return match?.[1]||null;
}
