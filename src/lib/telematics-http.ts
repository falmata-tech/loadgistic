import {z} from 'zod';
import {MobileError} from './mobile/server';
import {assignOwnedDevice,selectVehicleLocationSource,requestDeviceCommand} from './telematics.js';
import {checkRateLimit} from './rate-limit.js';
import type {ManagedCurrentUser} from './identity/supabase';
const envelope=z.object({action:z.enum(['ASSIGN','SOURCE','COMMAND']),input:z.record(z.unknown())}).strict();
const messages:Record<string,[number,string]>={
 FORBIDDEN:[403,'You do not have permission for this fleet change.'],
 NOT_FOUND:[404,'This device or vehicle is not available.'],
 TELEMATICS_CHANGED:[409,'This vehicle or device changed. Refresh before saving again.'],
 DEVICE_BINDING_CONFLICT:[409,'This GPS device is already registered.'],
 DEVICE_OWNER_INVALID:[400,'Choose an active transport provider.'],
 DEVICE_UNAVAILABLE:[409,'This GPS device is unavailable.'],
 DEVICE_NOT_ASSIGNED:[409,'Assign a GPS device to this vehicle first.'],
 DEVICE_COMMAND_UNSUPPORTED:[409,'This command is not supported by this device.'],
 ENGINE_CONTROL_UNAVAILABLE:[409,'Engine control is not enabled for this installation.'],
 ENGINE_STEP_UP_REQUIRED:[403,'Verify your identity again before controlling the engine.'],
 ENGINE_INTERLOCK_DENIED:[409,'The device cannot confirm that engine control is safe.'],
 COMMAND_RATE_LIMITED:[429,'Please wait before sending another device command.'],
 LOCATION_SOURCE_PENDING:[409,'Waiting for a current position from the selected source.'],
 DRIVER_LOCATION_CHOICE_LOCKED:[409,'The assigned driver chose a manual location. Ask them to change it before switching sources.'],
 INVALID_TELEMATICS_INPUT:[400,'Check the selected location and accuracy.'],
};
export function telematicsFailure(error:unknown):MobileError{
 if(error instanceof MobileError)return error;
 if(error instanceof z.ZodError)return new MobileError(400,'INVALID_INPUT','Check the device and location details.');
 const code=error instanceof Error?error.message:'';
 const known=messages[code];
 return known?new MobileError(known[0],code,known[1]):new MobileError(503,'UNAVAILABLE','Fleet devices are temporarily unavailable. Please try again.');
}
export async function mutateTelematics(user:ManagedCurrentUser,body:unknown){
 const {action,input}=envelope.parse(body);
 if(!(await checkRateLimit(`fleet-devices:${user.id}`,30,60000)).allowed)throw new MobileError(429,'PLEASE_WAIT','Please wait before making more changes.');
 if(action==='ASSIGN')return assignOwnedDevice(user,input);
 if(action==='SOURCE')return selectVehicleLocationSource(user,input);
 return requestDeviceCommand(user,input);
}
