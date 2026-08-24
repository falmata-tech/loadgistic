import { resolveMapTileConfig } from './map-tiles.js';

export function contentSecurityPolicy(environment=process.env){
  const scriptPolicy=environment.NODE_ENV!=='production'
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";
  const tileOrigin=resolveMapTileConfig(environment).origin;
  return `default-src 'self'; img-src 'self' data: blob: ${tileOrigin}; style-src 'self' 'unsafe-inline'; ${scriptPolicy}; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`;
}
