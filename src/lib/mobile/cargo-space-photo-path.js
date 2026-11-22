const collection='/api/capacity/cargo-space-photos';
const uuid='[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
const vehicleId=new RegExp(`^${uuid}$`);
const photoPath=new RegExp(`^${collection}/${uuid}$`);

/** Exact shared mobile and local preview transport boundary. */
export function cargoPhotoApiPathAllowed(value,method){
 if(typeof value!=='string'||/[\u0000-\u001f\u007f\\#]/.test(value))return false;
 if(method==='DELETE')return photoPath.test(value);
 if(value===collection)return method===undefined||method==='POST';
 if(method!==undefined&&method!=='GET')return false;
 const [path,query,extra]=value.split('?');
 if(extra!==undefined||!query)return false;
 const params=new URLSearchParams(query);
 if(params.size!==1)return false;
 if(path===collection)return vehicleId.test(params.get('vehicleId')||'');
 return photoPath.test(path)&&params.get('format')==='base64';
}
