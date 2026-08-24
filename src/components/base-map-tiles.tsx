"use client";

import { TileLayer } from 'react-leaflet';
import { PUBLIC_MAP_TILE_CONFIG } from '@/lib/map-tiles.js';

export function BaseMapTiles(){
  return <TileLayer url={PUBLIC_MAP_TILE_CONFIG.url} attribution={PUBLIC_MAP_TILE_CONFIG.attribution}/>;
}
