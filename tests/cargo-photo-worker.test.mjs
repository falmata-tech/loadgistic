import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
 CARGO_PHOTO_CLEANUP_PATH,CARGO_PHOTO_BACKGROUND_PATH,
 CARGO_PHOTO_TIMESTAMP_HEADER,CARGO_PHOTO_SIGNATURE_HEADER,
 cargoPhotoWorkerEnabled,createCargoPhotoSignature,verifyCargoPhotoSignature
} from '../src/lib/cargo-photo-worker-auth.js';
import {config as scheduleConfig,dispatchCargoPhotoCleanup,
 executeCargoPhotoCleanupDispatch} from '../netlify/functions/cargo-photo-cleanup.mjs';
import {config as backgroundConfig,executeCargoPhotoCleanup} from '../netlify/functions/cargo-photo-cleanup-background.mjs';

const origin='https://loadgistic.example';
const now=1_788_200_000_000;
const environment={CONTEXT:'production',NODE_ENV:'production',
 SITE_ID:'c1111111-1111-4111-8111-111111111111',
 LOADGISTIC_CARGO_PHOTO_SITE_ID:'c1111111-1111-4111-8111-111111111111',
 LOADGISTIC_CARGO_PHOTO_SITE_ORIGIN:origin,
 LOADGISTIC_CARGO_PHOTO_CLEANUP_ENABLED:'true',
 LOADGISTIC_CARGO_PHOTO_WORKER_SECRET:'a-separate-production-length-photo-worker-secret',
 SESSION_SECRET:'a-different-production-length-session-secret',URL:origin};
const backgroundUrl=`${origin}${CARGO_PHOTO_BACKGROUND_PATH}`;

function signedRequest(timestamp=now,url=backgroundUrl,env=environment){
 return new Request(url,{method:'POST',headers:{
  [CARGO_PHOTO_TIMESTAMP_HEADER]:String(timestamp),
  [CARGO_PHOTO_SIGNATURE_HEADER]:createCargoPhotoSignature({timestamp:String(timestamp),url:backgroundUrl},env)
 }});
}

test('Cargo photo cleanup runs only for the configured production site and separate worker secret',()=>{
 assert.deepEqual(scheduleConfig,{schedule:'*/15 * * * *'});
 assert.deepEqual(backgroundConfig,{background:true});
 assert.ok(cargoPhotoWorkerEnabled(environment));
 for(const change of [
  {CONTEXT:'deploy-preview'},{NODE_ENV:'development'},
  {LOADGISTIC_CARGO_PHOTO_CLEANUP_ENABLED:'false'},
  {SITE_ID:'c2222222-2222-4222-8222-222222222222'},
  {URL:'https://another.example'},
  {LOADGISTIC_CARGO_PHOTO_WORKER_SECRET:environment.SESSION_SECRET},
  {LOADGISTIC_CARGO_PHOTO_WORKER_SECRET:''}
 ])assert.equal(cargoPhotoWorkerEnabled({...environment,...change}),false);
});

test('Scheduled dispatcher signs only its exact same-site background target',async()=>{
 let captured;
 const result=await dispatchCargoPhotoCleanup({
  invocationUrl:`${origin}${CARGO_PHOTO_CLEANUP_PATH}`,environment,now,
  fetchImpl:async(url,options)=>{captured={url:String(url),options};return new Response(null,{status:202});}
 });
 assert.deepEqual(result,{enabled:true,status:202});
 assert.equal(captured.url,backgroundUrl);
 assert.equal(captured.options.method,'POST');
 assert.equal(captured.options.redirect,'error');
 assert.equal(captured.options.headers[CARGO_PHOTO_TIMESTAMP_HEADER],String(now));
 assert.ok(verifyCargoPhotoSignature({timestamp:String(now),signature:captured.options.headers[CARGO_PHOTO_SIGNATURE_HEADER],url:backgroundUrl},environment,now));
 await assert.rejects(()=>dispatchCargoPhotoCleanup({
  invocationUrl:`${origin}${CARGO_PHOTO_CLEANUP_PATH}?other=true`,environment,now,
  fetchImpl:async()=>{throw new Error('MUST_NOT_FETCH');}
 }),/CARGO_PHOTO_DISPATCH_INVALID/);
 assert.deepEqual(await dispatchCargoPhotoCleanup({invocationUrl:`${origin}${CARGO_PHOTO_CLEANUP_PATH}`,
  environment:{...environment,CONTEXT:'deploy-preview'},fetchImpl:async()=>{throw Error('MUST_NOT_FETCH');}}),{enabled:false});
});

test('Background cleanup denies missing, stale, wrong-path or mismatched-site signatures',async()=>{
 let started=0;
 const serviceFactory=()=>{started++;return {cleanup:async()=>({attempted:0,deleted:0})};};
 for(const request of [
  new Request(backgroundUrl,{method:'POST'}),
  new Request(backgroundUrl,{method:'GET',headers:signedRequest().headers}),
  signedRequest(now-2*60_000-1),
  signedRequest(now,`${origin}/.netlify/functions/other`),
  signedRequest(now,`https://another.example${CARGO_PHOTO_BACKGROUND_PATH}`)
 ])assert.equal((await executeCargoPhotoCleanup(request,{environment,now,serviceFactory})).status,401);
 assert.equal(started,0);
 const disabled=await executeCargoPhotoCleanup(signedRequest(),{
  environment:{...environment,LOADGISTIC_CARGO_PHOTO_CLEANUP_ENABLED:'false'},now,serviceFactory});
 assert.equal(disabled.status,401);assert.equal(started,0);
});

test('Authorized background worker uses one bounded batch and reports sanitized results',async()=>{
 let limit;
 const response=await executeCargoPhotoCleanup(signedRequest(),{environment,now,
  serviceFactory:()=>({cleanup:async requested=>{limit=requested;return {attempted:2,deleted:1};}})});
 assert.equal(response.status,204);assert.equal(await response.text(),'');assert.equal(limit,5);
 const failed=await executeCargoPhotoCleanup(signedRequest(),{environment,now,
  serviceFactory:()=>({cleanup:async()=>{throw new Error('sensitive Storage path must not reach response');}})});
 assert.equal(failed.status,500);assert.equal(await failed.text(),'');
});

test('Disabled dispatcher makes no cleanup request',async()=>{
 const response=await executeCargoPhotoCleanupDispatch(
  new Request(`${origin}${CARGO_PHOTO_CLEANUP_PATH}`),
  {environment:{...environment,LOADGISTIC_CARGO_PHOTO_CLEANUP_ENABLED:'false'},
   fetchImpl:async()=>{throw Error('MUST_NOT_FETCH');}});
 assert.equal(response.status,204);
});
