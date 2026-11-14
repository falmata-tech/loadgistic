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

test('physical and fictional services have independent source manifests and no cross-project dependency',()=>{
 const real=readFileSync(new URL('../infra/telematics/compose.hosted.yml',import.meta.url),'utf8');
 const synthetic=readFileSync(new URL('../infra/telematics/compose.synthetic.yml',import.meta.url),'utf8');
 const services=text=>[...text.split('\nnetworks:')[0].matchAll(/^  ([a-z][a-z-]+):$/gm)].map(match=>match[1]);
 assert.deepEqual(services(real),['database','traccar','bridge','enrollment-relay']);
 assert.deepEqual(services(synthetic),['synthetic-database','synthetic-traccar','synthetic-bridge','synthetic-motion-worker','synthetic-enrollment-relay']);
 assert.doesNotMatch(real,/SYNTHETIC_[A-Z_]+|synthetic-backend|synthetic-egress/);
 assert.doesNotMatch(synthetic,/\$\{(?:GPS_INGRESS_BIND_ADDRESS|GATEWAY_DATABASE_PASSWORD|GATEWAY_BRIDGE_PASSWORD|GATEWAY_ID|GATEWAY_SECRET)[:}]/);
 assert.match(synthetic,/ports: \['127\.0\.0\.1:28083:8080\/tcp'\]/);
 assert.doesNotMatch(synthetic,/ports:[^\n]*(?:5023|8082|5432)/);
 assert.match(readFileSync(new URL('../infra/telematics/Dockerfile',import.meta.url),'utf8'),/COPY [^\n]*gateway-health\.mjs/);
 for(const file of [real,synthetic]){
  assert.match(file,/test: \[CMD, node, gateway-health\.mjs, --check\]/);
  assert.match(file,/tmpfs: \['\/tmp\/loadgistic-bridge:rw,noexec,nosuid,size=1m,uid=1000,gid=1000,mode=0700'\]/);
 }
});

test('opt-in enrollment relays expose only host-loopback sockets and receive separate file credentials',t=>{
 const environment={...process.env,GPS_INGRESS_BIND_ADDRESS:'127.0.0.1',
  GATEWAY_DATABASE_PASSWORD:'fixture-real-db',GATEWAY_BRIDGE_PASSWORD:'fixture-real-bridge',
  GATEWAY_ID:'00000000-0000-4000-8000-000000000001',GATEWAY_SECRET:'a'.repeat(64),
  SYNTHETIC_DATABASE_PASSWORD:'fixture-demo-db',SYNTHETIC_BRIDGE_PASSWORD:'fixture-demo-bridge',
  SYNTHETIC_GATEWAY_ID:'00000000-0000-4000-8000-000000000002',SYNTHETIC_GATEWAY_SECRET:'b'.repeat(64),
  LOADGISTIC_GATEWAY_URL:'https://example.invalid/api/telematics/gateway'};
 for(const [file,name,scope,backend,port] of [
  ['compose.hosted.yml','enrollment-relay','real','gateway-backend','18083'],
  ['compose.synthetic.yml','synthetic-enrollment-relay','synthetic','synthetic-backend','28083']]){
  const run=spawnSync('docker',['compose','-f',`infra/telematics/${file}`,'--profile','enrollment-relay','config','--format','json'],
   {cwd:new URL('..',import.meta.url),env:environment,encoding:'utf8',maxBuffer:1024*1024});
  if(run.error?.code==='ENOENT'){t.skip('Docker Compose unavailable');return;}
  assert.equal(run.status,0,run.stderr);const relay=JSON.parse(run.stdout).services[name];
  assert.deepEqual(relay.ports.map(row=>[row.host_ip,row.published,row.target]),[['127.0.0.1',port,8080]]);
  assert.deepEqual(Object.keys(relay.networks),[backend]);
  assert.equal(relay.environment.ENROLLMENT_RELAY_SCOPE,scope);
  assert.equal(relay.volumes.length,2);assert.ok(relay.volumes.every(row=>row.read_only&&row.bind.create_host_path===false));
  assert.equal(relay.read_only,true);
  for(const field of ['TRACCAR_API_TOKEN','GATEWAY_SECRET','GATEWAY_DATABASE_URL','SUPABASE_SERVICE_ROLE_KEY'])
   assert.equal(relay.environment[field],undefined);
 }
});

