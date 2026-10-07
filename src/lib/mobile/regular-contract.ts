import { z } from 'zod';
import { mobileCatalogPlace } from './place-projection.js';
const place = z.object({ placeRef: z.string().trim().min(1).max(150) }).strict();
export const regularCommand = z.discriminatedUnion('action', [
 z.object({ action: z.literal('SAVE'), replaceId: z.string().uuid().nullable(), geometry: z.enum(['ROUTE', 'RADIUS']), routePlaces: z.array(place).max(5), areaCenterPlaceRef: z.string().max(150), areaBoundaryPlaces: z.array(place).max(5) }).strict(),
 z.object({ action: z.literal('REMOVE'), id: z.string().uuid(), confirm: z.literal(true) }).strict(),
]);
const row = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === 'string' ? value : '';
const places = (value: unknown) => (Array.isArray(value) ? value : []).map(mobileCatalogPlace);
export function regularService(value: unknown) {
 const data = row(value); return (Array.isArray(data.corridors) ? data.corridors : []).map(value => { const item = row(value); return { id: text(item.id), geometry: text(item.geometry), route: places(item.route_points), center: mobileCatalogPlace({place_ref:item.area_center_place_ref,label:item.area_center_label,lat:item.area_center_lat,lng:item.area_center_lng}), boundary: places(item.area_boundary) }; });
}
