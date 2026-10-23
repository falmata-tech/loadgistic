import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {DEMO_DEVICES,DEMO_GPS_COHORT_DEVICES,assertLoopback} from './demo-manifest.mjs';
const root=path.resolve(import.meta.dirname,'../..'),directory=path.join(root,'.local/telematics');
const config=JSON.parse(await readFile(path.join(directory,'bootstrap.json'),'utf8'));
const api=assertLoopback('http://127.0.0.1:18082/api/');
let identity;try{identity=JSON.parse(await readFile(path.join(directory,'api-identity.json'),'utf8'));}
catch(error){if(error.code!=='ENOENT')throw error;identity={email:'telematics-demo@loadgistic.invalid',password:randomBytes(32).toString('hex')};
 await writeFile(path.join(directory,'api-identity.json'),JSON.stringify(identity),{flag:'wx',mode:0o600});}
async function request(route,options={}){
 const response=await fetch(new URL(route,api),{...options,headers:{Authorization:`Basic ${Buffer.from(`${identity.email}:${identity.password}`).toString('base64')}`,
  ...(options.body?{'Content-Type':'application/json'}:{}),...options.headers},signal:AbortSignal.timeout(10000),redirect:'error'});
 if(!response.ok)throw new Error(`GATEWAY_API_FAILED_${response.status}`);return response;
}
let account;
try{const users=await(await request('users?limit=100')).json();account=users.find(user=>user.email===identity.email);if(!account)throw new Error('GATEWAY_ADMIN_MISSING');}
catch{
 const response=await fetch(new URL('users',api),{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({...identity,name:'Isolated synthetic gateway administrator'}),signal:AbortSignal.timeout(10000),redirect:'error'});
 if(!response.ok)throw new Error(`ISOLATED_GATEWAY_BOOTSTRAP_REFUSED_${response.status}`);account=await response.json();
}
if(account.email!==identity.email||account.administrator!==true)throw new Error('ISOLATED_GATEWAY_ADMIN_REQUIRED');
// Token is limited to this isolated gateway account; never an application key.
const token=await(await request('session/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
 body:new URLSearchParams({expiration:new Date(Date.now()+7*86400000).toISOString()}).toString()})).text();
if(token.length<16||/[\r\n]/.test(token))throw new Error('GATEWAY_TOKEN_INVALID');
const devices=[];
const selectedDevices=process.env.LOADGISTIC_DEMO_GPS_COHORT==='true'?[...DEMO_DEVICES,...DEMO_GPS_COHORT_DEVICES]:DEMO_DEVICES;
for(const demo of selectedDevices){
 const matches=await(await request(`devices?uniqueId=${demo.protocolDeviceId}`)).json();
 const expected={'loadgistic.imei':demo.imei,'loadgistic.protocol':demo.protocol,'loadgistic.synthetic':true};let device;
 if(matches.length){device=matches[0];if(matches.length!==1||device.uniqueId!==demo.protocolDeviceId
  ||Object.entries(expected).some(([key,value])=>device.attributes?.[key]!==value))throw new Error('SYNTHETIC_GATEWAY_BINDING_CHANGED');}
 else device=await(await request('devices',{method:'POST',body:JSON.stringify({name:demo.label,uniqueId:demo.protocolDeviceId,model:'SYNTHETIC_GT06',attributes:expected})})).json();
 const verified=await(await request(`devices/${device.id}`)).json();if(verified.uniqueId!==demo.protocolDeviceId)throw new Error('SYNTHETIC_GATEWAY_READBACK_FAILED');
 devices.push({...demo,gatewayDeviceId:verified.id});
}
// A separate API account can command only these explicitly linked devices.
// It has no administrator, user-management or device-registration privilege.
let bridgeIdentity;try{bridgeIdentity=JSON.parse(await readFile(path.join(directory,'api-bridge-identity.json'),'utf8'));}
catch(error){if(error.code!=='ENOENT')throw error;bridgeIdentity={email:'telematics-bridge@loadgistic.invalid',password:randomBytes(32).toString('hex')};
 await writeFile(path.join(directory,'api-bridge-identity.json'),JSON.stringify(bridgeIdentity),{flag:'wx',mode:0o600});}
const users=await(await request('users?limit=100')).json(),matches=users.filter(user=>user.email===bridgeIdentity.email);let bridgeUser;
if(matches.length>1)throw new Error('ISOLATED_BRIDGE_API_IDENTITY_CHANGED');
if(matches.length)bridgeUser=matches[0];
else bridgeUser=await(await request('users',{method:'POST',body:JSON.stringify({...bridgeIdentity,name:'Synthetic gateway bridge',administrator:false,readonly:false,deviceReadonly:true,deviceLimit:0,userLimit:0})})).json();
if(bridgeUser.administrator||bridgeUser.readonly||bridgeUser.deviceReadonly!==true||bridgeUser.deviceLimit!==0||bridgeUser.userLimit!==0)throw new Error('ISOLATED_BRIDGE_API_SCOPE_CHANGED');
for(const device of devices){
 const permissions=await(await request(`permissions?userId=${bridgeUser.id}&deviceId=${device.gatewayDeviceId}`)).json();
 if(!permissions.length)await request('permissions',{method:'POST',body:JSON.stringify({userId:bridgeUser.id,deviceId:device.gatewayDeviceId})});
}
const bridgeToken=await(await request('session/token',{method:'POST',headers:{Authorization:`Basic ${Buffer.from(`${bridgeIdentity.email}:${bridgeIdentity.password}`).toString('base64')}`,
 'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({expiration:new Date(Date.now()+7*86400000).toISOString()}).toString()})).text();
if(bridgeToken.length<16||/[\r\n]/.test(bridgeToken))throw new Error('ISOLATED_BRIDGE_API_TOKEN_INVALID');
if(!/^[a-f0-9]{48}$/.test(config.bridgePassword))throw new Error('ISOLATED_BRIDGE_PASSWORD_INVALID');
const sql=`do $$ begin if not exists(select 1 from pg_roles where rolname='loadgistic_bridge') then create role loadgistic_bridge login;end if;end $$;
alter role loadgistic_bridge with login nosuperuser nocreatedb nocreaterole noinherit password '${config.bridgePassword}';\n`;
const outbox=await readFile(path.join(root,'infra/telematics/gateway-outbox.sql'),'utf8');
const child=spawnSync('docker',['compose','--env-file',path.join(directory,'compose.env'),'-f',path.join(root,'infra/telematics/compose.yml'),'exec','-T','database','psql','-X','-q','-v','ON_ERROR_STOP=1','-U','traccar','-d','traccar'],{
 cwd:root,input:sql+outbox,encoding:'utf8',stdio:['pipe','pipe','pipe']});
if(child.status!==0)throw new Error('ISOLATED_GATEWAY_OUTBOX_INSTALL_FAILED'); // Never print SQL containing a password.
await writeFile(path.join(directory,'gateway-devices.json'),JSON.stringify({gatewayId:config.id,devices}),{mode:0o600});
await writeFile(path.join(directory,'application-env.json'),JSON.stringify([{id:config.id,secret:config.secret,apiUrl:api.href,apiToken:token}]),{mode:0o600});
const env=await readFile(path.join(directory,'compose.env'),'utf8');
await writeFile(path.join(directory,'compose.env'),env.replace(/^TRACCAR_API_TOKEN=.*$/m,`TRACCAR_API_TOKEN=${bridgeToken}`),{mode:0o600});
console.log(JSON.stringify({event:'isolated_gateway_ready',provisionedSyntheticDevices:devices.length,outboxInstalled:true,bridgeRole:'restricted'}));
