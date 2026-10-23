import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {simulate} from './simulator.mjs';
import {assertDemoDevice,assertLoopback} from './demo-manifest.mjs';
import {syntheticCommand,correlatedSyntheticResult} from '../../infra/telematics/bridge-contract.mjs';
const root=path.resolve(import.meta.dirname,'../..'),directory=path.join(root,'.local/telematics');
const configurations=JSON.parse(await readFile(path.join(directory,'application-env.json'),'utf8'));
const manifest=JSON.parse(await readFile(path.join(directory,'gateway-devices.json'),'utf8'));
const config=configurations.find(row=>row.id===manifest.gatewayId);if(!config)throw new Error('ISOLATED_GATEWAY_CONFIG_MISSING');
const api=assertLoopback(config.apiUrl),device=manifest.devices[0],demo=assertDemoDevice(device.imei);
if(device.protocolDeviceId!==demo.protocolDeviceId||!Number.isSafeInteger(device.gatewayDeviceId))throw new Error('SYNTHETIC_BINDING_CHANGED');
async function request(route,options={}){
 const response=await fetch(new URL(route,api),{...options,headers:{Authorization:`Bearer ${config.apiToken}`,...(options.body?{'Content-Type':'application/json'}:{}),...options.headers},
  signal:AbortSignal.timeout(5000),redirect:'error'});
 if(!response.ok)throw new Error(`GATEWAY_REHEARSAL_HTTP_${response.status}`);return response;
}
const start=new Date(),simulation=simulate({imei:demo.imei,durationMs:18000});
let rawFixVerified=false,commandAcknowledged=false,commandDispatched=false;
const commandId=randomUUID();
for(let attempt=0;attempt<7;attempt++){
 await new Promise(resolve=>setTimeout(resolve,2000));
 const rows=await(await request(`positions?deviceId=${device.gatewayDeviceId}&from=${encodeURIComponent(start.toISOString())}&to=${encodeURIComponent(new Date().toISOString())}`)).json();
 rawFixVerified=rawFixVerified||rows.some(row=>row.valid&&Math.abs(row.latitude-demo.latitude)<0.000001&&Math.abs(row.longitude-demo.longitude)<0.000001&&row.protocol==='gt06');
 if(rawFixVerified&&!commandDispatched){
  const command=syntheticCommand({id:commandId,gatewayDeviceId:device.gatewayDeviceId,protocol:'gt06',modelProfile:'SYNTHETIC_GT06',synthetic:true,command:'LOCATE',expiresAt:new Date(Date.now()+15000).toISOString()});
  const response=await request('commands/send',{method:'POST',body:JSON.stringify(command)});
  if(response.status!==200)throw new Error('SYNTHETIC_COMMAND_NOT_DISPATCHED');commandDispatched=true;
 }
 commandAcknowledged=rows.some(row=>correlatedSyntheticResult(row.attributes?.result)===commandId);
 if(commandAcknowledged)break;
}
const outcome=await simulation;
const query=`select count(*) from loadgistic_bridge.outbox where (payload->>'deviceId')::bigint=${device.gatewayDeviceId};`;
const child=spawnSync('docker',['compose','--env-file',path.join(directory,'compose.env'),'-f',path.join(root,'infra/telematics/compose.yml'),'exec','-T','database','psql','-X','-q','-t','-A','-U','traccar','-d','traccar','-c',query],{cwd:root,encoding:'utf8'});
const outboxRows=child.status===0?Number(child.stdout.trim()):0;
const passed=outcome.login&&rawFixVerified&&commandDispatched&&commandAcknowledged&&outboxRows>0;
const evidence={event:'actual_gt06_roundtrip',passed,loginAcknowledged:outcome.login,rawFixVerified,commandDispatched,commandAcknowledged,outboxRows,
 checkedAt:new Date().toISOString(),gatewayVersion:'6.16.0',hardwareCertification:false,sourceHashes:{}};
for(const name of ['scripts/telematics/protocol-roundtrip.mjs','scripts/telematics/simulator.mjs','infra/telematics/bridge-contract.mjs','infra/telematics/gateway-outbox.sql'])
 evidence.sourceHashes[name]=createHash('sha256').update(await readFile(path.join(root,name))).digest('hex');
await writeFile(path.join(directory,'protocol-roundtrip-evidence.json'),JSON.stringify(evidence),{mode:0o600});
console.log(JSON.stringify(evidence));
if(!passed)process.exitCode=1;
