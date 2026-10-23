import test from 'node:test';
import assert from 'node:assert/strict';
import {supportAttachmentInput,cleanupSupportAttachments} from '../src/lib/support-attachments.js';
const id='00000000-0000-4000-8000-000000000001';
const file=(name='proof.png',type='image/png',size=5)=>({name,type,size,arrayBuffer:async()=>new ArrayBuffer(size)});
test('member attachments require bounded text and a supported nonempty file',()=>{
  assert.deepEqual(supportAttachmentInput(' Hello ',file()),{body:'Hello',mimeType:'image/png',name:'proof.png',size:5});
  for(const body of ['', ' ', 'x'.repeat(2001)])assert.throws(()=>supportAttachmentInput(body,file()),/INVALID_SUPPORT_MESSAGE/);
  assert.throws(()=>supportAttachmentInput('Hello',file('empty.png','image/png',0)),/ATTACHMENT_REQUIRED/);
  assert.throws(()=>supportAttachmentInput('Hello',file('a.png','image/png',4194305)),/FILE_TOO_LARGE/);
  assert.throws(()=>supportAttachmentInput('Hello',file('bad.html','text/html')),/UNSUPPORTED_FILE_TYPE/);
  for(const mime of ['image/jpeg','image/webp','application/pdf'])assert.equal(supportAttachmentInput('Hello',file('file',mime)).mimeType,mime);
});
test('attachment display names remove paths, control characters and bound length',()=>{
  assert.equal(supportAttachmentInput('Hello',file('../../secret\r\n".png')).name,'secret___.png');
  assert.equal(supportAttachmentInput('Hello',file('x'.repeat(200))).name.length,160);
});
function fixture({failRemove=false,failAck=false}={}){
  const calls=[];
  const client={rpc:async(name,args)=>{calls.push([name,args]);return {data:[{id,file_path:'private-reference'}],error:null};},
    from:table=>({delete:()=>({eq:(field,value)=>({eq:async(last,state)=>{calls.push([table,field,value,last,state]);return {error:failAck?{message:'secret'}:null};}})})})};
  const remove=async reference=>{calls.push(['remove',reference]);if(failRemove)throw new Error('private-storage-failure');};
  return {client,remove,calls};
}
test('cleanup claims at most twenty and deletes metadata only after private bytes',async()=>{
  const f=fixture();assert.deepEqual(await cleanupSupportAttachments(999,f),{attempted:1,deleted:1,failed:0});
  assert.deepEqual(f.calls,[['claim_support_attachment_cleanup',{requested_limit:20}],['remove','private-reference'],['support_attachments','id',id,'state','DELETING']]);
});
test('failed object cleanup retains metadata for retry and reports safe counts',async()=>{
  const f=fixture({failRemove:true});assert.deepEqual(await cleanupSupportAttachments(1,f),{attempted:1,deleted:0,failed:1});
  assert.equal(f.calls.length,2);
});
test('failed metadata acknowledgement is retryable without exposing private paths',async()=>{
  const f=fixture({failAck:true});assert.deepEqual(await cleanupSupportAttachments(1,f),{attempted:1,deleted:0,failed:1});
});
