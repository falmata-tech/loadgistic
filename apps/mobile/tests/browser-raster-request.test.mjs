import test from 'node:test';
import assert from 'node:assert/strict';
import {loadBrowserRaster,osmRasterUrl} from '../src/map/browser-raster-request.ts';
class Request {
 responseType='';timeout=0;status=200;response=new ArrayBuffer(4);
 onload=null;onerror=null;onabort=null;ontimeout=null;
 sent=0;aborted=0;url='';headers={'Cache-Control':'max-age=3600','Expires':'Wed, 07 Oct 2026 20:00:00 GMT','ETag':'fixture'};
 open(method,url,async){assert.equal(method,'GET');assert.equal(async,true);this.url=url;}
 setRequestHeader(name,value){assert.equal(name,'Accept');assert.equal(value,'image/webp,*/*');}
 send(){this.sent++;}
 abort(){this.aborted++;this.onabort?.();}
 getAllResponseHeaders(){return Object.entries(this.headers).map(([key,value])=>`${key}: ${value}`).join('\r\n');}
}
test('raster port permits only valid canonical OSM tiles, never arbitrary endpoints',()=>{
 assert.equal(osmRasterUrl('loadgistic-osm://0/0/0.png'),'https://tile.openstreetmap.org/0/0/0.png');
 assert.equal(osmRasterUrl('loadgistic-osm://19/524287/524287.png'),'https://tile.openstreetmap.org/19/524287/524287.png');
 for(const value of ['https://example.com/a.png','loadgistic-osm://20/0/0.png','loadgistic-osm://1/2/0.png','loadgistic-osm://1/0/2.png','loadgistic-osm://1/-1/0.png','loadgistic-osm://1/0/0.png?token=fixture','loadgistic-osm://1/../0.png'])assert.throws(()=>osmRasterUrl(value));
});
test('successful raster read retains bytes and expiry metadata without invoking fetch',async()=>{
 const request=new Request(),controller=new AbortController();
 const pending=loadBrowserRaster('loadgistic-osm://1/0/0.png',controller.signal,()=>request);
 assert.equal(request.url,'https://tile.openstreetmap.org/1/0/0.png');assert.equal(request.responseType,'arraybuffer');assert.equal(request.timeout,20000);
 request.onload();assert.deepEqual(await pending,{data:request.response,cacheControl:'max-age=3600',expires:request.headers.Expires,etag:'fixture'});
 controller.abort();assert.equal(request.aborted,0);assert.equal(request.onload,null);
});
test('pre-aborted signal sends no request; mid-body abort settles once and removes listeners',async()=>{
 const early=new AbortController();early.abort();let created=0;
 await assert.rejects(loadBrowserRaster('loadgistic-osm://1/0/0.png',early.signal,()=>{created++;return new Request();}),{name:'AbortError'});assert.equal(created,0);
 const request=new Request(),controller=new AbortController();const pending=loadBrowserRaster('loadgistic-osm://1/0/0.png',controller.signal,()=>request);
 const lateLoad=request.onload;controller.abort();await assert.rejects(pending,{name:'AbortError'});
 assert.equal(request.sent,1);assert.equal(request.aborted,1);assert.equal(request.onabort,null);lateLoad();assert.equal(request.onload,null);
});
test('empty tiles and omitted or empty exposed headers remain valid without reading unsafe headers',async()=>{
 const request=new Request(),controller=new AbortController();request.status=204;request.response=new ArrayBuffer(0);
 request.getAllResponseHeaders=()=> 'etag: \r\ncache-control: max-age=3600\r\n';
 const pending=loadBrowserRaster('loadgistic-osm://1/0/0.png',controller.signal,()=>request);request.onload();
 const result=await pending;assert.equal(result.data.byteLength,0);assert.equal(result.etag,undefined);assert.equal(result.expires,undefined);assert.equal(result.cacheControl,'max-age=3600');
});
test('HTTP, network, timeout and malformed responses remain genuine failures',async()=>{
 for(const type of ['http','network','timeout','invalid']){
  const request=new Request(),controller=new AbortController();const pending=loadBrowserRaster('loadgistic-osm://1/0/0.png',controller.signal,()=>request);
  if(type==='http'){request.status=503;request.onload();}else if(type==='invalid'){request.response='not bytes';request.onload();}else if(type==='network')request.onerror();else request.ontimeout();
  await assert.rejects(pending,error=>error.name!=='AbortError'&&(type!=='http'||error.status===503));
  controller.abort();assert.equal(request.aborted,0);assert.equal(request.onload,null);
 }
});
