import { TransformRequestManager, type StyleSpecification } from '@maplibre/maplibre-react-native';
// Process-wide native header, installed before any map mounts.
TransformRequestManager.addHeader({ id: 'loadgistic-osm', name: 'User-Agent', value: 'Loadgistic/1.0 (+https://loadgistic.com)', match: /^https:\/\/tile\.openstreetmap\.org\// });
export const mapStyle: StyleSpecification = {
  version: 8,
  sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap contributors', maxzoom: 19 } },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};
