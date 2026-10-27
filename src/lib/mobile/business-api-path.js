// The native HTTP adapter and loopback Metro proxy share this exact allowlist.
// A customer workspace path is not permission; the authenticated server repeats it.
const uuid='[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
const business=new RegExp(`^/api/business-workspaces(?:/search|/invitations/${uuid}/accept|/${uuid}(?:/documents|/network-visibility|/capacity(?:/(?:search|discovery))?|/tracking(?:/${uuid}(?:/(?:attach|sharing|actions|proof/${uuid}))?)?)?)?$`);
const capacityPhoto=new RegExp(`^/api/business-workspaces/${uuid}/capacity/(?:photos(?:/${uuid})?|photo-requests)$`);
export function businessApiPathAllowed(path){
 if(typeof path!=='string'||!path.startsWith('/')||path.startsWith('//')||/[\u0000-\u001f\u007f\\#]/.test(path))return false;
 try{
  const pathname=decodeURIComponent(path.split('?')[0]);
  if(pathname.includes('\\')||pathname.split('/').some(part=>part==='.'||part==='..'))return false;
  if(capacityPhoto.test(pathname)){
   const query=path.includes('?')?new URLSearchParams(path.slice(path.indexOf('?')+1)):new URLSearchParams();
   const keys=[...query.keys()];
   if(pathname.endsWith('/photos'))return keys.length===1&&keys[0]==='vehicleId'&&new RegExp(`^${uuid}$`).test(query.get('vehicleId')||'');
   if(pathname.endsWith('/photo-requests'))return keys.length===0;
   return keys.length===0||keys.length===1&&keys[0]==='format'&&query.get('format')==='base64';
  }
  return business.test(pathname)||pathname==='/api/business-capacity-shares'||pathname==='/api/business-directory'||pathname==='/api/account-directory'||pathname==='/api/account-connections'||pathname==='/api/account-vehicle-shares';
 }catch{return false;}
}
export function businessApiArrayResponse(path){return businessApiPathAllowed(path)&&path.split('?')[0]==='/api/business-workspaces/search';}
