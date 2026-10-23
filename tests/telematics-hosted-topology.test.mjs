import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {commandsEnabled} from '../infra/telematics/bridge-command-mode.mjs';

test('tracker command dispatch is disabled unless explicitly enabled',()=>{
 assert.equal(commandsEnabled(undefined),false);
 assert.equal(commandsEnabled('false'),false);
 assert.equal(commandsEnabled('true'),true);
 for(const value of ['TRUE','1','yes',''])assert.throws(()=>commandsEnabled(value),/GATEWAY_COMMAND_MODE_INVALID/);
});

test('hosted demo GPS has no published ingress, API, or shared database/bridge',()=>{
 const environment={...process.env,GPS_INGRESS_BIND_ADDRESS:'127.0.0.1',
  GATEWAY_DATABASE_PASSWORD:'fixture-real-db',GATEWAY_BRIDGE_PASSWORD:'fixture-real-bridge',
  GATEWAY_ID:'00000000-0000-4000-8000-000000000001',GATEWAY_SECRET:'a'.repeat(64),
  SYNTHETIC_DATABASE_PASSWORD:'fixture-demo-db',SYNTHETIC_BRIDGE_PASSWORD:'fixture-demo-bridge',
  SYNTHETIC_GATEWAY_ID:'00000000-0000-4000-8000-000000000002',SYNTHETIC_GATEWAY_SECRET:'b'.repeat(64),
  LOADGISTIC_GATEWAY_URL:'https://example.invalid/api/telematics/gateway'};
 const run=spawnSync('docker',['compose','-f','infra/telematics/compose.hosted.yml','config','--format','json'],
  {cwd:new URL('..',import.meta.url),env:environment,encoding:'utf8',maxBuffer:1024*1024});
 if(run.error?.code==='ENOENT')return; // Source invariant below still runs without Docker.
 assert.equal(run.status,0,run.stderr);
 const {services,networks}=JSON.parse(run.stdout);
 const realPorts=services.traccar.ports.map(row=>[row.host_ip,row.published,row.target]);
 assert.deepEqual(realPorts,[['127.0.0.1','15023',5023],['127.0.0.1','18082',8082]]);
 for(const name of ['synthetic-database','synthetic-traccar','synthetic-bridge'])assert.equal(services[name].ports,undefined);
 assert.deepEqual(Object.keys(services['synthetic-traccar'].networks),['synthetic-backend']);
 assert.deepEqual(Object.keys(services['synthetic-database'].networks),['synthetic-backend']);
 assert.deepEqual(Object.keys(services['synthetic-bridge'].networks).sort(),['synthetic-backend','synthetic-egress']);
 assert.deepEqual(Object.keys(services.bridge.networks).sort(),['gateway-backend','gateway-egress']);
 assert.equal(networks['synthetic-backend'].internal,true);
 assert.equal(networks['gateway-backend'].internal,true);
 assert.equal(services['synthetic-bridge'].environment.GATEWAY_COMMANDS_ENABLED,'false');
 assert.equal(services.bridge.environment.GATEWAY_COMMANDS_ENABLED,'false');
 for(const name of ['bridge','synthetic-bridge']){
  assert.equal(services[name].environment.TRACCAR_API_TOKEN,undefined);
  assert.equal(services[name].environment.TRACCAR_API_URL,undefined);
 }
 assert.notEqual(services['synthetic-database'].volumes[0].source,services.database.volumes[0].source);
 assert.match(services['synthetic-bridge'].environment.GATEWAY_DATABASE_URL,/@synthetic-database:5432/);
 assert.match(services.bridge.environment.GATEWAY_DATABASE_URL,/@database:5432/);
 assert.equal(services['synthetic-motion-worker'],undefined);
 const opted=spawnSync('docker',['compose','-f','infra/telematics/compose.hosted.yml',
  '--profile','hosted-demo-motion','config','--format','json'],
 {cwd:new URL('..',import.meta.url),env:environment,encoding:'utf8',maxBuffer:1024*1024});
 assert.equal(opted.status,0,opted.stderr);
 const worker=JSON.parse(opted.stdout).services['synthetic-motion-worker'];
 assert.deepEqual(worker.profiles,['hosted-demo-motion']);
 assert.equal(worker.ports,undefined);
 assert.deepEqual(Object.keys(worker.networks).sort(),['synthetic-backend','synthetic-egress']);
 assert.equal(worker.environment.LOADGISTIC_HOSTED_MOTION_WORKER_ENABLED,'false');
 assert.equal(worker.environment.LOADGISTIC_HOSTED_MOTION_WORKER_KILL_SWITCH,'true');
 assert.equal(worker.environment.SYNTHETIC_GT06_HOST,'synthetic-traccar');
 assert.equal(worker.environment.SYNTHETIC_GT06_PORT,'5023');
 for(const key of ['GATEWAY_DATABASE_URL','GATEWAY_SECRET','SYNTHETIC_GATEWAY_SECRET','TRACCAR_API_TOKEN',
  'SUPABASE_SERVICE_ROLE_KEY'])assert.equal(worker.environment[key],undefined);
});

test('hosted synthetic config accepts only GT06 and cannot register unknown devices',()=>{
 const xml=readFileSync(new URL('../infra/telematics/traccar-synthetic.xml',import.meta.url),'utf8');
 assert.match(xml,/<entry key="protocols.enable">gt06<\/entry>/);
 assert.match(xml,/<entry key="database.registerUnknown">false<\/entry>/);
 assert.match(xml,/<entry key="database.saveOriginal">false<\/entry>/);
 assert.doesNotMatch(xml,/<entry key="(?:database.password|web.serviceAccountToken)">[^<]+<\/entry>/i);
});
