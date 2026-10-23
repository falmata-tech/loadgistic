// Root/operator-run recovery rehearsal for this isolated bridge service only.
import {createClient} from '@supabase/supabase-js';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {assertLocalAuthorityFixtureTarget} from '../fixture-provider-authority.mjs';
import {assertDemoDevice,assertDemoIdentity} from './demo-manifest.mjs';
import {simulate} from './simulator.mjs';
const root=path.resolve(import.meta.dirname,'../..'),directory=path.join(root,'.local/telematics');
const url=assertLocalAuthorityFixtureTarget(process.env.SUPABASE_SEED_URL),key=process.env.SUPABASE_SEED_SERVICE_ROLE_KEY;
if(!key)throw new Error('LOCAL_RESTART_CONFIG_MISSING');
const manifest=JSON.parse(await readFile(path.join(directory,'application-demo-manifest.json'),'utf8'));
if(manifest.purpose!=='local-fictional-gps'||manifest.targets.length!==2)throw new Error('LOCAL_RESTART_MANIFEST_REFUSED');
const target=manifest.targets.find(row=>row.imei==='990000000000001');if(!target)throw new Error('LOCAL_RESTART_TARGET_REFUSED');assertDemoDevice(target.imei);
const gatewayDevices=JSON.parse(await readFile(path.join(directory,'gateway-devices.json'),'utf8'));
const binding=gatewayDevices.devices.find(row=>row.imei===target.imei);
if(gatewayDevices.gatewayId!==manifest.gatewayId||!Number.isSafeInteger(binding?.gatewayDeviceId))throw new Error('LOCAL_RESTART_BINDING_REFUSED');
const service=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
const identity=await service.auth.admin.getUserById(target.ownerId);
if(identity.error)throw new Error('LOCAL_RESTART_OWNER_REFUSED');assertDemoIdentity(identity.data.user,'user-transporter');
const stored=await service.from('telematics_devices').select('imei,synthetic,gateway_id,gateway_device_id').eq('id',target.deviceId).single();
if(stored.error||!stored.data.synthetic||stored.data.imei!==target.imei||stored.data.gateway_id!==manifest.gatewayId||stored.data.gateway_device_id!==binding.gatewayDeviceId)throw new Error('LOCAL_RESTART_DEVICE_REFUSED');
const compose=['compose','--env-file',path.join(directory,'compose.env'),'-f',path.join(root,'infra/telematics/compose.yml')];
function docker(args){const child=spawnSync('docker',args,{cwd:root,encoding:'utf8'});if(child.status!==0)throw new Error('ISOLATED_BRIDGE_RESTART_FAILED');return child.stdout.trim();}
function query(sql){return docker([...compose,'exec','-T','database','psql','-X','-q','-t','-A','-U','traccar','-d','traccar','-c',sql]);}
const started=new Date();let stopped=false,queued=0,recovered=0;
try{
 docker([...compose,'stop','bridge']);stopped=true;
 const result=await simulate({imei:target.imei,durationMs:8000});if(!result.login||!result.positions)throw new Error('LOCAL_RESTART_PROTOCOL_FAILED');
 const rows=query(`select source_id from loadgistic_bridge.outbox where (payload->>'deviceId')::bigint=${binding.gatewayDeviceId} and created_at>='${started.toISOString()}' and delivered_at is null order by id;`)
  .split('\n').filter(Boolean).map(Number);
 if(!rows.length||rows.some(id=>!Number.isSafeInteger(id)||id<1))throw new Error('DURABLE_OUTBOX_NOT_QUEUED');queued=rows.length;
 docker([...compose,'--profile','bridge','up','-d','bridge']);stopped=false;
 for(let attempt=0;attempt<30;attempt++){
  const {data,error}=await service.from('telematics_positions').select('id').eq('gateway_id',manifest.gatewayId).eq('device_id',target.deviceId).in('event_key',rows.map(id=>`position:${id}`));
  if(error)throw new Error('LOCAL_RESTART_APP_READ_FAILED');recovered=data.length;if(recovered===queued)break;await new Promise(resolve=>setTimeout(resolve,1000));
 }
 const evidence={event:'durable_bridge_restart',checkedAt:new Date().toISOString(),passed:queued>0&&recovered===queued,queuedDuringOutage:queued,recoveredAfterRestart:recovered,hardwareCertification:false,
  sourceHashes:{}};
 for(const name of ['infra/telematics/worker.mjs','infra/telematics/gateway-outbox.sql','scripts/telematics/verify-restart-local.mjs'])
  evidence.sourceHashes[name]=createHash('sha256').update(await readFile(path.join(root,name))).digest('hex');
 await writeFile(path.join(directory,'restart-verification-evidence.json'),JSON.stringify(evidence),{mode:0o600});console.log(JSON.stringify(evidence));
 if(!evidence.passed)process.exitCode=1;
}finally{if(stopped)docker([...compose,'--profile','bridge','up','-d','bridge']);}
