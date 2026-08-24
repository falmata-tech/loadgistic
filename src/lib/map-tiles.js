export const COMMUNITY_OSM_TILE_URL='https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const COMMUNITY_OSM_ATTRIBUTION='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';

const REQUIRED_PLACEHOLDERS=['{z}','{x}','{y}'];

function safeHttpsTileTemplate(value){
  const template=String(value||'').trim();
  if(!template||template.includes('{s}')||!REQUIRED_PLACEHOLDERS.every(part=>template.includes(part)))return null;
  try{
    const parsed=new URL(template.replace('{z}','6').replace('{x}','38').replace('{y}','24'));
    if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.hash)return null;
    return {template,origin:parsed.origin};
  }catch{return null;}
}

function safeLinkedAttribution(value){
  const attribution=String(value||'').trim();
  if(!attribution)return null;
  const linked=/<a\s[^>]*href=["']https:\/\/[^"']+["'][^>]*>[^<]+<\/a>/gi;
  if(!linked.test(attribution))return null;
  linked.lastIndex=0;
  if(/[<>]/.test(attribution.replace(linked,'')))return null;
  if(/\son\w+\s*=|\sstyle\s*=|javascript:|data:/i.test(attribution))return null;
  return attribution;
}

export function resolveMapTileConfig(environment=process.env){
  const requestedTile=safeHttpsTileTemplate(environment.NEXT_PUBLIC_MAP_TILE_URL);
  const requestedAttribution=safeLinkedAttribution(environment.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION);
  const configured=Boolean(requestedTile&&requestedAttribution);
  const fallback=!configured;
  const tile=configured?requestedTile:safeHttpsTileTemplate(COMMUNITY_OSM_TILE_URL);
  const attribution=configured?requestedAttribution:COMMUNITY_OSM_ATTRIBUTION;
  const communityOsm=tile.origin==='https://tile.openstreetmap.org';
  return Object.freeze({
    url:tile.template,
    origin:tile.origin,
    attribution,
    communityOsm,
    fallback
  });
}

// Direct property reads allow Next.js to inline the public build-time values in
// client bundles without exposing any server-only environment configuration.
export const PUBLIC_MAP_TILE_CONFIG=resolveMapTileConfig({
  NEXT_PUBLIC_MAP_TILE_URL:process.env.NEXT_PUBLIC_MAP_TILE_URL,
  NEXT_PUBLIC_MAP_TILE_ATTRIBUTION:process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION
});
