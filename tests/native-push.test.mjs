import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync,mkdtempSync,writeFileSync,rmSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {nativePushCommand,nativePushMessage,nativePushDestination,nativePushOutcome} from '../src/lib/native-push-policy.js';
import {processNativePushBatch} from '../src/lib/native-push-worker.js';
import {expoPushProvider} from '../src/lib/native-push-expo.js';
const context=()=>({id:randomUUID(),kind:'SUPPORT',sourceId:randomUUID(),event:'MESSAGE',state:'SENDING',token:'ExpoPushToken[synthetic-token-only]',locale:'en',ticketId:null});
test('installation commands reject forged authority and browser push payload injection',()=>{
 const good={action:'REGISTER',installationId:randomUUID(),secret:'a'.repeat(64),token:'ExpoPushToken[synthetic-token-only]',locale:'am'};
 assert.ok(nativePushCommand.safeParse(good).success);
 for(const changes of [{actorId:randomUUID()},{expiresAt:'2099-01-01'},{projectId:'other-project'},{body:'Sensitive text'},{token:'https://attacker.invalid'},{locale:'xx'},{secret:'short'}])assert.equal(nativePushCommand.safeParse({...good,...changes}).success,false);
});
test('system payload is generic and whitelisted; destinations cannot contain external/staff URLs',()=>{
 const row=context(),body=nativePushMessage({...row,message:'Sensitive text',email:'private@example.invalid',proof:'private'});
 assert.equal(body.body,'New unread message');assert.equal(body.tag,row.id);assert.equal(body.collapseId,row.id);
 assert.equal(JSON.stringify(body).includes('Sensitive text'),false);assert.equal(JSON.stringify(body).includes('private@example'),false);
 assert.deepEqual(nativePushDestination(body.data),{pathname:'/support-chat',params:{id:row.sourceId}});
 for(const changes of [{url:'https://attacker.invalid'},{kind:'ADMIN'},{sourceId:'../../admin'},{event:'APPROVED'}])assert.equal(nativePushDestination({...body.data,...changes}),null);
 assert.equal(nativePushMessage({...row,kind:'HANDOVER',event:'APPROVED'},text=>'Translated '+text).body,'Translated Unloading approved · Tracking completed');
});
test('Expo results preserve invalid-token/config outcomes without returning raw provider messages',()=>{
 for(const code of ['DeviceNotRegistered','InvalidCredentials','MessageTooBig','MessageRateExceeded'])assert.deepEqual(nativePushOutcome({status:'error',message:'secret',details:{error:code}}),{code});
 assert.deepEqual(nativePushOutcome({status:'ok',id:'fixture-ticket'}),{code:'ACCEPTED',ticketId:'fixture-ticket'});
 assert.deepEqual(nativePushOutcome(undefined,true),{code:'NO_RECEIPT'});
 assert.deepEqual(nativePushOutcome({status:'ok'},true),{code:'DELIVERED'});
 assert.deepEqual(nativePushOutcome({status:'error',details:{error:'secret'}}),{code:'PROVIDER_REJECTED'});
});
test('worker rechecks each claim, sends only live authority and records separate receipts',async()=>{
 const send=context(),receipt={...context(),state:'CHECKING',ticketId:'fixture-ticket'},cancel=context(),finished=[];
 const stats=await processNativePushBatch({workerId:randomUUID(),store:{claim:async(_id,count)=>{assert.equal(count,40);return [send,receipt,cancel];},context:async id=>id===cancel.id?null:id===send.id?send:receipt,finish:async(id,_lease,result)=>{finished.push({id,result});return true;}},provider:{send:async messages=>{assert.equal(messages.length,1);assert.equal(messages[0].to,send.token);return [{status:'ok',id:'new-ticket'}];},receipts:async ids=>{assert.deepEqual(ids,['fixture-ticket']);return {'fixture-ticket':{status:'ok'}};}}});
 assert.deepEqual(stats,{claimed:3,sent:1,receipts:1,cancelled:1,failed:0});assert.equal(finished.length,2);
});
test('outage retries intent while source chat is untouched; one bad store result does not send it',async()=>{
 const first=context(),bad=context(),saved=[];let calls=0;
 const stats=await processNativePushBatch({workerId:randomUUID(),store:{claim:async()=>[first,bad],context:async id=>{if(id===bad.id)throw Error('unavailable');return first;},finish:async(_id,_lease,result)=>{saved.push(result);return true;}},provider:{send:async()=>{calls++;throw Error('network');},receipts:async()=>{throw Error('must not call');}}});
 assert.equal(calls,1);assert.deepEqual(saved,[{code:'RETRY'}]);assert.equal(stats.failed,1);
});
test('a lost lease never counts an accepted ticket as a saved send',async()=>{
 const row=context(),stats=await processNativePushBatch({workerId:randomUUID(),store:{claim:async()=>[row],context:async()=>row,finish:async()=>false},provider:{send:async()=>[{status:'ok',id:'ticket'}],receipts:async()=>({})}});
 assert.deepEqual(stats,{claimed:1,sent:0,receipts:0,cancelled:1,failed:0});
});
test('every generic event and phone control is covered in all native languages',()=>{
 const labels=['Notifications for your chats and Tracking.','Phone notifications','Phone notifications on','Phone notifications blocked','Connecting phone notifications…','Enable phone notifications','Turn off phone notifications','Receive chat and Tracking updates even when the app is closed.','Allow notifications in your phone’s app settings.','Start a chat or sign in to enable phone notifications.','Phone notifications need the latest Android app and a connection.','Receive chat replies and unloading approval on your phone.','Phone delivery is being set up. In-app updates still work.','Phone alerts could not connect. In-app updates still work.','Could not confirm phone alerts.','This update is no longer available to you.','Could not open this update. Reconnect and try again.'];
 for(const event of ['MESSAGE','ASSIGNED','JOINED','ENDED','RESOLVED','APPROVED'])labels.push(nativePushMessage({...context(),event,kind:event==='APPROVED'?'HANDOVER':'SUPPORT'}).body);
 for(const locale of ['am','om','so','ti']){const catalog=JSON.parse(readFileSync(new URL('../src/lib/i18n/messages/'+locale+'.json',import.meta.url),'utf8'));for(const label of labels)assert.ok(typeof catalog[label]==='string'&&catalog[label].trim()&&catalog[label]!==label,locale+' missing fixed phone label');}
});
test('native config fails closed for another Firebase project or embedded private credentials',()=>{
 const source=readFileSync(new URL('../apps/mobile/app.config.js',import.meta.url),'utf8');
 const config={android:{package:'com.loadgistic.app'},extra:{eas:{projectId:'a2d7e0a9-2fe4-4188-804e-40d8c3486ac7'}}};
 const good={project_info:{project_id:'loadgistic-f082a',project_number:'59430603227'},client:[{client_info:{android_client_info:{package_name:'com.loadgistic.app'}}}]};
 const run=value=>{const module={exports:{}};vm.runInNewContext(source,{module,__dirname:'/loadgistic/apps/mobile',require:name=>name==='node:fs'?{existsSync:()=>value!==null,readFileSync:()=>JSON.stringify(value)}:createRequire(import.meta.url)(name)});return module.exports({config});};
 assert.equal(run(good).extra.nativePushConfigured,true);assert.equal(run(null).extra.nativePushConfigured,false);
 for(const value of [{...good,project_info:{...good.project_info,project_id:'other-project'}},{...good,project_info:{...good.project_info,project_number:'1'}},{...good,client:[]},{...good,private_key:'synthetic-private-field'},{...good,extra:{credentials:{client_email:'synthetic-private-field'}}}])assert.throws(()=>run(value),/LOADGISTIC_FIREBASE_CONFIG_MISMATCH/);
});
test('EAS archive excludes private Firebase JSON but includes the Android public config',()=>{
 // Exercise gitignore semantics against just the EAS file, never nested .gitignore.
 const base=fileURLToPath(new URL('../.local/',import.meta.url));mkdirSync(base,{recursive:true});const fixture=mkdtempSync(path.join(base,'push-archive-fixture-'));
 const files=['apps/mobile/google-services.json','apps/mobile/loadgistic-f082a-firebase-adminsdk-synthetic.json','apps/mobile/credentials/service-account.json','apps/mobile/credentials/service_account_key.json','apps/mobile/credentials.json','.local/credential-backup.json'];
 try{execFileSync('git',['-c','init.templateDir=','init','-q'],{cwd:fixture});writeFileSync(path.join(fixture,'.gitignore'),readFileSync(new URL('../.easignore',import.meta.url)));
  const ignored=execFileSync('git',['-c','core.excludesFile=','check-ignore','--no-index','--stdin','-z'],{cwd:fixture,input:files.join('\0')+'\0'}).toString().split('\0');
  assert.equal(ignored.includes(files[0]),false);for(const file of files.slice(1))assert.equal(ignored.includes(file),true);
 }finally{rmSync(fixture,{recursive:true,force:true});}
});
test('HTTP adapter uses only fixed endpoints, bounds batches/responses and never reflects errors',async()=>{
 const calls=[],adapter=expoPushProvider({fetcher:async(url,request)=>{calls.push({url,body:JSON.parse(request.body)});return Response.json(url.endsWith('/send')?{data:[{status:'ok',id:'ticket'}]}:{data:{ticket:{status:'ok'}}});}});
 await adapter.send([nativePushMessage(context())]);await adapter.receipts(['ticket']);assert.deepEqual(calls.map(call=>call.url),['https://exp.host/--/api/v2/push/send','https://exp.host/--/api/v2/push/getReceipts']);
 await assert.rejects(adapter.send(Array(41).fill({})),/INVALID_PUSH_BATCH/);await assert.rejects(adapter.receipts(['secret\nvalue']),/INVALID_PUSH_BATCH/);
 await assert.rejects(expoPushProvider({fetcher:async()=>new Response('Sensitive response',{status:503})}).send([{}]),/PUSH_PROVIDER_UNAVAILABLE/);
 await assert.rejects(expoPushProvider({fetcher:async()=>new Response('x'.repeat(65537))}).send([{}]),/PUSH_PROVIDER_UNAVAILABLE/);
});
