import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reviewNativeDependencies} from '../scripts/review-runtime-dependencies.mjs';

const lock=JSON.parse(readFileSync(new URL('../package-lock.json',import.meta.url)));
const fixture=()=>({
 lock:structuredClone(lock),
 map:{
  sources:['/node_modules/query-string/index.js','/node_modules/decode-uri-component/index.js','/node_modules/zod/v4/core/index.js'],
  sourcesContent:["const decodeComponent = require('decode-uri-component').default;",'export default function decodeUriComponent() {}','patched Zod v4']
 },
 audit:{
  metadata:{vulnerabilities:{critical:0,high:0,moderate:1,total:1}},
  vulnerabilities:{
   minimatch:{nodes:['node_modules/minimatch'],via:[{name:'minimatch',url:'https://github.com/advisories/GHSA-g3hv-75wg-m249'}]}
  }
 }
});

test('review retains raw tooling audit counts and limits the result to internal builds',()=>{
 const result=reviewNativeDependencies(fixture());
 assert.equal(result.eligibleForInternalBuild,true);
 assert.equal(result.rawAuditCounts.moderate,1);
 assert.match(result.limits,/Device verification/);
});

test('new or critical findings cannot reuse the reviewed tooling disposition',()=>{
 const input=fixture();
 input.audit.vulnerabilities.minimatch.via[0].url='https://github.com/advisories/new-finding';
 assert.throws(()=>reviewNativeDependencies(input),/UNREVIEWED/);
 input.audit.metadata.vulnerabilities.critical=1;
 assert.throws(()=>reviewNativeDependencies(input),/CRITICAL/);
});

test('affected runtime packages, version drift and old decoder fail the gate',()=>{
 for(const mutation of [
  input=>input.map.sources.push('/node_modules/minimatch/index.js'),
  input=>input.map.sources.push('/node_modules/braces/index.js'),
  input=>input.map.sources.push('node_modules/node-forge/lib/rsa.js'),
  input=>input.lock.packages['node_modules/minimatch'].version='0.0.0',
  input=>input.lock.packages['node_modules/decode-uri-component'].version='0.2.2',
  input=>input.map.sourcesContent[0]="const decodeComponent = require('decode-uri-component');"
 ]){
  const input=fixture();
  mutation(input);
  assert.throws(()=>reviewNativeDependencies(input));
 }
});

test('patched app Zod stays required after the Expo tooling copy is removed',()=>{
 for(const mutation of [
  input=>input.lock.packages['node_modules/zod'].version='3.24.2',
  input=>input.map.sources.pop()
 ]){
  const input=fixture();
  mutation(input);
  assert.throws(()=>reviewNativeDependencies(input),/PATCHED_ZOD_NOT_IN_ANDROID_RUNTIME/);
 }
 const stale=fixture();
 stale.audit.metadata.vulnerabilities.total=2;
 stale.audit.vulnerabilities.zod={
  nodes:['node_modules/expo/node_modules/zod'],
  via:[{name:'zod',url:'https://github.com/advisories/GHSA-mrhx-c7xc-m3w5'}]
 };
 assert.throws(()=>reviewNativeDependencies(stale),/UNREVIEWED_DEPENDENCY_FINDING/);
});

test('remaining minimatch finding requires its exact locked tooling path and Android exclusion',()=>{
 const input=fixture();
 assert.equal(reviewNativeDependencies(input).eligibleForInternalBuild,true);
 input.map.sources.push('/node_modules/minimatch/index.js');
 assert.throws(()=>reviewNativeDependencies(input),/VULNERABLE_PACKAGE_IN_ANDROID_RUNTIME/);
 input.map.sources.pop();
 input.audit.vulnerabilities.minimatch.nodes.push('node_modules/glob/node_modules/minimatch');
 assert.throws(()=>reviewNativeDependencies(input),/REVIEWED_TOOLING_VERSION_DRIFT/);
 for(const [name,url] of [['deepmerge','GHSA-gcqx-w48m-w2h4'],['glob','GHSA-3g3m-2fjr-6pw4']]){
  const stale=fixture();
  stale.audit.metadata.vulnerabilities.total=2;
  stale.audit.vulnerabilities[name]={
   nodes:['node_modules/'+name],
   via:[{name,url:'https://github.com/advisories/'+url}]
  };
  assert.throws(()=>reviewNativeDependencies(stale),/UNREVIEWED_DEPENDENCY_FINDING/,name);
 }
});
