import type {StyleSpecification} from 'maplibre-gl';
// Browsers supply their own User-Agent and Referer; no native header override.
export const mapStyle:StyleSpecification={version:8,sources:{osm:{type:'raster',tiles:['loadgistic-osm://{z}/{x}/{y}.png'],tileSize:256,attribution:'© OpenStreetMap contributors',maxzoom:19}},layers:[{id:'osm',type:'raster',source:'osm'}]};
