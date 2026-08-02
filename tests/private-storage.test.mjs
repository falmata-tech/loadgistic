import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { readPrivateUpload,removePrivateUpload,storePrivateUpload } from '../src/lib/private-storage.js';

const pngBytes=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0x00]);

function upload(name,type,bytes){
  return {name,type,size:bytes.length,arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
}

test('local private storage validates bytes and uses opaque references',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'loadgistic-storage-'));
  const previousBackend=process.env.PRIVATE_STORAGE_BACKEND;
  const previousRoot=process.env.PRIVATE_UPLOAD_DIR;
  process.env.PRIVATE_STORAGE_BACKEND='local';
  process.env.PRIVATE_UPLOAD_DIR=root;
  try{
    const stored=await storePrivateUpload(upload('../cargo.png','image/png',pngBytes),'capacity');
    assert.match(stored.path,/^local:\/\/capacity\//);
    assert.equal(stored.originalName,'cargo.png');
    assert.deepEqual(await readPrivateUpload(stored.path),pngBytes);
    await removePrivateUpload(stored.path);
    assert.equal(await readPrivateUpload(stored.path),null);
    await assert.rejects(()=>storePrivateUpload(upload('fake.png','image/png',Buffer.from('not an image')),'capacity'),/FILE_CONTENT_MISMATCH/);
  }finally{
    if(previousBackend===undefined)delete process.env.PRIVATE_STORAGE_BACKEND;else process.env.PRIVATE_STORAGE_BACKEND=previousBackend;
    if(previousRoot===undefined)delete process.env.PRIVATE_UPLOAD_DIR;else process.env.PRIVATE_UPLOAD_DIR=previousRoot;
    await fs.rm(root,{recursive:true,force:true});
  }
});
