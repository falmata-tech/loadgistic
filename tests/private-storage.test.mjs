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
  const previousScanner=process.env.UPLOAD_SCANNER_BACKEND;
  process.env.PRIVATE_STORAGE_BACKEND='local';
  process.env.PRIVATE_UPLOAD_DIR=root;
  process.env.UPLOAD_SCANNER_BACKEND='local';
  try{
    const stored=await storePrivateUpload(upload('../cargo.png','image/png',pngBytes),'capacity');
    assert.match(stored.path,/^local:\/\/capacity\//);
    assert.equal(stored.originalName,'cargo.png');
    assert.deepEqual(await readPrivateUpload(stored.path),pngBytes);
    await removePrivateUpload(stored.path);
    assert.equal(await readPrivateUpload(stored.path),null);
    const quarantineEntries=await fs.readdir(path.join(root,'quarantine'),{recursive:true,withFileTypes:true});
    assert.equal(quarantineEntries.some(entry=>entry.isFile()),false);
    const eicarPdf=Buffer.from(`%PDF-1.4\nX5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*`,'ascii');
    await assert.rejects(()=>storePrivateUpload(upload('unsafe.pdf','application/pdf',eicarPdf),'verification'),/UPLOAD_REJECTED/);
    assert.equal((await fs.readdir(path.join(root,'quarantine'),{recursive:true,withFileTypes:true})).some(entry=>entry.isFile()),false);
    await assert.rejects(()=>readPrivateUpload('local://quarantine/incoming/unsafe.pdf'),/INVALID_PRIVATE_STORAGE_REFERENCE/);
    await assert.rejects(()=>storePrivateUpload(upload('fake.png','image/png',Buffer.from('not an image')),'capacity'),/FILE_CONTENT_MISMATCH/);
  }finally{
    if(previousBackend===undefined)delete process.env.PRIVATE_STORAGE_BACKEND;else process.env.PRIVATE_STORAGE_BACKEND=previousBackend;
    if(previousRoot===undefined)delete process.env.PRIVATE_UPLOAD_DIR;else process.env.PRIVATE_UPLOAD_DIR=previousRoot;
    if(previousScanner===undefined)delete process.env.UPLOAD_SCANNER_BACKEND;else process.env.UPLOAD_SCANNER_BACKEND=previousScanner;
    await fs.rm(root,{recursive:true,force:true});
  }
});
