// Root/operator only: new isolated gateway and fictional disposable device; no application/Auth writes.
import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {assertLoopback} from './demo-manifest.mjs';
let stage='CONFIGURATION';
async function main(){
const root=path.resolve(import.meta.dirname,'../..'),directory=path.join(root,'.local/telematics');
const api=assertLoopback('http://127.0.0.1:18082/api/');
stage='GATEWAY_CONFIG';
const config=JSON.parse(await readFile(path.join(directory,'bootstrap.json'),'utf8'));
stage='ADMIN_IDENTITY';
const administrator=JSON.parse(await readFile(path.join(directory,'api-identity.json'),'utf8'));
stage='PRIVACY_CONFIG';
let privacy;try{privacy=JSON.parse(await readFile(path.join(directory,'privacy-bootstrap.json'),'utf8'));}
catch(error){if(error.code!=='ENOENT')throw error;privacy={secret:randomBytes(32).toString('hex'),databasePassword:randomBytes(24).toString('hex'),
 email:'telematics-privacy@loadgistic.invalid',password:randomBytes(32).toString('hex')};
 await writeFile(path.join(directory,'privacy-bootstrap.json'),JSON.stringify(privacy),{flag:'wx',mode:0o600});}
if(!/^[a-f0-9]{64}$/.test(privacy.secret)||!/^[a-f0-9]{48}$/.test(privacy.databasePassword)
 ||privacy.email!=='telematics-privacy@loadgistic.invalid'||!/^[a-f0-9]{64}$/.test(privacy.password))throw new Error('ISOLATED_PRIVACY_CONFIGURATION_CHANGED');
async function request(route,options={}){
 const response=await fetch(new URL(route,api),{...options,headers:{Authorization:`Basic ${Buffer.from(`${administrator.email}:${administrator.password}`).toString('base64')}`,
  ...(options.body?{'Content-Type':'application/json'}:{}),...options.headers},signal:AbortSignal.timeout(10000),redirect:'error'});
 if(!response.ok)throw new Error('ISOLATED_PRIVACY_API_REFUSED');return response;
}
stage='ADMIN_API';
const users=await(await request('users?limit=100')).json();
if(!users.some(row=>row.email===administrator.email&&row.administrator===true))throw new Error('ISOLATED_GATEWAY_ADMIN_REQUIRED');
const matches=users.filter(row=>row.email===privacy.email);if(matches.length>1)throw new Error('ISOLATED_PRIVACY_SCOPE_CHANGED');
stage='IDENTITY';
if(process.argv.includes('--identity-only')&&matches.length!==1)throw new Error('ISOLATED_PRIVACY_EXISTING_IDENTITY_REQUIRED');
const account=matches[0]||await(await request('users',{method:'POST',body:JSON.stringify({email:privacy.email,password:privacy.password,
 name:'Isolated fictional-device privacy janitor',administrator:false,readonly:false,deviceReadonly:false,deviceLimit:0,userLimit:0,limitCommands:true})})).json();
if(account.administrator||account.readonly||account.deviceReadonly||account.deviceLimit!==0||account.userLimit!==0||account.limitCommands!==true)
 throw new Error('ISOLATED_PRIVACY_SCOPE_CHANGED');
if(!Number.isSafeInteger(account.id)||account.id<1)throw new Error('ISOLATED_PRIVACY_SCOPE_CHANGED');
if(process.argv.includes('--identity-only')){
 // Repair only local adapter configuration using an existing verified identity; no API/DB mutation or token rotation.
 const envPath=path.join(directory,'compose.env'),existing=await readFile(envPath,'utf8');
 const pattern=/^TRACCAR_PRIVACY_USER_ID=.*$/m,value=`TRACCAR_PRIVACY_USER_ID=${account.id}`;
 await writeFile(envPath,pattern.test(existing)?existing.replace(pattern,value):`${existing.trimEnd()}\n${value}\n`,{mode:0o600});
 console.log(JSON.stringify({event:'isolated_privacy_identity_configured',identityVerified:true,gatewayWrites:0,applicationWrites:0}));return;
}
const demo={imei:'990000000000003',protocolDeviceId:'990000000000003',protocol:'gt06',synthetic:true};
stage='DEVICE';
const manifestPath=path.join(directory,'privacy-gateway-device.json');let prior;
try{prior=JSON.parse(await readFile(manifestPath,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
const devices=await(await request(`devices?uniqueId=${demo.protocolDeviceId}`)).json();
if(devices.length>1)throw new Error('ISOLATED_PRIVACY_BINDING_CHANGED');
if(prior&&(prior.gatewayId!==config.id||prior.imei!==demo.imei||prior.protocol!==demo.protocol||prior.protocolDeviceId!==demo.protocolDeviceId
 ||devices.length!==1||devices[0].id!==prior.gatewayDeviceId))throw new Error('ISOLATED_PRIVACY_DEVICE_ALREADY_ERASED_OR_CHANGED');
const device=devices[0]||await(await request('devices',{method:'POST',body:JSON.stringify({name:'Fictional disposable privacy rehearsal',
 uniqueId:demo.protocolDeviceId,model:'SYNTHETIC_GT06',attributes:{'loadgistic.imei':demo.imei,'loadgistic.protocol':demo.protocol,
  'loadgistic.synthetic':true,'loadgistic.purpose':'PRIVACY_REHEARSAL'}})})).json();
if(!Number.isSafeInteger(device.id)||device.id<1||device.uniqueId!==demo.protocolDeviceId
 ||device.attributes?.['loadgistic.imei']!==demo.imei||device.attributes?.['loadgistic.protocol']!==demo.protocol
 ||device.attributes?.['loadgistic.synthetic']!==true||device.attributes?.['loadgistic.purpose']!=='PRIVACY_REHEARSAL')throw new Error('ISOLATED_PRIVACY_BINDING_CHANGED');
const linked=await(await request(`devices?userId=${account.id}&limit=100`)).json();
if(linked.some(row=>row.id!==device.id))throw new Error('ISOLATED_PRIVACY_SCOPE_CHANGED');
if(!linked.length)await request('permissions',{method:'POST',body:JSON.stringify({userId:account.id,deviceId:device.id})});
stage='TOKEN';
const token=await(await request('session/token',{method:'POST',headers:{Authorization:`Basic ${Buffer.from(`${privacy.email}:${privacy.password}`).toString('base64')}`,
 'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({expiration:new Date(Date.now()+7*86400000).toISOString()}).toString()})).text();
if(token.length<16||/[\r\n]/.test(token))throw new Error('ISOLATED_PRIVACY_TOKEN_INVALID');
if(!/^[0-9a-f-]{36}$/i.test(config.id))throw new Error('ISOLATED_PRIVACY_CONFIGURATION_CHANGED');
const binding={gatewayId:config.id,gatewayDeviceId:device.id,...demo};
stage='DATABASE';
const sql=`do $$ begin if not exists(select 1 from pg_roles where rolname='loadgistic_janitor') then create role loadgistic_janitor login;end if;end $$;
alter role loadgistic_janitor with login nosuperuser nocreatedb nocreaterole noinherit password '${privacy.databasePassword}';\n`;
const setup=await readFile(path.join(root,'infra/telematics/gateway-privacy.sql'),'utf8');
const scope=`insert into loadgistic_bridge.privacy_scope(gateway_id,gateway_device_id,hardware_digest)
values('${config.id}',${device.id},loadgistic_bridge.privacy_hardware_digest('${JSON.stringify(binding)}'::jsonb)) on conflict do nothing;
do $$ begin if not exists(select 1 from loadgistic_bridge.privacy_scope where gateway_id='${config.id}' and gateway_device_id=${device.id}
and hardware_digest=loadgistic_bridge.privacy_hardware_digest('${JSON.stringify(binding)}'::jsonb)) then raise exception 'ISOLATED_PRIVACY_SCOPE_CHANGED';end if;end $$;`;
const child=spawnSync('docker',['compose','--env-file',path.join(directory,'compose.env'),'-f',path.join(root,'infra/telematics/compose.yml'),
 'exec','-T','database','psql','-X','-q','-v','ON_ERROR_STOP=1','-U','traccar','-d','traccar'],{cwd:root,input:sql+setup+scope,
 encoding:'utf8',stdio:['pipe','pipe','pipe']});
if(child.status!==0)throw new Error('ISOLATED_PRIVACY_DATABASE_SETUP_FAILED');
stage='PROTECTED_FILES';
await writeFile(manifestPath,JSON.stringify(binding),{mode:0o600});
await writeFile(path.join(directory,'application-privacy-env.json'),JSON.stringify([{id:config.id,secret:privacy.secret}]),{mode:0o600});
let env=await readFile(path.join(directory,'compose.env'),'utf8');
for(const [key,value] of Object.entries({GATEWAY_PRIVACY_SECRET:privacy.secret,GATEWAY_JANITOR_PASSWORD:privacy.databasePassword,TRACCAR_PRIVACY_API_TOKEN:token,TRACCAR_PRIVACY_USER_ID:account.id})){
 const pattern=new RegExp(`^${key}=.*$`,'m');env=pattern.test(env)?env.replace(pattern,`${key}=${value}`):`${env.trimEnd()}\n${key}=${value}\n`;
}
await writeFile(path.join(directory,'compose.env'),env,{mode:0o600});
console.log(JSON.stringify({event:'isolated_privacy_ready',scopedSyntheticDevices:1,administrator:false,engineCommands:false,applicationWrites:0}));
}
main().catch(error=>{
 const message=String(error?.message),code=/^ISOLATED_[A-Z_]+$/.test(message)?message:`ISOLATED_PRIVACY_SETUP_FAILED_${stage}`;
 console.error(JSON.stringify({event:'isolated_privacy_setup_pending',code,
  ...(error?.name==='TypeError'?{failureType:'TYPE_ERROR'}:{}),
  sourceLine:String(error?.stack).match(/bootstrap-privacy-local\.mjs:(\d+):\d+/)?.[1]||null,
  ...(/^[A-Z_]{1,40}$/.test(error?.cause?.code||'')?{networkCode:error.cause.code}:{})}));process.exitCode=1;
});
