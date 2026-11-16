import test from 'node:test';import assert from 'node:assert/strict';
import {pinnedLocalPilotDocker} from '../scripts/lib/pilot-owner-race-target.mjs';

test('remote DOCKER_CONTEXT overrides a local DOCKER_HOST and is refused before daemon operations',async()=>{
 const reads=[];
 await assert.rejects(pinnedLocalPilotDocker({environment:{DOCKER_HOST:'unix:///var/run/docker.sock',DOCKER_CONTEXT:'remote'},
  inspectContext:async name=>{reads.push(name);return 'ssh://remote.example.test';}}),/PILOT_RACE_LOCAL_DOCKER_REQUIRED/);
 assert.deepEqual(reads,['remote']);
});
test('a verified local context is pinned independently of conflicting host env and later context changes',async()=>{
 const environment={DOCKER_CONTEXT:'desktop-linux',DOCKER_HOST:'tcp://remote.example.test:2375',PATH:'/usr/bin'},reads=[];
 const pinned=await pinnedLocalPilotDocker({environment,inspectContext:async name=>{reads.push(name);return 'unix:///Users/test/.docker/run/docker.sock';}});
 assert.deepEqual(reads,['desktop-linux']);assert.deepEqual(pinned.args,['--host','unix:///Users/test/.docker/run/docker.sock']);
 assert.equal(pinned.environment.DOCKER_CONTEXT,undefined);assert.equal(pinned.environment.DOCKER_HOST,undefined);assert.equal(pinned.environment.PATH,'/usr/bin');
 environment.DOCKER_CONTEXT='remote';environment.DOCKER_HOST='ssh://remote.example.test';
 assert.equal(pinned.endpoint,'unix:///Users/test/.docker/run/docker.sock');assert.equal(pinned.environment.DOCKER_CONTEXT,undefined);
 assert.equal(Object.isFrozen(pinned),true);assert.equal(Object.isFrozen(pinned.args),true);assert.equal(Object.isFrozen(pinned.environment),true);
});
test('host-only and configured-default endpoints follow Docker precedence and malformed/nonlocal endpoints refuse',async()=>{
 const host=await pinnedLocalPilotDocker({environment:{DOCKER_HOST:'unix:///var/run/docker.sock'},inspectContext:()=>{throw Error('Host must override configured context');}});
 assert.equal(host.endpoint,'unix:///var/run/docker.sock');
 const calls=[];await pinnedLocalPilotDocker({environment:{},inspectContext:async name=>{calls.push(name);return 'unix:///var/run/docker.sock';}});assert.deepEqual(calls,[null]);
 for(const endpoint of ['tcp://127.0.0.1:2375','ssh://remote.example.test','unix://remote/path','unix:///tmp/docker.sock?remote=true','unix:///tmp/docker.sock\n']){
  await assert.rejects(pinnedLocalPilotDocker({environment:{DOCKER_HOST:endpoint},inspectContext:()=>{throw Error('Unexpected metadata read');}}),/PILOT_RACE_LOCAL_DOCKER_REQUIRED/);
 }
 await assert.rejects(pinnedLocalPilotDocker({environment:{DOCKER_CONTEXT:'--host=ssh://remote'},inspectContext:()=>{throw Error('Unexpected metadata read');}}),/PILOT_RACE_CONTEXT_NAME_DENIED/);
});
