import { resolveMapTileConfig } from './map-tiles.js';

function managedAuthOrigin(environment){
  try{
    const url=new URL(String(environment.NEXT_PUBLIC_SUPABASE_URL||''));
    if(url.username||url.password)return null;
    if(url.protocol==='https:')return url.origin;
    const loopback=new Set(['127.0.0.1','localhost','[::1]']);
    if(environment.NODE_ENV!=='production'&&url.protocol==='http:'&&loopback.has(url.hostname)){
      return url.origin;
    }
    return null;
  }catch{
    return null;
  }
}

export function contentSecurityPolicy(environment=process.env){
  const scriptPolicy=environment.NODE_ENV!=='production'
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";
  const tileOrigin=resolveMapTileConfig(environment).origin;
  const authOrigin=managedAuthOrigin(environment);
  const formAction=authOrigin
    ?`form-action 'self' ${authOrigin} https://accounts.google.com`
    :"form-action 'self'";
  return `default-src 'self'; img-src 'self' data: blob: ${tileOrigin}; style-src 'self' 'unsafe-inline'; ${scriptPolicy}; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; ${formAction}`;
}
