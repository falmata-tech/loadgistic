const collection='/api/capacity/cargo-space-photos';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const photoPath=new RegExp(`^${collection}/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$`,'i');

export function cargoPhotoCollectionPath(vehicleId:string){
 if(!uuid.test(vehicleId))throw new Error('Invalid vehicle');
 return `${collection}?vehicleId=${vehicleId}`;
}

export function cargoPhotoReadPath(contentPath:string){
 if(!photoPath.test(contentPath))throw new Error('Invalid photo');
 return `${contentPath}?format=base64`;
}

export function cargoPhotoUploadCommand(vehicleId:string,source:'CAMERA'|'UPLOAD',capturedAt?:string){
 if(!uuid.test(vehicleId))throw new Error('Invalid vehicle');
 return {vehicleId,source,...source==='CAMERA'&&capturedAt?{cameraCapturedAt:new Date(capturedAt).toISOString()}:{} };
}

export function cargoPhotoApiPathAllowed(path:string){
 if(path===collection)return true;
 if(typeof path!=='string'||/[\u0000-\u001f\u007f\\#]/.test(path))return false;
 const [pathname,query,extra]=path.split('?');
 if(extra!==undefined||!query)return false;
 const params=new URLSearchParams(query);
 if(pathname===collection)return params.size===1&&uuid.test(params.get('vehicleId')||'');
 return photoPath.test(pathname)&&params.size===1&&params.get('format')==='base64';
}
