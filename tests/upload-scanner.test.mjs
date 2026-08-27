import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {scanPrivateUpload,uploadScannerStatus} from '../src/lib/upload-scanner.js';

const root=process.cwd();
const png=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0x00]);

test('production scanning requires the managed adapter while local testing stays explicit',()=>{
  assert.deepEqual(uploadScannerStatus({NODE_ENV:'development',UPLOAD_SCANNER_BACKEND:'local'}),{
    backend:'local',configured:true,productionSafe:false
  });
  assert.deepEqual(uploadScannerStatus({NODE_ENV:'production',UPLOAD_SCANNER_BACKEND:'local'}),{
    backend:'local',configured:false,productionSafe:false
  });
  assert.deepEqual(uploadScannerStatus({NODE_ENV:'production',UPLOAD_SCANNER_BACKEND:'cloudmersive',CLOUDMERSIVE_API_KEY:'private'}),{
    backend:'cloudmersive',configured:true,productionSafe:true
  });
});

test('managed scan sends neutral metadata and accepts only an explicit clean verdict',async()=>{
  let request;
  const environment={UPLOAD_SCANNER_BACKEND:'cloudmersive',CLOUDMERSIVE_API_KEY:'private-key'};
  const clean=await scanPrivateUpload(png,'image/png',{
    environment,fetchImpl:async(url,options)=>{
      request={url,options};return {ok:true,json:async()=>({CleanResult:true,FoundViruses:[]})};
    }
  });
  assert.deepEqual(clean,{clean:true,provider:'cloudmersive'});
  assert.equal(request.url,'https://api.cloudmersive.com/virus/scan/file/advanced');
  assert.equal(request.options.headers.Apikey,'private-key');
  assert.equal(request.options.headers.fileName,'upload.png');
  assert.equal(request.options.redirect,'error');
  assert.equal(request.options.cache,'no-store');
  for(const header of [
    'allowExecutables','allowInvalidFiles','allowScripts','allowPasswordProtectedFiles',
    'allowMacros','allowXmlExternalEntities','allowInsecureDeserialization','allowHtml',
    'allowUnsafeArchives','allowOleEmbeddedObject','allowUnwantedAction'
  ])assert.equal(request.options.headers[header],'false');
  assert.equal(request.options.headers.restrictFileTypes,'.jpg,.jpeg,.png,.webp,.pdf');
  assert.equal(request.options.headers.options,'blockInvalidUris');
  assert.ok(request.options.body instanceof FormData);
  assert.equal(request.options.body.get('inputFile').name,'upload.png');
  assert.doesNotMatch(JSON.stringify(request.options.headers),/cargo|identity|driver/i);

  await assert.rejects(()=>scanPrivateUpload(png,'image/png',{
    environment,fetchImpl:async()=>({ok:true,json:async()=>({CleanResult:false,FoundViruses:[{VirusName:'private-detail'}]})})
  }),/UPLOAD_REJECTED/);
  await assert.rejects(()=>scanPrivateUpload(png,'image/png',{
    environment,fetchImpl:async()=>({ok:false,status:429,json:async()=>({error:'quota'})})
  }),/UPLOAD_SCANNER_UNAVAILABLE/);
  await assert.rejects(()=>scanPrivateUpload(png,'image/png',{
    environment,fetchImpl:async()=>{throw new Error('network detail');}
  }),/UPLOAD_SCANNER_UNAVAILABLE/);
  await assert.rejects(()=>scanPrivateUpload(png,'image/png',{
    environment,fetchImpl:async()=>({ok:true,json:async()=>({FoundViruses:[]})})
  }),/UPLOAD_SCANNER_UNAVAILABLE/);
});

test('quarantine migration creates one private server-only bucket',()=>{
  const migration=fs.readFileSync(path.join(root,'supabase/migrations/048_private_upload_quarantine.sql'),'utf8');
  assert.match(migration,/private-upload-quarantine/);
  assert.match(migration,/false,\s*10485760/);
  assert.doesNotMatch(migration,/create policy|to anon|to authenticated/i);
});
