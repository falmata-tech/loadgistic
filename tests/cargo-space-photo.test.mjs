import {test} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {prepareCargoSpacePhoto} from '../src/lib/cargo-space-photo/image.js';
import {cargoPhotoService,CargoPhotoError} from '../src/lib/cargo-space-photo/server.js';

const actor='e1111111-1111-4111-8111-111111111111';
const vehicle='e2222222-2222-4222-8222-222222222222';
const workspace='e3333333-3333-4333-8333-333333333333';
const photo='e4444444-4444-4444-8444-444444444444';
const path=`supabase://capacity-photo/capacity/2026-10-26/${photo}.jpg`;
const receivedAt='2026-10-26T12:30:00.000Z';

test('Cargo-space image is re-encoded to bounded JPEG without EXIF or original name',async()=>{
 const original=await sharp({create:{width:2400,height:1600,channels:3,background:'#155eef'}})
  .jpeg().withExif({IFD0:{Artist:'Secret photographer',Copyright:'Private coordinates'}}).toBuffer();
 assert.ok((await sharp(original).metadata()).exif);
 const output=await prepareCargoSpacePhoto(new File([original],'GPS 12.345.jpg',{type:'image/jpeg'}));
 const bytes=Buffer.from(await output.arrayBuffer()),metadata=await sharp(bytes).metadata();
 assert.equal(output.name,'cargo-space.jpg');assert.equal(output.type,'image/jpeg');
 assert.ok(metadata.width<=2000&&metadata.height<=2000);
 assert.equal(metadata.exif,undefined);assert.equal(metadata.icc,undefined);assert.equal(metadata.xmp,undefined);
 assert.ok(output.size<=4194304);
});

test('Cargo-space decoder rejects malformed, animated, mismatched and oversized input',async()=>{
 const png=await sharp({create:{width:12,height:12,channels:3,background:'#155eef'}}).png().toBuffer();
 const frames=Buffer.concat([Buffer.alloc(8*8*3,0),Buffer.alloc(8*8*3,255)]);
 const animated=await sharp(frames,{raw:{width:8,height:16,pageHeight:8,channels:3}}).webp().toBuffer();
 for(const file of [new File(['not a photo'],'fake.jpg',{type:'image/jpeg'}),
  new File([png],'mismatch.jpg',{type:'image/jpeg'}),new File([animated],'moving.webp',{type:'image/webp'}),
  new File(['<svg/>'],'vector.svg',{type:'image/svg+xml'})])
  await assert.rejects(()=>prepareCargoSpacePhoto(file),/PHOTO_IMAGE_INVALID/);
 await assert.rejects(()=>prepareCargoSpacePhoto({size:4194305,type:'image/jpeg',arrayBuffer:async()=>{throw new Error('MUST_NOT_READ');}}),/FILE_TOO_LARGE/);
});

test('Denied driver assignment stops before image decoding or Storage write',async()=>{
 const calls=[];
 const service=cargoPhotoService({client:{rpc:async name=>{calls.push(name);return {data:null,error:null};}},
  prepare:async()=>{throw new Error('MUST_NOT_DECODE');},store:async()=>{throw new Error('MUST_NOT_STORE');}});
 await assert.rejects(()=>service.upload(actor,{vehicleId:vehicle,source:'CAMERA'},new File(['x'],'x.jpg',{type:'image/jpeg'})),
  error=>error instanceof CargoPhotoError&&error.code==='CARGO_PHOTO_FORBIDDEN');
 assert.deepEqual(calls,['cargo_photo_driver_assignment']);
});

test('Driver upload saves sanitized bytes and exposes only receipt metadata',async()=>{
 const calls=[],normalized=new File(['sanitized'],'cargo-space.jpg',{type:'image/jpeg'});
 const service=cargoPhotoService({client:{rpc:async(name,args)=>{calls.push([name,args]);return {error:null,data:
  name==='cargo_photo_driver_assignment'?photo:name==='cargo_photo_reserve'?photo:
  name==='cargo_photo_activate'?{id:photo,vehicleId:vehicle,receivedAt,cameraCapturedAt:null,source:'UPLOAD',storagePath:path}:
  name==='cargo_photo_cleanup_candidates'?[]:null};}},
  prepare:async()=>normalized,reference:()=>path,store:async(file,purpose,options)=>{
   assert.equal(file,normalized);assert.equal(purpose,'capacity');assert.equal(options.reference,path);
  }});
 const result=await service.upload(actor,{vehicleId:vehicle,source:'UPLOAD'},normalized);
 assert.deepEqual(result,{id:photo,vehicleId:vehicle,receivedAt,cameraCapturedAt:null,source:'UPLOAD'});
 assert.ok(!JSON.stringify(result).includes('supabase://'));
 assert.equal(calls[1][0],'cargo_photo_reserve');assert.equal(calls[1][1].target_byte_size,normalized.size);
});