test('rendered independent hosted projects preserve isolation and default-off movement',t=>{
 const environment={...process.env,GPS_INGRESS_BIND_ADDRESS:'127.0.0.1',
  GATEWAY_DATABASE_PASSWORD:'fixture-real-db',GATEWAY_BRIDGE_PASSWORD:'fixture-real-bridge',
  GATEWAY_ID:'00000000-0000-4000-8000-000000000001',GATEWAY_SECRET:'a'.repeat(64),
  SYNTHETIC_DATABASE_PASSWORD:'fixture-demo-db',SYNTHETIC_BRIDGE_PASSWORD:'fixture-demo-bridge',
  SYNTHETIC_GATEWAY_ID:'00000000-0000-4000-8000-000000000002',SYNTHETIC_GATEWAY_SECRET:'b'.repeat(64),
  LOADGISTIC_GATEWAY_URL:'https://example.invalid/api/telematics/gateway'};
 const run=spawnSync('docker',['compose','-f','infra/telematics/compose.hosted.yml','config','--format','json'],
  {cwd:new URL('..',import.meta.url),env:environment,encoding:'utf8',maxBuffer:1024*1024});
 if(run.error?.code==='ENOENT'){t.skip('Docker Compose unavailable; independent source invariants still run');return;}
 assert.equal(run.status,0,run.stderr);
 const physical=JSON.parse(run.stdout),{services,networks}=physical;
 assert.deepEqual(Object.keys(services).sort(),['bridge','database','traccar']);
 const realPorts=services.traccar.ports.map(row=>[row.host_ip,row.published,row.target]);
 assert.deepEqual(realPorts,[['127.0.0.1','15023',5023],['127.0.0.1','18082',8082]]);
 assert.deepEqual(Object.keys(services.bridge.networks).sort(),['gateway-backend','gateway-egress']);
 assert.equal(networks['gateway-backend'].internal,true);
 assert.equal(services.bridge.environment.GATEWAY_COMMANDS_ENABLED,'false');
 assert.equal(services.bridge.environment.TRACCAR_API_TOKEN,undefined);
 assert.equal(services.bridge.environment.TRACCAR_API_URL,undefined);
 assert.deepEqual(services.bridge.healthcheck.test,['CMD','node','gateway-health.mjs','--check']);
 assert.equal(services.bridge.depends_on.traccar.condition,'service_healthy');
 assert.match(services.bridge.environment.GATEWAY_DATABASE_URL,/@database:5432/);
 // Each render has only its own required env, proving a missing other-project
 // credential cannot couple service startup/lifecycle.
 const realOnly={...environment};for(const key of Object.keys(realOnly))if(key.startsWith('SYNTHETIC_'))delete realOnly[key];
 const alone=spawnSync('docker',['compose','-f','infra/telematics/compose.hosted.yml','config','--format','json'],
 {cwd:new URL('..',import.meta.url),env:realOnly,encoding:'utf8',maxBuffer:1024*1024});
 assert.equal(alone.status,0,alone.stderr);
 const syntheticOnly={...environment};for(const key of ['GPS_INGRESS_BIND_ADDRESS','GATEWAY_DATABASE_PASSWORD','GATEWAY_BRIDGE_PASSWORD','GATEWAY_ID','GATEWAY_SECRET'])delete syntheticOnly[key];
 const separate=spawnSync('docker',['compose','-f','infra/telematics/compose.synthetic.yml','config','--format','json'],
 {cwd:new URL('..',import.meta.url),env:syntheticOnly,encoding:'utf8',maxBuffer:1024*1024});
 assert.equal(separate.status,0,separate.stderr);
 const fictional=JSON.parse(separate.stdout),synthetic=fictional.services;
 assert.notEqual(fictional.name,physical.name);
 assert.deepEqual(Object.keys(synthetic).sort(),['synthetic-bridge','synthetic-database','synthetic-traccar']);
 for(const name of Object.keys(synthetic))assert.equal(synthetic[name].ports,undefined);
 assert.deepEqual(Object.keys(synthetic['synthetic-traccar'].networks),['synthetic-backend']);
 assert.deepEqual(Object.keys(synthetic['synthetic-database'].networks),['synthetic-backend']);
 assert.deepEqual(Object.keys(synthetic['synthetic-bridge'].networks).sort(),['synthetic-backend','synthetic-egress']);
 assert.equal(fictional.networks['synthetic-backend'].internal,true);
 assert.equal(synthetic['synthetic-bridge'].environment.GATEWAY_COMMANDS_ENABLED,'false');
 assert.equal(synthetic['synthetic-bridge'].environment.TRACCAR_API_TOKEN,undefined);
 assert.equal(synthetic['synthetic-bridge'].environment.TRACCAR_API_URL,undefined);
 assert.notEqual(synthetic['synthetic-database'].volumes[0].source,services.database.volumes[0].source);
 assert.match(synthetic['synthetic-bridge'].environment.GATEWAY_DATABASE_URL,/@synthetic-database:5432/);
 const opted=spawnSync('docker',['compose','-f','infra/telematics/compose.synthetic.yml',
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
 const scenario=spawnSync('docker',['compose','-f','infra/telematics/compose.scenario.yml',
  '--profile','hosted-demo-scenarios','config','--format','json'],
 {cwd:new URL('..',import.meta.url),env:{PATH:process.env.PATH,
  ...(process.env.DOCKER_CONFIG?{DOCKER_CONFIG:process.env.DOCKER_CONFIG}:{}),
  ...(process.env.HOME?{HOME:process.env.HOME}:{}),DEMO_CAPACITY_WORKER_SECRET:'',
  LOADGISTIC_SCENARIO_WORKER_ENABLED:'',LOADGISTIC_SCENARIO_WORKER_KILL_SWITCH:''},encoding:'utf8',maxBuffer:1024*1024});
 assert.equal(scenario.status,0,scenario.stderr);
 const scenarioProject=JSON.parse(scenario.stdout),fast=scenarioProject.services['synthetic-scenario-worker'];
 assert.notEqual(scenarioProject.name,physical.name);assert.notEqual(scenarioProject.name,fictional.name);
 assert.deepEqual(Object.keys(scenarioProject.services),['synthetic-scenario-worker']);
 assert.deepEqual(fast.profiles,['hosted-demo-scenarios']);assert.equal(fast.ports,undefined);
 assert.deepEqual(Object.keys(fast.networks),['scenario-egress']);assert.equal(fast.depends_on,undefined);
 assert.equal(fast.environment.LOADGISTIC_SCENARIO_WORKER_ENABLED,'false');
 assert.equal(fast.environment.LOADGISTIC_SCENARIO_WORKER_KILL_SWITCH,'true');
 assert.equal(fast.environment.DEMO_CAPACITY_WORKER_SECRET,'');
 assert.deepEqual(fast.healthcheck.test,['CMD','node','/app/infra/telematics/scenario-worker.mjs','--health']);
 assert.equal(fast.read_only,true);
 assert.ok(fast.tmpfs.some(value=>value.startsWith('/run/loadgistic-scenario:')));
 for(const key of ['GATEWAY_DATABASE_URL','GATEWAY_SECRET','SYNTHETIC_GATEWAY_SECRET','TRACCAR_API_TOKEN',
  'SUPABASE_SERVICE_ROLE_KEY','DEMO_WORLD_WORKER_SECRET','HOSTED_DEMO_MOTION_SECRET'])assert.equal(fast.environment[key],undefined);
});

test('hosted synthetic config accepts only GT06 and cannot register unknown devices',()=>{
 const xml=readFileSync(new URL('../infra/telematics/traccar-synthetic.xml',import.meta.url),'utf8');
 assert.match(xml,/<entry key="protocols.enable">gt06<\/entry>/);
 assert.match(xml,/<entry key="database.registerUnknown">false<\/entry>/);
 assert.match(xml,/<entry key="database.saveOriginal">false<\/entry>/);
 assert.doesNotMatch(xml,/<entry key="(?:database.password|web.serviceAccountToken)">[^<]+<\/entry>/i);
});
