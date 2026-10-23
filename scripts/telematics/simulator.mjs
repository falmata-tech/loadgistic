import net from 'node:net';
import {pathToFileURL} from 'node:url';
import {assertDemoDevice} from './demo-manifest.mjs';
export function crc16X25(bytes){let crc=0xffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=crc&1?(crc>>>1)^0x8408:crc>>>1;}return (~crc)&0xffff;}
export function gt06Packet(type,payload=Buffer.alloc(0),serial=1){
 const body=Buffer.alloc(payload.length+4);body[0]=payload.length+5;body[1]=type;payload.copy(body,2);body.writeUInt16BE(serial&0xffff,body.length-2);
 const crc=Buffer.alloc(2);crc.writeUInt16BE(crc16X25(body));return Buffer.concat([Buffer.from([0x78,0x78]),body,crc,Buffer.from([13,10])]);
}
export function loginPacket(imei){assertDemoDevice(imei);return gt06Packet(1,Buffer.from(`0${imei}0000`,'hex'));}
export function gpsPacket(device,serial=2,now=new Date()){
 const payload=Buffer.alloc(18);payload.set([now.getUTCFullYear()-2000,now.getUTCMonth()+1,now.getUTCDate(),now.getUTCHours(),now.getUTCMinutes(),now.getUTCSeconds(),0xc8]);
 payload.writeUInt32BE(Math.round(Math.abs(device.latitude)*1800000),7);payload.writeUInt32BE(Math.round(Math.abs(device.longitude)*1800000),11);
 payload[15]=device.speedKph||0;payload.writeUInt16BE(0x1000|0x4000|(device.ignition?0x8000:0)|(device.latitude>=0?0x400:0)|(device.longitude<0?0x800:0),16);
 return gt06Packet(0x10,payload,serial);
}
export function syntheticReply(command,serial=3){
 if(!/^LOADGISTIC:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}:(LOCATE|REBOOT|REPORT_INTERVAL|ENGINE_CUT|ENGINE_RESTORE)(?::[0-9]{2,4})?#$/.test(command))throw new Error('SYNTHETIC_COMMAND_DENIED');
 const text=Buffer.from(`${command}:ACK`,'ascii'),payload=Buffer.alloc(5+text.length);payload[0]=4+text.length;text.copy(payload,5);
 return gt06Packet(0x15,payload,serial);
}
export async function simulate({imei='990000000000001',host='127.0.0.1',port=15023,durationMs=30000,onEvent=()=>{},motion=false,beforeReport,signal,reportIntervalSeconds:initialReportIntervalSeconds=5}={}){
 const device=assertDemoDevice(imei);if(!['127.0.0.1','localhost','::1'].includes(host)||port!==15023)throw new Error('REMOTE_TELEMATICS_DEMO_REFUSED');
 if(!Number.isInteger(initialReportIntervalSeconds)||initialReportIntervalSeconds<5||initialReportIntervalSeconds>3600)throw new Error('INVALID_REPORT_INTERVAL');
 if(signal?.aborted)return {login:false,positions:0,commands:0,syntheticRelayCut:false,syntheticReboots:0,reportIntervalSeconds:initialReportIntervalSeconds};
 return new Promise((resolve,reject)=>{
  const socket=net.createConnection({host,port});let stopping=false,pending=Buffer.alloc(0),serial=10,login=false,commands=0,positions=0,relayCut=false,reboots=0,reportIntervalSeconds=initialReportIntervalSeconds,reporting=false;
  const report=async()=>{if(stopping||socket.destroyed||socket.writableEnded||reporting)return;reporting=true;
   try{const offset=motion?Math.sin(positions*Math.PI/4)*0.012:0;
    const candidate={...device,latitude:device.latitude+offset,longitude:device.longitude+offset,speedKph:motion?20:0,ignition:motion};
    const authorized=beforeReport?await beforeReport(candidate):candidate;
    // A takeover/stop while awaiting reservation cannot emit a late packet.
    if(!authorized||stopping||signal?.aborted||socket.destroyed||socket.writableEnded)return;
    const stamp=authorized.observedAt?new Date(authorized.observedAt):new Date();
    socket.write(gpsPacket({...candidate,...authorized},serial++,stamp));positions++;
   }finally{reporting=false;}};
  const reportSafely=()=>{void report().catch(()=>socket.destroy(new Error('SIMULATION_REPORT_DENIED')));};
  const abort=()=>{stopping=true;clearInterval(interval);socket.end();};
  let interval;const timer=setTimeout(()=>{stopping=true;clearInterval(interval);socket.end();},durationMs);
  interval=setInterval(()=>{if(login)reportSafely();},reportIntervalSeconds*1000);signal?.addEventListener('abort',abort,{once:true});
  socket.on('connect',()=>socket.write(loginPacket(imei)));
  socket.on('data',chunk=>{if(stopping||socket.destroyed||socket.writableEnded)return;pending=Buffer.concat([pending,chunk]);if(pending.length>4096){socket.destroy(new Error('GATEWAY_PACKET_INVALID'));return;}
   while(pending.length>=5){if(pending[0]!==0x78||pending[1]!==0x78){socket.destroy(new Error('GATEWAY_PACKET_INVALID'));return;}
    const size=pending[2]+5;if(pending.length<size)break;const frame=pending.subarray(0,size);pending=pending.subarray(size);
    if(frame.readUInt16BE(size-4)!==crc16X25(frame.subarray(2,size-4))){socket.destroy(new Error('GATEWAY_CHECKSUM_INVALID'));return;}
    if(frame[3]===1){login=true;reportSafely();onEvent('login_acknowledged');}
    else if(frame[3]===0x80){const length=frame[4]-4,command=frame.subarray(9,9+length).toString('ascii');
     try{const reply=syntheticReply(command,serial++);
      if(command.endsWith(':ENGINE_CUT#'))relayCut=true;if(command.endsWith(':ENGINE_RESTORE#'))relayCut=false;
      if(command.endsWith(':REBOOT#'))reboots++;
      if(command.includes(':REPORT_INTERVAL:')){const requested=Number(command.split(':')[3].replace('#',''));
       if(!Number.isInteger(requested)||requested<30||requested>3600)throw new Error('SYNTHETIC_INTERVAL_DENIED');
       reportIntervalSeconds=requested;clearInterval(interval);interval=setInterval(()=>{if(login)reportSafely();},requested*1000);}
      socket.write(reply);commands++;reportSafely();onEvent('synthetic_command_acknowledged');}catch{onEvent('unknown_command_rejected');}
    }
   }});
  socket.on('error',error=>{stopping=true;clearTimeout(timer);clearInterval(interval);signal?.removeEventListener('abort',abort);reject(new Error(error.code||error.message));});
  socket.on('close',()=>{stopping=true;clearTimeout(timer);clearInterval(interval);signal?.removeEventListener('abort',abort);resolve({login,positions,commands,syntheticRelayCut:relayCut,syntheticReboots:reboots,reportIntervalSeconds});});
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const imei=process.argv[2]||'990000000000001',durationMs=Number(process.argv[3]||30000);
 if(!Number.isFinite(durationMs)||durationMs<1000||durationMs>3600000)throw new Error('INVALID_SIMULATION_DURATION');
 const result=await simulate({imei,durationMs,onEvent:event=>console.log(JSON.stringify({event}))});console.log(JSON.stringify({event:'simulation_complete',...result}));
 if(!result.login||result.positions<1)process.exitCode=1;
}
