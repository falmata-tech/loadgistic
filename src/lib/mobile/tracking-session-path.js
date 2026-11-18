const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Exact shared native/preview transport boundary, not data authority. */
export function trackingSessionApiPathAllowed(value,method){
 if(typeof value!=='string'||value.length>2048||/[\u0000-\u0020\u007f\\#%]/.test(value)||!value.startsWith('/api/tracking/'))return false;
 const [path,query,extra]=value.split('?');if(extra!==undefined)return false;
 const params=new URLSearchParams(query||'');if(new Set(params.keys()).size!==params.size)return false;
 const allowed=(methods)=>method===undefined||methods.includes(method);
 if(path==='/api/tracking/requests')return !params.size&&allowed(['POST']);
 if(path==='/api/tracking/access')return params.size===0&&allowed(['POST','DELETE']);
 if(path==='/api/tracking/sessions')return [...params].every(([key,v])=>key==='workspaceId'?uuid.test(v):key==='page'&&/^[1-9]\d{0,3}$/.test(v))&&allowed(params.size?['GET']:['GET','POST']);
 if(path==='/api/tracking/sessions/from-shipment'||path==='/api/tracking/sessions/partner')return !params.size&&allowed(['POST']);
 const match=path.match(/^\/api\/tracking\/sessions\/([^/]+)(?:\/(links|connect|approve|review|sharing|proof\/[^/]+))?$/);if(!match||!uuid.test(match[1]))return false;
 if(!match[2])return [...params].every(([key,v])=>key==='workspaceId'?uuid.test(v):key==='view'&&v==='manager')&&allowed(['GET']);
 if(match[2]==='sharing')return !params.size&&allowed(['GET','POST']);
 if(match[2].startsWith('proof/'))return uuid.test(match[2].slice(6))&&[...params].every(([key,v])=>key==='format'&&v==='base64')&&allowed(['GET']);
 if(match[2]==='links')return [...params].every(([key,v])=>['workspaceId','linkId'].includes(key)&&uuid.test(v))&&allowed(params.has('linkId')?['DELETE']:['POST']);
 return !params.size&&allowed(['POST']);
}
