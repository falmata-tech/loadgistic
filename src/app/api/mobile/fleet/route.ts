import { z } from 'zod';
import { mobileActor, mobileBody, mobileFailure, mobileJson, MobileError } from '@/lib/mobile/server';
import { getProviderCapacityWorkspace } from '@/lib/provider-capacity.js';
import { canManageProviderVehicles, createProviderVehicle, getFleetDriverPage, updateFleetDriverAccess, updateProviderVehicleDetails, setProviderVehicleAttachedTrailer } from '@/lib/fleet.js';
import { addFleetDriver, updateFleetDriverContact, removeFleetDriver, pendingFleetInvitations, cancelFleetInvitation, sendFleetInvitation } from '@/lib/fleet-driver-management';
import { VEHICLE_CONFIGURATIONS, vehicleConfigurationImage } from '@/lib/vehicle-configurations';
import { retiredVehiclePage, setVehicleLifecycle } from '@/lib/lifecycle.js';
import { checkRateLimit } from '@/lib/rate-limit';
import { errorMessage } from '@/lib/errors';
export const runtime = 'nodejs';
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const createTruck = z.object({ action: z.literal('ADD_TRUCK'), make: z.string().trim().min(1).max(100), model: z.string().trim().min(1).max(100), plate: z.string().trim().max(40), cargoConfiguration: z.string().refine(value => VEHICLE_CONFIGURATIONS.some(item => item.name === value)), trailerInterchangeable: z.boolean().default(false), supportedTrailerConfigurations: z.array(z.string()).max(15).default([]) }).strict();
const createDriver = z.object({ action: z.literal('ADD_DRIVER'), name: z.string().trim().min(2).max(100), email: z.string().trim().email().max(254), phone: z.string().trim().min(7).max(32) }).strict();
const assignDriver = z.object({ action: z.literal('ASSIGN_DRIVER'), driverId: z.string().uuid(), vehicleId: z.union([z.string().uuid(), z.literal('')]), canManageCapacity: z.boolean(), canManageTracking: z.boolean() }).strict();
const command = z.discriminatedUnion('action', [createTruck, createDriver, assignDriver,
 createTruck.omit({ trailerInterchangeable: true, supportedTrailerConfigurations: true }).extend({ action: z.literal('EDIT_TRUCK'), vehicleId: z.string().uuid() }),
 z.object({ action: z.literal('TRAILER'), vehicleId: z.string().uuid(), cargoConfiguration: z.string().min(1).max(100) }).strict(),
 z.object({ action: z.literal('LIFECYCLE'), vehicleId: z.string().uuid(), active: z.boolean(), reason: z.string().trim().min(5).max(500), confirm: z.literal(true) }).strict(),
 z.object({ action: z.literal('DRIVER_CONTACT'), driverId: z.string().uuid(), name: z.string().trim().min(2).max(100), phone: z.string().trim().min(7).max(32) }).strict(),
 z.object({ action: z.literal('REMOVE_DRIVER'), driverId: z.string().uuid(), confirm: z.literal(true) }).strict(),
 z.object({ action: z.literal('INVITATION'), invitationId: z.string().uuid(), operation: z.enum(['SEND', 'CANCEL']) }).strict(),
]);
export async function GET(request: Request) {
  try {
    const user = await mobileActor(request), workspace = await getProviderCapacityWorkspace(user);
    const page = Math.max(1, Math.min(10000, Number(new URL(request.url).searchParams.get('driverPage')) || 1));
    const retired = canManageProviderVehicles(user) ? await retiredVehiclePage(user, Number(new URL(request.url).searchParams.get('retiredPage')) || 1) : { items: [], page: 1, pageCount: 1 };
    const invitations = user.role === 'TRANSPORTER' ? await pendingFleetInvitations(user.id) : [];
    const drivers = user.role === 'TRANSPORTER' ? await getFleetDriverPage(user, { page, pageSize: 10 }) : { items: [], page: 1, pageCount: 1 };
    return mobileJson({ canManage: canManageProviderVehicles(user), canManageDrivers: user.role === 'TRANSPORTER', configurations: VEHICLE_CONFIGURATIONS, invitations: invitations.map(item => ({ id: item.id, name: item.driver_name, email: item.email, expiresAt: item.expires_at, sentAt: item.email_sent_at })),
      retired: retired.items.map((value: unknown) => { const item = object(value); return { id: String(item.id), label: [item.platform_number, item.make, item.model].filter(Boolean).join(" · ") }; }), retiredPage: retired.page, retiredPageCount: retired.pageCount,
      vehicles: workspace.vehicles.map((value: unknown) => { const row = object(value), driver = object(row.assigned_driver); return {
        id: String(row.id || ''), make: String(row.make || ''), model: String(row.model || ''), plate: String(row.plate || ''), configuration: String(row.cargo_configuration || row.category || ''),
        interchangeable: row.trailer_interchangeable === true, supported: Array.isArray(row.supported_trailer_configurations) ? row.supported_trailer_configurations.filter((item: unknown) => typeof item === 'string') : [],
        image: vehicleConfigurationImage(String(row.cargo_configuration || row.category || '')), driver: typeof driver.name === 'string' ? driver.name : null,
      }; }),
      drivers: drivers.items.map((value: unknown) => { const row = object(value); return { id: String(row.id || ''), name: String(row.name || ''), email: String(row.email || ''), phone: String(row.phone || ''), vehicleId: String(row.assigned_vehicle_id || ''), canManageCapacity: Boolean(row.can_manage_capacity), canManageTracking: Boolean(row.can_manage_tracking) }; }),
      driverPage: drivers.page, driverPageCount: drivers.pageCount,
    });
  } catch (error) { return mobileFailure(error); }
}
export async function POST(request: Request) {
  try {
    const user = await mobileActor(request), parsed = command.safeParse(await mobileBody(request));
    if (!parsed.success) throw new MobileError(400, 'INVALID_INPUT', 'Check the truck or driver details.');
    const input = parsed.data;
    try {
      if (input.action === 'ADD_TRUCK') { const truck = await createProviderVehicle(user, input); return mobileJson({ ok: true, id: truck.id }); }
      if (['EDIT_TRUCK', 'TRAILER', 'LIFECYCLE'].includes(input.action) && !canManageProviderVehicles(user)) throw new MobileError(403, 'FORBIDDEN', 'Only the truck owner can manage this action.');
      if (input.action === 'EDIT_TRUCK') { await updateProviderVehicleDetails(user, input.vehicleId, input); return mobileJson({ ok: true }); }
      if (input.action === 'TRAILER') { await setProviderVehicleAttachedTrailer(user, input.vehicleId, input.cargoConfiguration); return mobileJson({ ok: true }); }
      if (input.action === 'LIFECYCLE') { await setVehicleLifecycle(user, input.vehicleId, { active: input.active, reason: input.reason }); return mobileJson({ ok: true }); }
      if (user.role !== 'TRANSPORTER') throw new MobileError(403, 'FORBIDDEN', 'Only the fleet owner can manage drivers.');
      if (input.action === 'ADD_DRIVER') { const rate = await checkRateLimit(`fleet-driver-add:${user.id}`, 20, 10 * 60000); if (!rate.allowed) throw new MobileError(429, 'PLEASE_WAIT', 'Please wait before adding more drivers.'); const id = await addFleetDriver(user.id, input); return mobileJson({ ok: true, id }); }
      if (input.action === 'DRIVER_CONTACT') await updateFleetDriverContact(user.id, input.driverId, input);
      else if (input.action === 'REMOVE_DRIVER') await removeFleetDriver(user.id, input.driverId);
      else if (input.action === 'INVITATION') {
        if (input.operation === 'CANCEL') await cancelFleetInvitation(user.id, input.invitationId);
        else return mobileJson({ ok: true, delivery: await sendFleetInvitation(user.id, input.invitationId) });
      } else await updateFleetDriverAccess(user, input.driverId, input);
      return mobileJson({ ok: true });
    } catch (error) {
      if (error instanceof MobileError) throw error;
      const code = error instanceof Error ? error.message : '';
      if (['FORBIDDEN', 'SUBSCRIPTION_ACCESS_REQUIRED', 'NOT_FOUND'].includes(code)) throw new MobileError(403, 'FORBIDDEN', 'This truck or driver is not available to your account.');
      if (/^(INVALID_|DRIVER_|VEHICLE_|TRUCK_|INCOMPATIBLE_|NOT_INTERCHANGEABLE|LIFECYCLE_|INVITATION_)/.test(code)) throw new MobileError(400, 'INVALID_INPUT', errorMessage(error));
      throw error;
    }
  } catch (error) { return mobileFailure(error); }
}
