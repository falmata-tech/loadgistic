import net from 'node:net';
import {gt06Packet,gpsPacket,crc16X25} from './simulator.mjs';
/** Dedicated disposable003 only; the primary simulator's two-device allowlist stays unchanged. */
export function assertPrivacyDemoBinding(binding){
 if(!binding||binding.imei!=='990000000000003'||binding.protocolDeviceId!=='990000000000003'||binding.protocol!=='gt06'
  ||binding.synthetic!==true||!Number.isSafeInteger(binding.gatewayDeviceId)||binding.gatewayDeviceId<1
  ||!(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i).test(binding.gatewayId||''))
  throw new Error('PRIVACY_DEMO_BINDING_REFUSED');return binding;
}
export async function sendPrivacyDemoFix(binding){
 assertPrivacyDemoBinding(binding);
 return new Promise((resolve,reject)=>{
  const socket=net.createConnection({host:'127.0.0.1',port:15023});let buffer=Buffer.alloc(0),sent=false,settled=false;
  const finish=error=>{if(settled)return;settled=true;clearTimeout(timer);socket.destroy();error?reject(error):resolve({login:true,positions:1});};
  const timer=setTimeout(()=>finish(new Error('PRIVACY_PROTOCOL_TIMEOUT')),8000);
  socket.on('connect',()=>socket.write(gt06Packet(1,Buffer.from(`0${binding.imei}0000`,'hex'))));
  socket.on('data',chunk=>{buffer=Buffer.concat([buffer,chunk]);if(buffer.length>4096){finish(new Error('PRIVACY_PROTOCOL_INVALID'));return;}
   while(buffer.length>=5){if(buffer[0]!==0x78||buffer[1]!==0x78){finish(new Error('PRIVACY_PROTOCOL_INVALID'));return;}
    const size=buffer[2]+5;if(buffer.length<size)return;const frame=buffer.subarray(0,size);buffer=buffer.subarray(size);
    if(frame.readUInt16BE(size-4)!==crc16X25(frame.subarray(2,size-4))){finish(new Error('PRIVACY_PROTOCOL_INVALID'));return;}
    if(frame[3]===1&&!sent){sent=true;socket.write(gpsPacket({latitude:9.031,longitude:38.748,speedKph:0,ignition:false},2));
     setTimeout(()=>finish(),1000);}
   }});
  socket.on('error',()=>finish(new Error('PRIVACY_PROTOCOL_UNAVAILABLE')));
  socket.on('close',()=>{if(!settled)finish(new Error('PRIVACY_PROTOCOL_UNAVAILABLE'));});
 });
}
