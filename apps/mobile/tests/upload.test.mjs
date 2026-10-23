import test from 'node:test';
import assert from 'node:assert/strict';
import { uploadForm, uploadLimit } from '../src/api/upload.ts';
test('native-compatible multipart preserves actual binary file bytes and command', async () => {
 const bytes = new Uint8Array([137,80,78,71,13,10,26,10]);
 const file = new File([bytes], 'local-demo.png', {type:'image/png'});
 const body = uploadForm({action:'SEND',body:'Photo'}, file);
 const decoded = await new Request('https://example.test/upload', {method:'POST',body}).formData();
 assert.equal(decoded.get('command'),JSON.stringify({action:'SEND',body:'Photo'}));
 assert.equal(decoded.get('file').type,'image/png'); assert.deepEqual(new Uint8Array(await decoded.get('file').arrayBuffer()),bytes);
});
test('rejects legacy URI descriptors, unsupported files and oversize before fetch', () => {
 assert.throws(()=>uploadForm({}, {uri:'file:///example.png',name:'example.png',type:'image/png',size:100}),/supported file/);
 for(const file of [new Blob([],{type:'image/png'}),new Blob(['x'],{type:'text/html'}),new Blob([new Uint8Array(uploadLimit+1)],{type:'image/png'})]) assert.throws(()=>uploadForm({},file),/supported file/);
});
