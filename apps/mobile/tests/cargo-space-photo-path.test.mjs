import test from 'node:test';
import assert from 'node:assert/strict';
import {cargoPhotoApiPathAllowed,cargoPhotoCollectionPath,cargoPhotoReadPath,cargoPhotoUploadCommand} from '../src/api/cargo-space-photo-path.ts';

const vehicle='aa3b1729-2761-4ff8-9988-2bb7a46741e1';
const photo='1c3a2187-8a94-4ed4-b13c-a41eb4b9be9b';

test('only the scoped cargo-photo collection and private base64 read are allowed',()=>{
 assert.equal(cargoPhotoCollectionPath(vehicle),`/api/capacity/cargo-space-photos?vehicleId=${vehicle}`);
 assert.equal(cargoPhotoReadPath(`/api/capacity/cargo-space-photos/${photo}`),`/api/capacity/cargo-space-photos/${photo}?format=base64`);
 for(const path of ['/api/capacity/cargo-space-photos',cargoPhotoCollectionPath(vehicle),cargoPhotoReadPath(`/api/capacity/cargo-space-photos/${photo}`)])assert.equal(cargoPhotoApiPathAllowed(path),true,path);
 for(const path of ['/api/capacity/other','/api/capacity/cargo-space-photos?vehicleId=not-a-uuid',`/api/capacity/cargo-space-photos?vehicleId=${vehicle}&vehicleId=${vehicle}`,`/api/capacity/cargo-space-photos/${photo}`,`/api/capacity/cargo-space-photos/${photo}?format=raw`,`/api/capacity/cargo-space-photos/${photo}?format=base64&debug=1`,'/api/capacity/cargo-space-photos/../other'])assert.equal(cargoPhotoApiPathAllowed(path),false,path);
 assert.throws(()=>cargoPhotoCollectionPath('../other'),/Invalid vehicle/);
 assert.throws(()=>cargoPhotoReadPath('/api/other/private-file'),/Invalid photo/);
});

test('gallery photos never claim an unverified camera timestamp',()=>{
 const capturedAt='2026-10-26T12:15:00.000Z';
 assert.deepEqual(cargoPhotoUploadCommand(vehicle,'CAMERA',capturedAt),{vehicleId:vehicle,source:'CAMERA',cameraCapturedAt:capturedAt});
 assert.deepEqual(cargoPhotoUploadCommand(vehicle,'UPLOAD',capturedAt),{vehicleId:vehicle,source:'UPLOAD'});
});
