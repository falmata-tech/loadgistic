import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const script=path.resolve('scripts/verify-netlify-function-bundles.py');
const server='___netlify-server-handler';
function fixture(change,root,directory=path.join(root,'.netlify/functions')){
 mkdirSync(directory,{recursive:true});
 const manifest=path.join(root,'.netlify/functions-internal',server);mkdirSync(manifest,{recursive:true});
 writeFileSync(path.join(manifest,server+'.json'),JSON.stringify({version:1,config:{nodeBundler:change==='bundler'?'esbuild':'none'}}));
 const files={
  [server+'.mjs']:"import a from './.netlify/dist/run/handlers/server.js';import b from './.netlify/dist/run/handlers/request-context.cjs';import c from './.netlify/dist/run/handlers/tracer.cjs';",
  'run-config.json':JSON.stringify({nextConfig:{distDir:'.next'}}),
  '.next/required-server-files.json':JSON.stringify({appDir:root,relativeAppDir:change==='tracing'?'nested':'',config:{outputFileTracingRoot:root}}),
  '.next/BUILD_ID':'synthetic-build',
  '.netlify/dist/run/handlers/server.js':'export default {};',
  '.netlify/dist/run/handlers/request-context.cjs':'module.exports={};',
  '.netlify/dist/run/handlers/tracer.cjs':'module.exports={};'
 };
 if(change==='missing')delete files['run-config.json'];
 if(change==='import')delete files['.netlify/dist/run/handlers/tracer.cjs'];
 if(change==='private')files['.env.production']='SENTINEL_TOKEN=SENTINEL';
 if(change==='traversal')files['../SENTINEL']='SENTINEL';
 const build=spawnSync('python3',['-c',"import sys,json,zipfile;v=json.load(sys.stdin);z=zipfile.ZipFile(v['path'],'w',zipfile.ZIP_DEFLATED);[z.writestr(k,s) for k,s in v['files'].items()];z.close()"],{input:JSON.stringify({path:path.join(directory,server+'.zip'),files}),encoding:'utf8'});
 assert.equal(build.status,0);
 return directory;
}
function inspect(change){
 const root=mkdtempSync(path.join(tmpdir(),'loadgistic-bundle-SENTINEL-'));
 try{
  const directory=fixture(change,root),result=spawnSync('python3',[script,directory,root],{encoding:'utf8'});
  assert.equal(result.stderr,'');assert.doesNotMatch(result.stdout,/SENTINEL|\.env|\/tmp|nextConfig|appDir/);
  return {status:result.status,value:JSON.parse(result.stdout)};
 }finally{rmSync(root,{recursive:true,force:true});}
}
test('actual deploy-ready ZIP inspection verifies root layout, imports, integrity and digests without extraction',()=>{
 const {status,value}=inspect();assert.equal(status,0);assert.equal(value.passed,true);assert.equal(value.nodeBundlerNone,true);
 assert.equal(value.privateEntries,0);assert.equal(value.bundles.length,1);assert.equal(value.bundles[0].kind,'NEXT_SERVER');
 assert.match(value.bundles[0].sha256,/^[a-f0-9]{64}$/);assert.equal(value.bundles[0].entries,7);
});
test('unsafe packages stop with fixed reasons instead of private archive paths or contents',()=>{
 for(const [change,code]of [['bundler','HANDLER_BUNDLER_CHANGED'],['missing','RUNTIME_FILE_MISSING'],['import','HANDLER_IMPORT_MISSING'],['private','PRIVATE_ENTRY'],['traversal','UNSAFE_ENTRY_PATH'],['tracing','TRACING_ROOT_MISMATCH']]){
  const result=inspect(change);assert.equal(result.status,1);assert.deepEqual(result.value,{passed:false,code});
 }
});
test('missing or corrupt ZIP input fails closed without error text',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'loadgistic-bundle-SENTINEL-'));
 try{
  let result=spawnSync('python3',[script,root,root],{encoding:'utf8'});assert.deepEqual(JSON.parse(result.stdout),{passed:false,code:'BUNDLE_COUNT_INVALID'});
  const directory=fixture(undefined,root);writeFileSync(path.join(directory,server+'.zip'),'SENTINEL');
  result=spawnSync('python3',[script,directory,root],{encoding:'utf8'});assert.deepEqual(JSON.parse(result.stdout),{passed:false,code:'BUNDLE_INSPECTION_FAILED'});assert.equal(result.stderr,'');
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('provider hook runs after bundling and fails the build when verification is unavailable',()=>{
 const {onPostBuild}=require('../netlify/plugins/verify-function-bundles/index.js');const failures=[];
 onPostBuild({constants:{FUNCTIONS_DIST:path.resolve('.local/missing-bundle-SENTINEL')},utils:{build:{failBuild:message=>failures.push(message)}}});
 assert.deepEqual(failures,['NETLIFY_FUNCTION_BUNDLE_CHECK_FAILED BUNDLE_COUNT_INVALID']);
 assert.match(readFileSync('netlify.toml','utf8'),/package = "\.\/netlify\/plugins\/verify-function-bundles"/);
});

test('the provider callback verifies actual ZIP bytes before reporting success',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'loadgistic-bundle-SENTINEL-'));
 try{
  const directory=fixture(undefined,root),plugin=path.resolve('netlify/plugins/verify-function-bundles/index.js');
  const code=`require(${JSON.stringify(plugin)}).onPostBuild({constants:{FUNCTIONS_DIST:${JSON.stringify(directory)}},utils:{build:{failBuild:()=>{throw Error('CHECK_FAILED')}}}})`;
  const result=spawnSync(process.execPath,['--input-type=commonjs','-e',code],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,0);assert.equal(result.stderr,'');assert.match(result.stdout,/^NETLIFY_FUNCTION_BUNDLES_VERIFIED /);
  assert.doesNotMatch(result.stdout,/SENTINEL|nextConfig|appDir/);
 }finally{rmSync(root,{recursive:true,force:true});}
});

test('the explicit provider bundle directory may live outside the source checkout',()=>{
 const root=mkdtempSync(path.join(tmpdir(),'loadgistic-site-SENTINEL-'));
 const output=mkdtempSync(path.join(tmpdir(),'loadgistic-functions-SENTINEL-'));
 try{
  fixture(undefined,root,output);
  const result=spawnSync('python3',[script,output,root],{encoding:'utf8'});
  assert.equal(result.status,0);assert.equal(JSON.parse(result.stdout).passed,true);
  assert.equal(result.stderr,'');assert.doesNotMatch(result.stdout,/SENTINEL/);
 }finally{rmSync(root,{recursive:true,force:true});rmSync(output,{recursive:true,force:true});}
});
