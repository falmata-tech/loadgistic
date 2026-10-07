import { mobileProfilePublished } from '@/lib/mobile/profile-state';
import { mobileActor, mobileBody, mobileFailure, mobileJson, MobileError } from '@/lib/mobile/server';
import { capacityCommand, projectMobileCapacity } from '@/lib/mobile/capacity-contract';
import { getProviderCapacityWorkspace, publishProviderCapacity, refreshProviderCapacityLocation, setProviderAssignedVehicleDuty } from '@/lib/provider-capacity.js';
import { errorMessage } from '@/lib/errors';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    const user = await mobileActor(request);
    return mobileJson({ ...projectMobileCapacity(await getProviderCapacityWorkspace(user), user.id, user.role), profilePublished: await mobileProfilePublished(user) });
  } catch (error) { return mobileFailure(error); }
}
export async function POST(request: Request) {
  try {
    const user = await mobileActor(request), parsed = capacityCommand.safeParse(await mobileBody(request));
    if (!parsed.success) throw new MobileError(400, 'INVALID_INPUT', 'Check the capacity details and choose cities from the suggestions.');
    const input = parsed.data;
    try {
      if (input.action === 'LOCATION') await refreshProviderCapacityLocation(user, input);
      else if (input.action === 'DUTY') await setProviderAssignedVehicleDuty(user, input.vehicleId, input.onDuty, { ...input, locationSource: 'DEVICE_OBSCURED' });
      else await publishProviderCapacity(user, { ...input, locationSource: 'PRESERVE_DRIVER' });
      return mobileJson({ ok: true });
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (['FORBIDDEN', 'SUBSCRIPTION_ACCESS_REQUIRED', 'INVALID_VEHICLE', 'NOT_FOUND', 'DEVICE_LOCATION_DRIVER_ONLY'].includes(code)) throw new MobileError(403, 'FORBIDDEN', 'This action is not available for this truck and account.');
      if (/^(INVALID_|DRIVER_REQUIRED_|CAPACITY_|PARTIAL_CAPACITY_|ACCEPTED_LOADS_|LOCALITY_)/.test(code)) throw new MobileError(400, 'INVALID_INPUT', errorMessage(error));
      throw error;
    }
  } catch (error) { return mobileFailure(error); }
}
