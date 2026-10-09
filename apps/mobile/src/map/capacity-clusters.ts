import type {Feature, FeatureCollection, Point} from 'geojson';
import type {CapacitySignal} from '../api/public-capacity.ts';
import {markerLocation, separateMarkers, type LngLat} from './capacity-geometry.ts';
import type {MapPoint} from './focused-markers.ts';

export type CapacityStatus = 'EMPTY' | 'PARTIAL';
export const capacityStatuses: CapacityStatus[] = ['EMPTY', 'PARTIAL'];
export const capacityColors = {EMPTY: '#16a34a', PARTIAL: '#eab308'};
export const capacitySourceIds = {EMPTY: 'capacity-empty', PARTIAL: 'capacity-partial'};
export const capacityLayerIds = (status: CapacityStatus) => [
  `${capacitySourceIds[status]}-clusters`, `${capacitySourceIds[status]}-trucks`,
];

/** Filtering layers after clustering cannot undo a mixed cluster. Partition first. */
export function capacityMapData(items: CapacitySignal[]): Record<CapacityStatus, FeatureCollection<Point>> {
  const result: Record<CapacityStatus, FeatureCollection<Point>> = {
    EMPTY: {type: 'FeatureCollection', features: []},
    PARTIAL: {type: 'FeatureCollection', features: []},
  };
  for (const item of items) {
    const coordinate = markerLocation(item);
    if (coordinate) result[item.status].features.push({type: 'Feature', id: item.id,
      properties: {id: item.id, status: item.status}, geometry: {type: 'Point', coordinates: coordinate}});
  }
  return result;
}

export function renderedCapacityPoints(features: Feature[], status: CapacityStatus): MapPoint[] {
  const unique = new Map<string, MapPoint>();
  for (const feature of features) {
    if (feature.geometry?.type !== 'Point') continue;
    const coordinate = feature.geometry.coordinates;
    if (coordinate.length !== 2 || !coordinate.every(Number.isFinite)
      || Math.abs(coordinate[0]) > 180 || Math.abs(coordinate[1]) > 90) continue;
    const properties = feature.properties || {};
    const clustered = properties.cluster === true || properties.cluster === 1;
    const cluster = clustered ? Number(properties.cluster_id) : null;
    const count = clustered ? Number(properties.point_count) : 1;
    const itemId = typeof properties.id === 'string' ? properties.id : '';
    if (clustered ? !Number.isInteger(cluster) || cluster! < 0 || !Number.isInteger(count) || count < 2 : !itemId) continue;
    const key = cluster === null ? `truck:${itemId}` : `cluster:${status}:${cluster}`;
    unique.set(key, {key, status, cluster, count, itemId, coordinate: coordinate as LngLat});
  }
  return [...unique.values()];
}

/** Displace only touch targets; source coordinates and cluster membership stay real. */
export function capacityMarkerOffsets(points: MapPoint[], zoom: number) {
  return separateMarkers(points.map(point => ({id: point.key, coordinate: point.coordinate})), zoom, 96);
}
