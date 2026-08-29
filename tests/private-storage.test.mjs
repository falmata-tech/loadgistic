import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { privateStorageStatus,readPrivateUpload,storePrivateUpload } from '../src/lib/private-storage.js';

const pngBytes=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0x00]);

function upload(name,type,bytes){
  return {name,type,size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
}

test('private storage is Supabase-only and validates bytes before managed writes',async()=>{
  const previousUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousService=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const previousScanner=process.env.UPLOAD_SCANNER_BACKEND;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.UPLOAD_SCANNER_BACKEND='local';
  try{
    assert.deepEqual(privateStorageStatus({UPLOAD_SCANNER_BACKEND:'local'}),{
      backend:'supabase',durable:true,configured:false,
      scannerBackend:'local',scannerConfigured:true,scannerProductionSafe:false
    });
    await assert.rejects(()=>storePrivateUpload(upload('fake.png','image/png',Buffer.from('not an image')),'capacity'),/FILE_CONTENT_MISMATCH/);
    await assert.rejects(()=>storePrivateUpload(upload('../cargo.png','image/png',pngBytes),'capacity'),/SUPABASE_NOT_CONFIGURED/);
    await assert.rejects(()=>readPrivateUpload('local://capacity/unsafe.png'),/INVALID_PRIVATE_STORAGE_REFERENCE/);
    const source=fs.readFileSync(path.join(process.cwd(),'src/lib/private-storage.js'),'utf8');
    assert.doesNotMatch(source,/node:fs|local:\/\/|PRIVATE_STORAGE_BACKEND|PRIVATE_UPLOAD_DIR/);
  }finally{
    if(previousUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=previousUrl;
    if(previousService===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=previousService;
    if(previousScanner===undefined)delete process.env.UPLOAD_SCANNER_BACKEND;else process.env.UPLOAD_SCANNER_BACKEND=previousScanner;
  }
});
