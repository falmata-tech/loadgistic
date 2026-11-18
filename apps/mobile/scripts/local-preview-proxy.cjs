const http = require('node:http');
const {trackingSessionApiPathAllowed}=require('../../../src/lib/mobile/tracking-session-path.js');
const {createReadStream}=require('node:fs');
const path=require('node:path');
const {businessApiPathAllowed}=require('../../../src/lib/mobile/business-api-path.js');
const photoCollection='/api/capacity/cargo-space-photos';
const uuid='[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
const photoRead=new RegExp(`^${photoCollection}/${uuid}$`);
const exactId=new RegExp(`^${uuid}$`);
function providerPhotoPathAllowed(value){
 if(typeof value!=='string'||/[\u0000-\u001f\u007f\\#]/.test(value))return false;
 const [pathname,query,extra]=value.split('?');
 if(extra!==undefined)return false;
 if(pathname===photoCollection){
  if(query===undefined)return true;
  const params=new URLSearchParams(query);
  return params.size===1&&exactId.test(params.get('vehicleId')||'');
 }
 if(!photoRead.test(pathname)||query===undefined)return false;
 const params=new URLSearchParams(query);
 return params.size===1&&params.get('format')==='base64';
}
const allowedPath = value => {
 try {
  const pathname=decodeURIComponent(value.split('?')[0]);
  if (pathname.includes('\\') || pathname.split('/').some(part=>part==='.'||part==='..')) return false;
  return /^\/(?:api\/(?:mobile|public)\/|vehicle-configurations\/|marketing\/)/.test(pathname)||businessApiPathAllowed(value)||providerPhotoPathAllowed(value)||trackingSessionApiPathAllowed(value);
 } catch { return false; }
};
function previewBackendPort(env=process.env){
 const value=env.LOADGISTIC_PREVIEW_BACKEND_PORT;
 if(value===undefined)return 3100;
 if(value!=='3100'&&value!=='3101')throw new Error('LOCAL_PREVIEW_BACKEND_PORT_INVALID');
 return Number(value);
}
function localPreviewProxy(middleware) {
 const backendPort=previewBackendPort();
 return (request,response,next) => {
  if (request.url==='/__loadgistic-map-worker.js' && ['localhost','127.0.0.1'].includes((request.headers.host||'').split(':')[0])) {
   response.setHeader('Content-Type','text/javascript');
   createReadStream(path.resolve(__dirname,'../node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs'))
    .on('error',()=>{response.statusCode=500;response.end();}).pipe(response);
   return;
  }
  if (!allowedPath(request.url || '')) return middleware(request,response,next);
  if((request.url||'').startsWith('/api/tracking/')&&!trackingSessionApiPathAllowed(request.url,request.method)){response.writeHead(400);response.end();return;}
  const host=(request.headers.host||'').split(':')[0];
  if (!['localhost','127.0.0.1'].includes(host)) {response.writeHead(403);response.end();return;}
  const headers={...request.headers,host:`127.0.0.1:${backendPort}`};
  delete headers.cookie;
  const upstream=http.request({hostname:'127.0.0.1',port:backendPort,path:request.url,method:request.method,headers,timeout:65000},result=>{
   const output={...result.headers};delete output['set-cookie'];
   response.writeHead(result.statusCode||502,output);result.pipe(response);
  });
  upstream.on('timeout',()=>upstream.destroy());
  upstream.on('error',()=>{if(!response.headersSent)response.writeHead(502,{'Content-Type':'application/json','Cache-Control':'no-store'});response.end(JSON.stringify({error:{code:'LOCAL_BACKEND_UNAVAILABLE',message:`Start the Loadgistic local server on port ${backendPort}.`}}));});
  request.on('aborted',()=>upstream.destroy());
  response.on('close',()=>{if(!response.writableEnded)upstream.destroy();});
  request.pipe(upstream);
 };
}
module.exports={localPreviewProxy,allowedPath,providerPhotoPathAllowed,previewBackendPort};
