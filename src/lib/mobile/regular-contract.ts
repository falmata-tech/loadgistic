import { z } from 'zod';
import { mobileCatalogPlace } from './place-projection.js';
const place = z.object({ placeRef: z.string().trim().min(1).max(150) }).strict();
export const regularScope = z.object({ vehicleId: z.string().uuid(), expectedDriverId: z.string().uuid() }).strict();
const scope = regularScope.shape;
export const regularCommand = z.discriminatedUnion('action', [
 z.object({ action: z.literal('SAVE'), ...scope, replaceId: z.string().uuid().nullable(), geometry: z.enum(['ROUTE', 'RADIUS']), routePlaces: z.array(place).max(5), areaCenterPlaceRef: z.string().max(150), areaBoundaryPlaces: z.array(place).max(5) }).strict(),
 z.object({ action: z.literal('REMOVE'), ...scope, id: z.string().uuid(), confirm: z.literal(true) }).strict(),
]);
const row = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === 'string' ? value : '';
const places = (value: unknown) => (Array.isArray(value) ? value : []).map(mobileCatalogPlace);
export function regularService(value: unknown) {
 const data = row(value); return (Array.isArray(data.corridors) ? data.corridors : []).map(row).filter(item=>text(item.vehicle_id)&&text(item.driver_user_id)).map(item => ({ id: text(item.id), vehicleId:text(item.vehicle_id), driverId:text(item.driver_user_id), geometry: item.geometry==='RADIUS'?'RADIUS' as const:'ROUTE' as const, route: places(item.route_points), center: mobileCatalogPlace({place_ref:item.area_center_place_ref,label:item.area_center_label,lat:item.area_center_lat,lng:item.area_center_lng}), boundary: places(item.area_boundary) }));
}
