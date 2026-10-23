import { mobileActor, mobileBody, mobileJson, mobileFailure, MobileError } from '@/lib/mobile/server';
import { getProviderRegularCapacity, addProviderRegularCapacity, removeProviderRegularCapacity } from '@/lib/provider-capacity.js';
import { regularCommand, regularService, regularScope } from '@/lib/mobile/regular-contract';
import { errorMessage } from '@/lib/errors';
export const runtime = 'nodejs';
const scopeGuidance='Open Usual routes from your vehicle. Update Loadgistic if you cannot see it.';
function commandFailure(error:unknown):never{
 const code=error instanceof Error?error.message:'';
 if(code==='TRUCK_DRIVER_CHANGED')throw new MobileError(409,code,'Vehicle assignment changed. Refresh the vehicle, then try again.');
 if(['FORBIDDEN','NOT_FOUND','SUBSCRIPTION_ACCESS_REQUIRED','INVALID_VEHICLE'].includes(code))throw new MobileError(403,'FORBIDDEN','This regular service is not available for this vehicle and account.');
 if(code==='REGULAR_TRUCK_DRIVER_REQUIRED')throw new MobileError(400,code,scopeGuidance);
 if(/^(INVALID_|REGULAR_|CAPACITY_|LOCALITY_)/.test(code))throw new MobileError(400,'INVALID_INPUT',errorMessage(error));
 throw error;
}
export async function GET(request: Request) {
 try {
  const user=await mobileActor(request),params=new URL(request.url).searchParams;
  const parsed=regularScope.safeParse({vehicleId:params.get('vehicleId'),expectedDriverId:params.get('expectedDriverId')});
  if(!parsed.success||params.getAll('vehicleId').length!==1||params.getAll('expectedDriverId').length!==1)throw new MobileError(400,'REGULAR_TRUCK_DRIVER_REQUIRED',scopeGuidance);
  try{return mobileJson({services:regularService(await getProviderRegularCapacity(user,parsed.data))});}catch(error){commandFailure(error);}
 } catch (error) { return mobileFailure(error); }
}
export async function POST(request: Request) {
 try { const user = await mobileActor(request);
  if(user.driver_kind==='COMPANY')throw new MobileError(403,'FORBIDDEN','Your fleet owner manages regular service.');
  const body=await mobileBody(request), parsed = regularCommand.safeParse(body);
  if (!regularScope.safeParse(body&&typeof body==='object'?{vehicleId:(body as Record<string,unknown>).vehicleId,expectedDriverId:(body as Record<string,unknown>).expectedDriverId}:{}).success)throw new MobileError(400,'REGULAR_TRUCK_DRIVER_REQUIRED',scopeGuidance);
  if (!parsed.success) throw new MobileError(400, 'INVALID_INPUT', 'Choose the cities and confirm the requested action.');
  const input = parsed.data;
  try { if (input.action === 'REMOVE') await removeProviderRegularCapacity(user, input.id,{vehicleId:input.vehicleId,expectedDriverId:input.expectedDriverId}); else await addProviderRegularCapacity(user, input, input.replaceId); }
  catch (error) { commandFailure(error); }
  return mobileJson({ ok: true });
 } catch (error) { return mobileFailure(error); }
}
