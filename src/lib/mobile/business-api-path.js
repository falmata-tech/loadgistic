// The native HTTP adapter and loopback Metro proxy share this exact allowlist.
// A customer workspace path is not permission; the authenticated server repeats it.
const uuid='[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
const business=new RegExp(`^/api/business-workspaces(?:/search|/invitations/${uuid}/accept|/${uuid}(?:/documents|/network-visibility|/capacity(?:/(?:search|discovery))?|/tracking(?:/${uuid}(?:/attach)?)?)?)?$`);
export function businessApiPathAllowed(path){
 if(typeof path!=='string'||!path.startsWith('/')||path.startsWith('//')||/[\u0000-\u001f\u007f\\#]/.test(path))return false;
 try{
  const pathname=decodeURIComponent(path.split('?')[0]);
  if(pathname.includes('\\')||pathname.split('/').some(part=>part==='.'||part==='..'))return false;
  return business.test(pathname)||pathname==='/api/business-capacity-shares'||pathname==='/api/business-directory'||pathname==='/api/account-directory'||pathname==='/api/account-connections'||pathname==='/api/account-vehicle-shares';
 }catch{return false;}
}
export function businessApiArrayResponse(path){return businessApiPathAllowed(path)&&path.split('?')[0]==='/api/business-workspaces/search';}
