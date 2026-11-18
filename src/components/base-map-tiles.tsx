"use client";

import { TileLayer } from 'react-leaflet';
import { PUBLIC_MAP_TILE_CONFIG } from '@/lib/map-tiles.js';

export function BaseMapTiles(){
  // Identify the site to its tile provider without sending private route paths.
  return <TileLayer referrerPolicy="strict-origin" url={PUBLIC_MAP_TILE_CONFIG.url} attribution={PUBLIC_MAP_TILE_CONFIG.attribution}/>;
}
