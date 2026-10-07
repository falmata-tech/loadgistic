import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../',import.meta.url));
const reviewed=new Map([
 ['https://github.com/advisories/GHSA-vfj7-8cjw-p6xm',{name:'braces',version:'3.0.3'}],
 ['https://github.com/advisories/GHSA-86w9-cpqp-85rv',{name:'node-forge',version:'1.4.0'}],
 ['https://github.com/advisories/GHSA-w5hq-g745-h8pq',{name:'uuid',version:'7.0.3'}],
]);
// This permits only the reviewed internal-build tooling paths. The raw audit
// remains visible. Unknown findings or packages in the app bundle fail closed.
export function reviewNativeDependencies({audit,lock,map}){
 if(lock.name!=='@loadgistic/mobile'||!lock.packages||!Array.isArray(map.sources)||!Array.isArray(map.sourcesContent))throw Error('INVALID_LOADGISTIC_BUILD_EVIDENCE');
 if(audit.metadata?.vulnerabilities?.critical)throw Error('CRITICAL_DEPENDENCY_FINDING');
 if(!audit.vulnerabilities||audit.metadata?.vulnerabilities?.total!==Object.keys(audit.vulnerabilities).length)throw Error('INVALID_AUDIT_EVIDENCE');
 const findings=new Map();
 for(const vulnerability of Object.values(audit.vulnerabilities||{}))for(const item of vulnerability.via||[]){
  if(typeof item==='string')continue;
  const expected=reviewed.get(item.url);
  if(!expected||item.name!==expected.name)throw Error('UNREVIEWED_DEPENDENCY_FINDING');
  findings.set(item.url,item);
 }
 if(Object.keys(audit.vulnerabilities).length&&!findings.size)throw Error('UNREVIEWED_DEPENDENCY_FINDING');
 for(const item of findings.values()){
  const expected=reviewed.get(item.url),versions=Object.entries(lock.packages).filter(([name])=>name.endsWith('/node_modules/'+item.name)||name==='node_modules/'+item.name);
  if(!versions.length||versions.some(([,value])=>value.version!==expected.version))throw Error('REVIEWED_TOOLING_VERSION_DRIFT');
  if(map.sources.some(name=>('/'+name.replaceAll('\\','/').replace(/^\/+/, '')).includes('/node_modules/'+item.name+'/')))throw Error('VULNERABLE_PACKAGE_IN_ANDROID_RUNTIME');
 }
 if(map.sources.some(name=>/\/node_modules\/(?:braces|node-forge|uuid)\//.test(('/'+name.replaceAll('\\','/').replace(/^\/+/, '')))))throw Error('VULNERABLE_PACKAGE_IN_ANDROID_RUNTIME');
 if(lock.packages['node_modules/decode-uri-component']?.version!=='0.5.0')throw Error('PATCHED_DECODER_REQUIRED');
 const consumer=map.sources.findIndex(name=>name.replaceAll('\\','/').endsWith('/node_modules/query-string/index.js'));
 if(consumer<0||!map.sourcesContent[consumer]?.includes("require('decode-uri-component').default"))throw Error('PATCHED_CONSUMER_NOT_IN_BUNDLE');
 return {eligibleForInternalBuild:true,rawAuditCounts:audit.metadata.vulnerabilities,reviewedToolingAdvisories:[...findings.keys()],runtimeDecoder:'0.5.0',limits:'Internal build from locked reviewed sources; localhost development only. Device verification and owner review still required before broader distribution.'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),read=flag=>{const i=args.indexOf(flag);if(i<0||!args[i+1])throw Error('AUDIT_AND_COMPILED_MAP_REQUIRED');return JSON.parse(fs.readFileSync(args[i+1],'utf8'));};
 const report=reviewNativeDependencies({audit:read('--audit'),map:read('--map'),lock:JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8'))});
 report.lockSha256=createHash('sha256').update(fs.readFileSync(path.join(root,'package-lock.json'))).digest('hex');
 console.log(JSON.stringify(report,null,2));
}
