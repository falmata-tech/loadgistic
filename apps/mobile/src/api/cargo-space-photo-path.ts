import {cargoPhotoApiPathAllowed} from '../../../../src/lib/mobile/cargo-space-photo-path.js';
export {cargoPhotoApiPathAllowed};

const collection='/api/capacity/cargo-space-photos';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function cargoPhotoCollectionPath(vehicleId:string){
 if(!uuid.test(vehicleId))throw new Error('Invalid vehicle');
 return `${collection}?vehicleId=${vehicleId}`;
}

export function cargoPhotoReadPath(contentPath:string){
 return `${cargoPhotoRemovePath(contentPath)}?format=base64`;
}

export function cargoPhotoRemovePath(contentPath:string){
 if(!cargoPhotoApiPathAllowed(contentPath,'DELETE'))throw new Error('Invalid photo');
 return contentPath;
}

export function cargoPhotoUploadCommand(vehicleId:string,source:'CAMERA'|'UPLOAD',capturedAt?:string){
 if(!uuid.test(vehicleId))throw new Error('Invalid vehicle');
 return {vehicleId,source,...source==='CAMERA'&&capturedAt?{cameraCapturedAt:new Date(capturedAt).toISOString()}:{} };
}
