import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyNetlifyProductionSource} from './promote-netlify-production.mjs';

// Exact reviewed public SDK bytes and mailbox identifiers only. No values or
// production credentials belong in this policy or its output. BASE-DEP-001 / NR-75.
export const scanExceptionPolicy=Object.freeze({
 firebasePath:'apps/mobile/google-services.json',
 firebaseSha256:'6903e064ef59a96775faf396eb13bef50ab344d41ab58607caa6951ffd210d53',
 omitKeys:'LOADGISTIC_SMTP_USER,LOADGISTIC_EMAIL_REPLY_TO',
 mailboxSha256:Object.freeze({
  LOADGISTIC_SMTP_USER:'c39b924d0a3b573fe0783ac5f870a94cfdb2e5f00932ae8d10c3001e30ee0529',
  LOADGISTIC_EMAIL_REPLY_TO:'a4efb892a5af4003986edc189640789559d060b29a2adec9255855441d2faf3a'
 })
});
const digest=value=>createHash('sha256').update(value).digest('hex');
export function inspectNetlifyScanExceptions({firebaseBytes,environment={}}){
 if(environment.NETLIFY==='true'&&!['production','deploy-preview','branch-deploy','preview-server','dev'].includes(environment.CONTEXT))throw Error('NETLIFY_PRODUCTION_SOURCE_REJECTED');
 if(environment.NETLIFY==='true'&&environment.CONTEXT==='production'
  &&(environment.BRANCH!=='production'||!/^[a-f0-9]{40}$/.test(environment.COMMIT_REF||'')))throw Error('NETLIFY_PRODUCTION_SOURCE_REJECTED');
 for(const key of ['SECRETS_SCAN_ENABLED','SECRETS_SCAN_SMART_DETECTION_ENABLED']){
  if(environment[key]!==undefined&&environment[key]!=='true')throw Error('NETLIFY_SCAN_POLICY_REJECTED');
 }
 for(const [key,expected] of Object.entries({SECRETS_SCAN_OMIT_KEYS:scanExceptionPolicy.omitKeys,SECRETS_SCAN_OMIT_PATHS:scanExceptionPolicy.firebasePath})){
  if((environment.NETLIFY==='true'||environment[key]!==undefined)&&environment[key]!==expected)throw Error('NETLIFY_SCAN_POLICY_REJECTED');
 }
 if(!Buffer.isBuffer(firebaseBytes)||firebaseBytes.length>16384||digest(firebaseBytes)!==scanExceptionPolicy.firebaseSha256)throw Error('NETLIFY_CLIENT_CONFIG_REVIEW_REQUIRED');
 let reviewedMailboxFields=0;
 for(const [key,expected] of Object.entries(scanExceptionPolicy.mailboxSha256)){
  if(environment[key]===undefined)continue; // Production-only values stay absent from previews.
  if(typeof environment[key]!=='string'||environment[key].length>320||digest(environment[key])!==expected)throw Error('NETLIFY_MAILBOX_REVIEW_REQUIRED');
  reviewedMailboxFields++;
 }
 return {reviewedClientFiles:1,reviewedMailboxFields};
}
async function main(){
 try{
  if(process.argv.length!==2)throw Error('NETLIFY_SCAN_ARGUMENTS_REJECTED');
  const root=fileURLToPath(new URL('..',import.meta.url));
  const result=inspectNetlifyScanExceptions({firebaseBytes:readFileSync(path.join(root,scanExceptionPolicy.firebasePath)),environment:process.env});
  if(process.env.NETLIFY==='true'&&process.env.CONTEXT==='production'){
   const qualification=await verifyNetlifyProductionSource({sha:process.env.COMMIT_REF});
   process.stdout.write(`NETLIFY_PRODUCTION_SOURCE_VERIFIED sha=${qualification.sha} jobs=${qualification.jobs}\n`);
  }
  process.stdout.write(`NETLIFY_SCAN_REVIEW_OK client_files=${result.reviewedClientFiles} mailbox_fields=${result.reviewedMailboxFields}\n`);
 }catch(error){
  const code=error?.message,suffix=Number.isInteger(error?.httpStatus)&&error.httpStatus>=100&&error.httpStatus<=599?` http_status=${error.httpStatus}`:'';
  process.stderr.write(/^NETLIFY_(?:SCAN_POLICY_REJECTED|CLIENT_CONFIG_REVIEW_REQUIRED|MAILBOX_REVIEW_REQUIRED|SCAN_ARGUMENTS_REJECTED|PRODUCTION_SOURCE_REJECTED|DELIVERY_[A-Z_]+)$/.test(code)?`${code}${suffix}\n`:'NETLIFY_SCAN_REVIEW_FAILED\n');
  process.exitCode=1;
 }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
