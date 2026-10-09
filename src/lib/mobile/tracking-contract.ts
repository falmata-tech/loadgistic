import { z } from 'zod';
import {dateOnly} from '../date-calendar.js';
const place = z.string().trim().min(1).max(150);
const date = z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/).default('');
const email = z.string().trim().email().max(254);
export const createTracking = z.object({ vehicleId: z.string().uuid(), originPlaceRef: place, destinationPlaceRef: place,
  cargoSummary: z.string().trim().min(3).max(500), customerEmail: email,
  additionalRecipientEmails: z.array(email).max(20).default([]), expectedPickupDate: date, expectedDeliveryDate: z.string().refine(value=>Boolean(dateOnly(value))),
  trackingMode: z.enum(['STATUS_ONLY', 'LOCATION_AND_STATUS']),
}).strict();
export const trackingLocation = z.object({ approximateLat: z.number().finite().min(-90).max(90), approximateLng: z.number().finite().min(-180).max(180), locationPrecisionKm: z.number().refine(value => [1, 3, 5, 10, 20].includes(value)) }).strict();
export const trackingCommand = z.discriminatedUnion('action', [
  z.object({ action: z.literal('STATUS'), nextStatus: z.enum(['TO_PICKUP', 'LOADING', 'IN_TRANSIT', 'UNLOADING', 'ISSUE']), note: z.string().trim().max(1000).default(''), location: trackingLocation.optional() }).strict(),
  z.object({ action: z.literal('LOCATION'), location: trackingLocation }).strict(),
  z.object({ action: z.literal('ADD_RECIPIENT'), email }).strict(),
  z.object({ action: z.literal('REVOKE_RECIPIENT'), recipientId: z.string().uuid() }).strict(),
]);
const row = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const list = (value: unknown): Record<string, unknown>[] => Array.isArray(value) ? value.map(row) : [];
const text = (value: unknown): string => typeof value === 'string' ? value : '';
export function trackingSummary(value: unknown) {
  const item = row(value);
  return { id: text(item.id), code: text(item.code), origin: text(item.origin), destination: text(item.destination), cargo: text(item.cargo_summary), status: text(item.operational_status), driver: text(item.driver_name), truck: [item.vehicle_make, item.vehicle_model].filter(Boolean).join(' '), updatedAt: text(item.updated_at) };
}
export function trackingWorkspace(value: unknown) {
  const data = row(value);
  return { canManage: row(data.access).can_manage_tracking === true,
    vehicles: list(data.vehicles).map(item => ({ id: text(item.id), label: [item.make, item.model, item.plate].filter(Boolean).join(' · ') })),
    shipments: list(data.shipments).map(trackingSummary),
  };
}
export function trackingDetail(value: unknown, actor: { id: string; role: string }, nextStatuses: string[]) {
  const data = row(value), location = row(data.latest_location);
  return { ...trackingSummary(data), mode: text(data.tracking_mode), nextStatuses,
    canLocate: actor.role === 'DRIVER' && data.assigned_driver_user_id === actor.id,
    pickupDate: text(data.expected_pickup_date), deliveryDate: text(data.expected_delivery_date),
    canManageRecipients: Boolean(data.guest_access_active) && !['COMPLETED', 'CANCELLED'].includes(text(data.operational_status)),
    location: location.created_at ? { area: text(location.location_area), radius: Number(location.location_precision_km), updatedAt: text(location.created_at) } : null,
    appeals: list(data.appeals).map(item=>({id:text(item.id),reason:text(item.reason),status:text(item.status),resolutionNote:text(item.resolution_note)})),
    events: list(data.events).map(item => ({ id: text(item.id), status: text(item.status), note: text(item.note), hasProof: Boolean(item.has_proof), createdAt: text(item.created_at) })),
    recipients: list(data.tracking_recipients).map(item => ({ id: text(item.id), email: text(item.recipient_email), owner: item.recipient_role === 'OWNER', revoked: Boolean(item.revoked_at) })),
    deliveries: list(data.email_deliveries).map(item => ({ kind: text(item.delivery_kind), status: text(item.status) })),
  };
}

export function trackingRecovery(value: unknown) {
 const data = row(value);
 return { id: text(data.id), revision: text(data.revision), status: text(data.status),
  cargo: text(data.cargo_summary), origin: { placeRef: text(data.origin_place_ref), label: text(data.origin) }, destination: { placeRef: text(data.destination_place_ref), label: text(data.destination) },
  pickupDate: text(data.expected_pickup_date), deliveryDate: text(data.expected_delivery_date),
  vehicleId: text(data.assigned_vehicle_id), actions: Array.isArray(data.actions) ? data.actions.filter(item => ['CORRECT', 'REASSIGN', 'CANCEL'].includes(String(item))) : [],
  vehicles: list(data.vehicles).map(item => ({ id: text(item.id), label: [item.make, item.model, item.platform_number].filter(Boolean).join(' · ') })),
 };
}

export function guestTrackingDetail(value: unknown) {
 const data = row(value), location = row(data.current_location), review = row(data.review);
 return { ...trackingSummary(data), provider: text(data.provider_name), mode: text(data.tracking_mode),
  canApprove: data.recipient_role==='OWNER'&&data.can_approve===true,
  canReview: data.recipient_role === 'OWNER' && data.can_review === true,
  events: list(data.events).map(item => ({ id: text(item.id), status: text(item.status), note: text(item.note), hasProof: item.has_proof === true, createdAt: text(item.created_at) })),
  location: location.updated_at ? { area: text(location.location_area), latitude: Number(location.location_lat), longitude: Number(location.location_lng), radius: Number(location.location_precision_km), updatedAt: text(location.updated_at) } : null,
  review: typeof review.rating === 'number' ? { rating: review.rating, note: text(review.note) } : null,
 };
}
