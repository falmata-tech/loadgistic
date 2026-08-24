import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { COMMUNITY_OSM_TILE_URL, resolveMapTileConfig } from '../src/lib/map-tiles.js';
import { contentSecurityPolicy } from '../src/lib/security-headers.js';
import { launchReadiness } from '../src/lib/launch-readiness.js';
import nextConfig from '../next.config.mjs';

const configured={
  NEXT_PUBLIC_MAP_TILE_URL:'https://tiles.example.test/basic/{z}/{x}/{y}.png?key=public',
  NEXT_PUBLIC_MAP_TILE_ATTRIBUTION:'&copy; <a href="https://tiles.example.test/terms">Example Maps</a>'
};

test('map tile configuration uses an exact direct OSM fallback and accepts one HTTPS origin',()=>{
  const fallback=resolveMapTileConfig({});
  assert.equal(fallback.url,COMMUNITY_OSM_TILE_URL);
  assert.equal(fallback.url.includes('{s}'),false);
  assert.equal(fallback.origin,'https://tile.openstreetmap.org');
  assert.equal(fallback.communityOsm,true);
  assert.match(fallback.attribution,/<a href="https:\/\/www\.openstreetmap\.org\/copyright">/);

  const selected=resolveMapTileConfig(configured);
  assert.equal(selected.url,configured.NEXT_PUBLIC_MAP_TILE_URL);
  assert.equal(selected.origin,'https://tiles.example.test');
  assert.equal(selected.attribution,configured.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION);
  assert.equal(selected.communityOsm,false);
  assert.equal(selected.fallback,false);
});

test('insecure, unlinked, or subdomain-template tile configuration fails safely',()=>{
  for(const url of [
    'http://tiles.example.test/{z}/{x}/{y}.png',
    'https://{s}.tiles.example.test/{z}/{x}/{y}.png',
    'https://tiles.example.test/no-placeholders.png'
  ])assert.equal(resolveMapTileConfig({NEXT_PUBLIC_MAP_TILE_URL:url}).url,COMMUNITY_OSM_TILE_URL);

  const unsafe=resolveMapTileConfig({
    NEXT_PUBLIC_MAP_TILE_URL:configured.NEXT_PUBLIC_MAP_TILE_URL,
    NEXT_PUBLIC_MAP_TILE_ATTRIBUTION:'<img src=x onerror=alert(1)>'
  });
  assert.equal(unsafe.url,COMMUNITY_OSM_TILE_URL);
  assert.match(unsafe.attribution,/OpenStreetMap contributors/);
  const appendedTag=resolveMapTileConfig({
    NEXT_PUBLIC_MAP_TILE_URL:configured.NEXT_PUBLIC_MAP_TILE_URL,
    NEXT_PUBLIC_MAP_TILE_ATTRIBUTION:`${configured.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION}<video>`
  });
  assert.equal(appendedTag.url,COMMUNITY_OSM_TILE_URL);
});

test('CSP permits only the selected exact tile origin',()=>{
  const policy=contentSecurityPolicy({NODE_ENV:'production',...configured});
  assert.match(policy,/img-src 'self' data: blob: https:\/\/tiles\.example\.test;/);
  assert.equal(policy.includes('tile.openstreetmap.org'),false);
  assert.equal(policy.includes('*.tile'),false);
  assert.equal(policy.includes("'unsafe-eval'"),false);
});

test('Next.js serves the resolved tile CSP on application routes',async()=>{
  const previous={
    NODE_ENV:process.env.NODE_ENV,
    NEXT_PUBLIC_MAP_TILE_URL:process.env.NEXT_PUBLIC_MAP_TILE_URL,
    NEXT_PUBLIC_MAP_TILE_ATTRIBUTION:process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION
  };
  Object.assign(process.env,{NODE_ENV:'production',...configured});
  try{
    const groups=await nextConfig.headers();
    const application=groups.find(group=>group.source==='/(.*)');
    const value=application?.headers.find(header=>header.key==='Content-Security-Policy')?.value;
    assert.equal(value,contentSecurityPolicy(process.env));
    assert.match(value,/https:\/\/tiles\.example\.test/);
    assert.equal(value.includes('*.tile'),false);
  }finally{
    for(const [key,value] of Object.entries(previous)){
      if(value===undefined)delete process.env[key];
      else process.env[key]=value;
    }
  }
});

test('community OSM is a production launch warning, not a blocker',()=>{
  const fallback=launchReadiness({NODE_ENV:'production'});
  assert.ok(fallback.warnings.includes('community-osm-tile-service'));
  assert.equal(fallback.blockers.includes('community-osm-tile-service'),false);

  const selected=launchReadiness({NODE_ENV:'production',...configured});
  assert.equal(selected.warnings.includes('community-osm-tile-service'),false);
  assert.equal(selected.mapTileOrigin,'https://tiles.example.test');
});

test('all Leaflet maps use the shared tile component',async()=>{
  const files=[
    'capacity-location-map-leaflet.tsx',
    'nearby-truck-map-leaflet.tsx',
    'public-capacity-map-leaflet.tsx',
    'route-coverage-map-leaflet.tsx',
    'tracking-location-map-leaflet.tsx',
    'local-load-map-picker-leaflet.tsx'
  ];
  for(const file of files){
    const source=await readFile(new URL(`../src/components/${file}`,import.meta.url),'utf8');
    assert.match(source,/<BaseMapTiles\s*\/>/,file);
    assert.equal(source.includes('<TileLayer'),false,file);
    assert.equal(source.includes('tile.openstreetmap.org'),false,file);
  }
});
