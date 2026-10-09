import { z } from 'zod';
import { mobileCatalogPlace } from './place-projection.js';
import { capacityLoadPreference } from '../capacity-load-preferences.js';
import {isValidCoordinate} from '../location-privacy.js';

const place = z.object({ placeRef: z.string().trim().min(1).max(150) }).strict();
const location = {
  approximateLat: z.number().finite().min(-90).max(90),
  approximateLng: z.number().finite().min(-180).max(180),
  locationPrecisionKm: z.number().refine(value => [1, 3, 5, 10, 20, 40].includes(value)),
};
const vehicleId = z.string().uuid();
export const capacityCommand = z.discriminatedUnion('action', [
  z.object({ action: z.literal('LOCATION'), vehicleId, ...location }).strict(),
  z.object({ action: z.literal('DUTY'), vehicleId, onDuty: z.boolean(),
    approximateLat: location.approximateLat.optional(), approximateLng: location.approximateLng.optional(),
    locationPrecisionKm: location.locationPrecisionKm.optional(),
  }).strict(),
  z.object({ action: z.literal('PUBLISH'), vehicleId,
    status: z.enum(['EMPTY', 'PARTIAL', 'OFF_DUTY']),
    acceptedLoads: z.enum(['FTL', 'PTL', 'BOTH']), availabilityGeometry: z.enum(['ROUTE', 'RADIUS']),
    visibility: z.enum(['PRIVATE', 'OPEN']).default('PRIVATE'),
    sharingMode: z.enum(['PUBLIC','PRIVATE','BOTH','EXCLUSIVE']).optional(),
    exclusiveEmail: z.string().trim().max(254).optional(),
    exclusiveName: z.string().trim().max(100).optional(),
    currentRoutePlaces: z.array(place).max(5), capacityAreaCenterPlaceRef: z.string().max(150),
    capacityAreaBoundaryPlaces: z.array(place).max(5),
    acceptsMultiPick: z.boolean(), acceptsMultiDrop: z.boolean(),
  }).strict(),
]);

const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown): string => typeof value === 'string' ? value : '';
const points = (value: unknown) => list(value).map(mobileCatalogPlace);
const approximateLocation = (value: Record<string, unknown>, legacy = false) => {
  const lat = Number(legacy ? value.location_lat : value.lat), lng = Number(legacy ? value.location_lng : value.lng);
  const radius = Number(legacy ? value.location_precision_km : value.radius);
  const present = legacy ? value.location_lat != null && value.location_lng != null : value.lat != null && value.lng != null;
  return { area: text(legacy ? value.location_area : value.area), radius, updatedAt: text(legacy ? value.location_updated_at : value.updatedAt),
    coordinate: present && isValidCoordinate(lat,lng) && [1,3,5,10,20,40].includes(radius) ? [lng,lat] : null };
};
// This projection accepts only an already caller-authorized workspace, never raw tables.
export function projectMobileCapacity(workspace: unknown, actorId: string, role: string) {
  const data = object(workspace), access = object(data.access), capacities = list(data.capacities).map(object);
  return { canPublish: role === 'TRANSPORTER' || access.can_manage_capacity === true,
    vehicles: list(data.vehicles).map(value => {
      const row = object(value), driver = object(row.assigned_driver), location = object(row.driver_location);
      const current = capacities.find(item => item.vehicle_id === row.id);
      return {
        id: text(row.id), label: [row.make, row.model].filter(Boolean).join(' '), plate: text(row.plate),
        driver: text(driver.name), canLocate: role === 'DRIVER' && driver.id === actorId,
        dutyConfigured: row.duty_configuration_available === true,
        location: location.updatedAt ? approximateLocation(location)
          : current?.location_updated_at ? approximateLocation(current, true) : null,
        current: current ? {
          status: text(current.status), visibility: text(current.visibility), sharingMode: text(current.sharing_mode), exclusiveEmail: text(current.exclusive_email), exclusiveName: text(current.exclusive_name), updatedAt: text(current.updated_at),
          acceptedLoads: capacityLoadPreference(current.status, current.accepts_full_load, current.accepts_partial_load),
          availabilityGeometry: current.availability_geometry === 'ROUTE' ? 'ROUTE' : 'RADIUS',
          route: points(current.current_route_points), areaCenter: mobileCatalogPlace({place_ref:current.capacity_area_center_place_ref,label:current.capacity_area_center_label,lat:current.capacity_area_center_lat,lng:current.capacity_area_center_lng}),
          boundary: points(current.capacity_area_boundary), acceptsMultiPick: Boolean(current.accepts_multi_pick), acceptsMultiDrop: Boolean(current.accepts_multi_drop),
        } : null,
      };
    }),
  };
}
