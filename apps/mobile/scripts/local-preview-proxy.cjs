const http = require('node:http');
const {createReadStream}=require('node:fs');
const path=require('node:path');
const allowedPath = value => {
 try {
  const pathname=decodeURIComponent(value.split('?')[0]);
  if (pathname.includes('\\') || pathname.split('/').some(part=>part==='.'||part==='..')) return false;
  return /^\/(?:api\/(?:mobile|public)\/|vehicle-configurations\/|marketing\/)/.test(pathname);
 } catch { return false; }
};
function localPreviewProxy(middleware) {
 return (request,response,next) => {
  if (request.url==='/__loadgistic-map-worker.js' && ['localhost','127.0.0.1'].includes((request.headers.host||'').split(':')[0])) {
   response.setHeader('Content-Type','text/javascript');
   createReadStream(path.resolve(__dirname,'../node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs'))
    .on('error',()=>{response.statusCode=500;response.end();}).pipe(response);
   return;
  }
  if (!allowedPath(request.url || '')) return middleware(request,response,next);
  const host=(request.headers.host||'').split(':')[0];
  if (!['localhost','127.0.0.1'].includes(host)) {response.writeHead(403);response.end();return;}
  const headers={...request.headers,host:'127.0.0.1:3100'};
  delete headers.cookie;
  const upstream=http.request({hostname:'127.0.0.1',port:3100,path:request.url,method:request.method,headers,timeout:65000},result=>{
   const output={...result.headers};delete output['set-cookie'];
   response.writeHead(result.statusCode||502,output);result.pipe(response);
  });
  upstream.on('timeout',()=>upstream.destroy());
  upstream.on('error',()=>{if(!response.headersSent)response.writeHead(502,{'Content-Type':'application/json','Cache-Control':'no-store'});response.end(JSON.stringify({error:{code:'LOCAL_BACKEND_UNAVAILABLE',message:'Start the Loadgistic local server on port 3100.'}}));});
  request.on('aborted',()=>upstream.destroy());
  response.on('close',()=>{if(!response.writableEnded)upstream.destroy();});
  request.pipe(upstream);
 };
}
module.exports={localPreviewProxy,allowedPath};
