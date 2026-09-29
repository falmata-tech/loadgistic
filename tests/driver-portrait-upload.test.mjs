import {test} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {prepareDriverPortrait} from '../src/lib/driver-portrait-image.js';
import {uploadedDriverPortraitUrl} from '../src/lib/driver-portraits.js';
import {createPrivateUploadReference,storePrivateUpload} from '../src/lib/private-storage.js';
import {cleanupDriverPortraitUploads,getDriverPortraitWorkspace} from '../src/lib/driver-portrait-storage.js';

test('Driver photos normalize to bounded JPEG without original metadata',async()=>{
  const original=await sharp({create:{width:700,height:400,channels:3,background:'#008080'}})
    .jpeg().withExif({IFD0:{Artist:'Private portrait author',Copyright:'Private metadata'}}).toBuffer();
  assert.ok((await sharp(original).metadata()).exif);
  const output=await prepareDriverPortrait(new File([original],'private-location-name.jpg',{type:'image/jpeg'}));
  const metadata=await sharp(Buffer.from(await output.arrayBuffer())).metadata();
  assert.equal(output.name,'portrait.jpg');assert.equal(output.type,'image/jpeg');
  assert.equal(metadata.width,512);assert.equal(metadata.height,512);
  assert.equal(metadata.exif,undefined);assert.equal(metadata.icc,undefined);assert.equal(metadata.xmp,undefined);
});
test('Portrait decoding rejects malformed, mismatched, oversized and animated images',async()=>{
  const png=await sharp({create:{width:12,height:12,channels:3,background:'#008080'}}).png().toBuffer();
  const frames=Buffer.concat([Buffer.alloc(8*8*3,0),Buffer.alloc(8*8*3,255)]);
  const animation=await sharp(frames,{raw:{width:8,height:16,pageHeight:8,channels:3}}).webp().toBuffer();
  assert.equal((await sharp(animation).metadata()).pages,2);
  for(const file of [new File(['bad'],'fake.jpg',{type:'image/jpeg'}),new File([png],'wrong.jpg',{type:'image/jpeg'}),
    new File([animation],'moving.webp',{type:'image/webp'}),new File(['<svg/>'],'vector.svg',{type:'image/svg+xml'})]){
    await assert.rejects(()=>prepareDriverPortrait(file),/PORTRAIT_IMAGE_INVALID/);
  }
  await assert.rejects(()=>prepareDriverPortrait({size:4194305,type:'image/png',arrayBuffer:async()=>{throw new Error('MUST_NOT_READ');}}),/FILE_TOO_LARGE/);
  await assert.rejects(()=>prepareDriverPortrait(null),/PORTRAIT_REQUIRED/);
});
test('Portrait URLs and reserved Storage paths exclude actor ids and path injection',async()=>{
  const id='e1111111-1111-1111-1111-111111111111';
  assert.equal(uploadedDriverPortraitUrl(id),`/api/public/driver-portraits/${id}`);
  for(const value of [null,'../secret','supabase://private/key','?id=secret'])assert.equal(uploadedDriverPortraitUrl(value),null);
  const reference=createPrivateUploadReference('driver-portrait','image/jpeg');
  for(const invalid of ['__proto__','constructor','../private'])assert.throws(()=>createPrivateUploadReference(invalid,'image/jpeg'),/INVALID_UPLOAD_PURPOSE/);
  assert.match(reference,/^supabase:\/\/provider-profile\/driver-portrait\/\d{4}-\d{2}-\d{2}\/[a-f0-9-]{36}\.jpg$/);
  const file=new File([Buffer.from([0xff,0xd8,0xff,0x00])],'test.jpg',{type:'image/jpeg'});
  for(const invalid of [reference.replace('provider-profile/','verification/'),reference.replace('.jpg','.pdf'),reference.replace('driver-portrait/','../')]){
    await assert.rejects(()=>storePrivateUpload(file,'driver-portrait',{reference:invalid}),/INVALID_PRIVATE_STORAGE_REFERENCE/);
  }
});
test('Driver portraits reject compressed images beyond the pixel budget',async()=>{
  const compressed=await sharp({create:{width:5001,height:5000,channels:3,background:'#008080'}}).png().toBuffer();
  assert.ok(compressed.length<4194304);
  await assert.rejects(()=>prepareDriverPortrait(new File([compressed],'large-dimensions.png',{type:'image/png'})),/PORTRAIT_IMAGE_INVALID/);
});
test('Portrait cleanup retains failed metadata for retry and reports counts only',async()=>{
  const ids=['e1111111-1111-1111-1111-111111111111','e2222222-2222-2222-2222-222222222222'];let acknowledged=[];
  const client={rpc:async(name,args)=>{assert.equal(name,'claim_driver_portrait_cleanup');assert.equal(args.requested_limit,20);return {data:ids.map((id,i)=>({id,file_path:`private/${i}`})),error:null};},
    from:()=>({delete:()=>({eq:(column,id)=>({eq:async(state,value)=>{assert.equal(column,'id');assert.equal(state,'state');assert.equal(value,'DELETING');acknowledged.push(id);return {error:null};}})})})};
  const result=await cleanupDriverPortraitUploads(500,{client,remove:async path=>{if(path==='private/1')throw new Error('storage offline');}});
  assert.deepEqual(result,{attempted:2,deleted:1,failed:1});assert.deepEqual(acknowledged,[ids[0]]);
  assert.doesNotMatch(JSON.stringify(result),/private|e111/);
});
test('Non-Driver and inactive actors are denied before the external portrait adapter',async()=>{
  for(const actor of [{id:'x',role:'ADMIN',active:true},{id:'x',role:'TRANSPORTER',active:true},{id:'x',role:'DRIVER',active:false}]){
    await assert.rejects(()=>getDriverPortraitWorkspace(actor),/FORBIDDEN/);
  }
});
