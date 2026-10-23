import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {lstatSync,readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';

export const forbiddenPermissions=['SYSTEM_ALERT_WINDOW','READ_MEDIA_IMAGES','READ_MEDIA_VIDEO','RECORD_AUDIO','CAMERA','READ_EXTERNAL_STORAGE','WRITE_EXTERNAL_STORAGE'].map(name=>'android.permission.'+name);
export const requiredPermissions=['INTERNET','ACCESS_COARSE_LOCATION','ACCESS_FINE_LOCATION','ACCESS_BACKGROUND_LOCATION','FOREGROUND_SERVICE','FOREGROUND_SERVICE_LOCATION','POST_NOTIFICATIONS'].map(name=>'android.permission.'+name);

/** @param {{packageName:string,debuggable:boolean,permissions:string[]}} manifest */
export function verifyReleasePermissions(manifest){
 assert.equal(manifest.packageName,'com.loadgistic.app','LOADGISTIC_PACKAGE_REQUIRED');
 assert.equal(manifest.debuggable,false,'STANDALONE_RELEASE_REQUIRED');
 assert.ok(Array.isArray(manifest.permissions)&&manifest.permissions.every(value=>typeof value==='string'),'PERMISSION_INVENTORY_REQUIRED');
 const actual=new Set(manifest.permissions);
 const forbidden=forbiddenPermissions.filter(name=>actual.has(name));
 const missing=requiredPermissions.filter(name=>!actual.has(name));
 assert.equal(forbidden.length,0,'UNUSED_RELEASE_PERMISSIONS: '+forbidden.join(', '));
 assert.equal(missing.length,0,'MISSING_RELEASE_PERMISSIONS: '+missing.join(', '));
 return {package:manifest.packageName,standalone:true,permissionCount:actual.size,forbiddenPermissionCount:0,requiredPermissionCount:requiredPermissions.length};
}

export function apkManifest(badging){
 const packageName=badging.match(/^package: name='([^']+)'/m)?.[1];
 assert.ok(packageName,'COMPILED_APK_MANIFEST_REQUIRED');
 return {packageName,debuggable:/^application-debuggable(?:\s|$)/m.test(badging),permissions:[...badging.matchAll(/^uses-permission(?:-sdk-\d+)?: name='([^']+)'/gm)].map(match=>match[1])};
}

export async function bundleManifest(xml){
 // Reuse the XML parser already installed by Expo's config tooling; no phone dependency.
 const require=createRequire(import.meta.url),expoRequire=createRequire(require.resolve('@expo/config-plugins'));
 const {Parser}=expoRequire('xml2js');
 const result=await new Parser().parseStringPromise(xml),manifest=result?.manifest;
 assert.ok(manifest?.$?.package&&manifest.application?.length===1,'COMPILED_AAB_MANIFEST_REQUIRED');
 const rows=[...(manifest['uses-permission']||[]),...(manifest['uses-permission-sdk-23']||[])];
 assert.ok(rows.every(row=>typeof row.$?.['android:name']==='string'),'VALID_MANIFEST_PERMISSIONS_REQUIRED');
 const debug=manifest.application[0].$?.['android:debuggable'];
 assert.ok(debug===undefined||debug==='true'||debug==='false','VALID_DEBUGGABLE_FLAG_REQUIRED');
 return {packageName:manifest.$.package,debuggable:debug==='true',permissions:rows.map(row=>row.$['android:name'])};
}

async function main(){
 const [artifact,...args]=process.argv.slice(2),options={};
 assert.ok(artifact&&args.length%2===0,'Use an exact APK with --aapt2 PATH, or AAB with --bundletool JAR --java PATH');
 for(let index=0;index<args.length;index+=2){assert.ok(['--aapt2','--bundletool','--java'].includes(args[index])&&!options[args[index]],'EXPLICIT_UNIQUE_TOOL_REQUIRED');options[args[index]]=resolve(args[index+1]);}
 const path=resolve(artifact),stat=lstatSync(path),kind=extname(path);
 assert.ok(stat.isFile()&&!stat.isSymbolicLink()&&stat.size>0&&stat.size<500*1024*1024,'REGULAR_ANDROID_ARTIFACT_REQUIRED');
 let manifest;
 const run=(tool,argv)=>execFileSync(tool,argv,{encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024,stdio:['ignore','pipe','pipe']});
 if(kind==='.apk'){
  assert.ok(options['--aapt2']&&Object.keys(options).length===1,'EXPLICIT_AAPT2_REQUIRED');
  manifest=apkManifest(run(options['--aapt2'],['dump','badging',path]));
 }else{
  assert.equal(kind,'.aab','APK_OR_AAB_REQUIRED');assert.ok(options['--java']&&options['--bundletool']&&Object.keys(options).length===2,'EXPLICIT_BUNDLETOOL_AND_JAVA_REQUIRED');
  manifest=await bundleManifest(run(options['--java'],['-jar',options['--bundletool'],'dump','manifest','--bundle='+path,'--module=base']));
 }
 const evidence=verifyReleasePermissions(manifest);
 console.log(JSON.stringify({...evidence,kind,bytes:stat.size,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main().catch(error=>{
  // Provider/tool exceptions may contain raw output. Print only a bounded known class.
  const known=String(error.message||'').match(/(?:UNUSED_RELEASE_PERMISSIONS|MISSING_RELEASE_PERMISSIONS|LOADGISTIC_PACKAGE_REQUIRED|STANDALONE_RELEASE_REQUIRED|COMPILED_[A-Z_]+_REQUIRED|VALID_[A-Z_]+_REQUIRED|[A-Z_]+_REQUIRED)/)?.[0];
  console.error(known||'ANDROID_PERMISSION_INSPECTION_FAILED');process.exitCode=1;
 });
}
