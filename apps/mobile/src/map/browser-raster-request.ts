export interface RasterRequest {
 responseType:XMLHttpRequestResponseType;
 timeout:number;
 readonly status:number;
 readonly response:unknown;
 onload:XMLHttpRequest['onload'];
 onerror:XMLHttpRequest['onerror'];
 onabort:XMLHttpRequest['onabort'];
 ontimeout:XMLHttpRequest['ontimeout'];
 open(method:string,url:string,async:boolean):void;
 setRequestHeader(name:string,value:string):void;
 send():void;
 abort():void;
 getAllResponseHeaders():string;
}
export type RasterResponse={data:ArrayBuffer;cacheControl?:string;expires?:string;etag?:string};
export const rasterProtocol='loadgistic-osm';

export function osmRasterUrl(value:string):string {
 const match=/^loadgistic-osm:\/\/(\d+)\/(\d+)\/(\d+)\.png$/.exec(value);
 if(!match)throw Error('Invalid map tile');
 const [zoom,x,y]=match.slice(1).map(Number);
 if(zoom>19||x>=2**zoom||y>=2**zoom)throw Error('Invalid map tile');
 return `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
}

export function loadBrowserRaster(value:string,signal:AbortSignal,createRequest:()=>RasterRequest=()=>new XMLHttpRequest()):Promise<RasterResponse> {
 const url=osmRasterUrl(value);
 return new Promise((resolve,reject)=>{
  const cancelled=()=>new DOMException('Map tile request cancelled','AbortError');
  if(signal.aborted){reject(cancelled());return;}
  const request=createRequest();let settled=false;
  const cleanup=()=>{
   signal.removeEventListener('abort',abort);
   request.onload=request.onerror=request.onabort=request.ontimeout=null;
  };
  const fail=(error:Error)=>{if(settled)return;settled=true;cleanup();reject(error);};
  const abort=()=>{request.abort();fail(cancelled());};
  request.onload=()=>{
   if(settled)return;
   if(request.status<200||request.status>=300){fail(Object.assign(Error('Map tile could not load'),{status:request.status}));return;}
   if(!(request.response instanceof ArrayBuffer)){fail(Error('Invalid map tile response'));return;}
   // Read only headers the browser exposes. Asking XHR for an unexposed ETag
   // logs a CORS error even when it returns null; fetch simply returns null.
   const headers=request.getAllResponseHeaders();
   const header=(name:string)=>headers.match(new RegExp(`^${name}:[ \\t]*([^\\r\\n]*)`,'im'))?.[1]?.trim()||undefined;
   const response={data:request.response,cacheControl:header('cache-control'),expires:header('expires'),etag:header('etag')};
   settled=true;cleanup();resolve(response);
  };
  request.onerror=()=>fail(Error('Map tile network request failed'));
  request.ontimeout=()=>fail(Error('Map tile request timed out'));
  request.onabort=()=>fail(cancelled());
  signal.addEventListener('abort',abort,{once:true});
  try{
   request.open('GET',url,true);request.responseType='arraybuffer';request.timeout=20000;
   request.setRequestHeader('Accept','image/webp,*/*');
   if(signal.aborted){abort();return;}
   request.send();
  }catch(error){fail(error instanceof Error?error:Error('Map tile request failed'));}
 });
}
