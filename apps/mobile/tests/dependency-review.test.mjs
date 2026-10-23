import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reviewNativeDependencies} from '../scripts/review-runtime-dependencies.mjs';
const lock=JSON.parse(readFileSync(new URL('../package-lock.json',import.meta.url)));
const fixture=()=>({lock:structuredClone(lock),map:{sources:['/node_modules/query-string/index.js','/node_modules/decode-uri-component/index.js'],sourcesContent:["const decodeComponent = require('decode-uri-component').default;",'export default function decodeUriComponent() {}']},audit:{metadata:{vulnerabilities:{critical:0,high:1,moderate:0,total:1}},vulnerabilities:{braces:{via:[{name:'braces',url:'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm'}]}}}});
const withToolingZod=()=>{const input=fixture();input.audit.metadata.vulnerabilities.high=2;input.audit.metadata.vulnerabilities.total=2;input.audit.vulnerabilities.zod={nodes:['node_modules/expo/node_modules/zod'],via:[{name:'zod',url:'https://github.com/advisories/GHSA-mrhx-c7xc-m3w5'}]};input.map.sources.push('/node_modules/zod/v4/core/index.js');return input;};
test('review retains raw tooling audit counts and limits the result to internal builds',()=>{const result=reviewNativeDependencies(fixture());assert.equal(result.eligibleForInternalBuild,true);assert.equal(result.rawAuditCounts.high,1);assert.match(result.limits,/Device verification/);});
test('new or critical findings cannot reuse the reviewed tooling disposition',()=>{const input=fixture();input.audit.vulnerabilities.braces.via[0].url='https://github.com/advisories/new-finding';assert.throws(()=>reviewNativeDependencies(input),/UNREVIEWED/);input.audit.metadata.vulnerabilities.critical=1;assert.throws(()=>reviewNativeDependencies(input),/CRITICAL/);});
test('affected runtime packages, version drift and old decoder fail the gate',()=>{for(const mutation of [i=>i.map.sources.push('/node_modules/braces/index.js'),i=>i.map.sources.push('node_modules/node-forge/lib/rsa.js'),i=>i.lock.packages['node_modules/braces'].version='3.0.2',i=>i.lock.packages['node_modules/decode-uri-component'].version='0.2.2',i=>i.map.sourcesContent[0]="const decodeComponent = require('decode-uri-component');"]){const input=fixture();mutation(input);assert.throws(()=>reviewNativeDependencies(input));}});
test('Expo-only Zod finding requires a patched app runtime and exact excluded tooling path',()=>{
 const eligible=withToolingZod();assert.deepEqual(reviewNativeDependencies(eligible).reviewedToolingAdvisories.includes('https://github.com/advisories/GHSA-mrhx-c7xc-m3w5'),true);
 for(const mutation of [i=>i.audit.vulnerabilities.zod.nodes.push('node_modules/zod'),i=>i.lock.packages['node_modules/zod'].version='3.24.2',i=>i.lock.packages['node_modules/expo/node_modules/zod'].version='3.25.75',i=>i.map.sources.push('/node_modules/expo/node_modules/zod/lib/index.js'),i=>i.map.sources.pop()]){
  const input=withToolingZod();mutation(input);assert.throws(()=>reviewNativeDependencies(input));
 }
});