test('Assignment loss after reservation leaves no active photo and cleans only pending bytes',async()=>{
 const removed=[];
 const service=cargoPhotoService({client:{rpc:async name=>({error:name==='cargo_photo_activate'?{message:'CARGO_PHOTO_FORBIDDEN'}:null,
  data:name==='cargo_photo_driver_assignment'?photo:name==='cargo_photo_reserve'?photo:
   name==='cargo_photo_discard_pending'?path:null})},prepare:async()=>new File(['sanitized'],'cargo-space.jpg',{type:'image/jpeg'}),
  reference:()=>path,store:async()=>{},remove:async value=>removed.push(value)});
 await assert.rejects(()=>service.upload(actor,{vehicleId:vehicle,source:'CAMERA',cameraCapturedAt:'2026-10-26T12:00:00Z'},
  new File(['x'],'x.jpg',{type:'image/jpeg'})),/CARGO_PHOTO_FORBIDDEN/);
 assert.deepEqual(removed,[path]);
});

test('Private file download rechecks live grant after Storage read',async()=>{
 let checked=0;
 const service=cargoPhotoService({client:{rpc:async name=>{
  if(name==='cargo_photo_business_file'){
   checked++;return checked===1?{data:{storagePath:path,receivedAt},error:null}:
    {data:null,error:{message:'CARGO_PHOTO_NOT_FOUND'}};
  }
  return {data:null,error:null};
 }},read:async()=>Buffer.from('private bytes')});
 await assert.rejects(()=>service.businessFile(actor,workspace,photo),/CARGO_PHOTO_NOT_FOUND/);
 assert.equal(checked,2);
});

test('Cleanup retries Storage failure without changing its metadata row',async()=>{
 let updated=0;
 const service=cargoPhotoService({client:{rpc:async()=>({data:[{id:photo,storage_path:path}],error:null}),
  from:()=>({update:()=>{updated++;throw new Error('MUST_NOT_UPDATE');}})},
  remove:async()=>{throw new Error('storage unavailable');}});
 assert.deepEqual(await service.cleanup(),{attempted:1,deleted:0});assert.equal(updated,0);
});

test('Cleanup retains the fulfilled request photo ID as a terminal tombstone',async()=>{
 const removed=[],updates=[];
 const chain={error:null,eq(field,value){updates.push([field,value]);return this;}};
 const client={rpc:async()=>({data:[{id:photo,storage_path:path}],error:null}),
  from:table=>{assert.equal(table,'cargo_space_photos');return {
   delete:()=>{throw new Error('Fulfilled request still references this photo');},
   update:values=>{updates.push(values);return chain;}
  };}};
 const service=cargoPhotoService({client,remove:async reference=>{removed.push(reference);}});
 assert.deepEqual(await service.cleanup(1),{attempted:1,deleted:1});
 assert.deepEqual(removed,[path]);
 assert.deepEqual(updates,[{state:'DELETED'},['id',photo],['state','DELETING'],['storage_path',path]]);
});

test('Cleanup retries after a metadata write failure even if the object is already gone',async()=>{
 let attempts=0,storageDeletes=0,missingReads=0;
 const service=cargoPhotoService({client:{rpc:async()=>({data:[{id:photo,storage_path:path}],error:null}),
  from:()=>({update:()=>({eq:()=>({eq:()=>({eq:async()=>({error:++attempts===1?new Error('database unavailable'):null})})})})})},
  remove:async reference=>{assert.equal(reference,path);if(++storageDeletes===2)throw new Error('object missing');},
  read:async reference=>{assert.equal(reference,path);missingReads++;return null;}});
 assert.deepEqual(await service.cleanup(1),{attempted:1,deleted:0});
 assert.deepEqual(await service.cleanup(1),{attempted:1,deleted:1});
 assert.equal(storageDeletes,2);assert.equal(missingReads,1);
});

test('Successful upload and removal do not await photo-object cleanup',async()=>{
 const calls=[];
 const service=cargoPhotoService({client:{rpc:async name=>{
  calls.push(name);
  if(name==='cargo_photo_cleanup_candidates')throw new Error('Slow cleanup must be separate');
  return {error:null,data:name==='cargo_photo_driver_assignment'?photo:name==='cargo_photo_reserve'?photo:
   name==='cargo_photo_activate'?{id:photo,vehicleId:vehicle,receivedAt,source:'UPLOAD'}:
   name==='cargo_photo_mark_delete'?{id:photo,vehicleId:vehicle}:null};
 }},prepare:async()=>new File(['sanitized'],'cargo-space.jpg',{type:'image/jpeg'}),
 reference:()=>path,store:async()=>{}});
 assert.equal((await service.upload(actor,{vehicleId:vehicle,source:'UPLOAD'},new File(['x'],'x.jpg',{type:'image/jpeg'}))).id,photo);
 assert.deepEqual(await service.remove(actor,photo),{id:photo,vehicleId:vehicle,removed:true});
 assert.ok(!calls.includes('cargo_photo_cleanup_candidates'));
});
