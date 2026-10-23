import {z} from 'zod';
import {obscureCoordinate,isValidCoordinate} from './location-privacy.js';

export const TELEMATICS_PROTOCOLS=Object.freeze(['gt06','teltonika','h02','jt808']);
export const TELEMATICS_COMMANDS=Object.freeze(['LOCATE','REBOOT','REPORT_INTERVAL','ENGINE_CUT','ENGINE_RESTORE']);
const uuid=z.string().uuid(),revision=z.string().datetime({offset:true});
export const provisionDeviceSchema=z.object({
 ownerOrganizationId:uuid.optional(),ownerProviderProfileId:uuid.optional(),gatewayId:uuid,
 gatewayDeviceId:z.number().int().positive().safe(),imei:z.string().regex(/^[0-9]{15}$/).refine(value=>!/^0+$/.test(value)),
 protocol:z.enum(TELEMATICS_PROTOCOLS),protocolDeviceId:z.string().regex(/^[A-Za-z0-9_-]{5,40}$/),
 label:z.string().trim().min(2).max(100),modelProfile:z.enum(['UNVERIFIED','SYNTHETIC_GT06']).default('UNVERIFIED'),synthetic:z.boolean().default(false)
}).strict().refine(value=>Boolean(value.ownerOrganizationId)!==Boolean(value.ownerProviderProfileId));
export const assignDeviceSchema=z.object({deviceId:uuid,vehicleId:uuid.nullable(),expectedRevision:revision}).strict();
export const selectLocationSchema=z.object({vehicleId:uuid,source:z.enum(['GPS','MOBILE','MANUAL']),expectedRevision:revision,
 precisionKm:z.number().refine(value=>[1,3,5,10,20].includes(value)),
 manualLatitude:z.number().finite().min(-90).max(90).optional(),manualLongitude:z.number().finite().min(-180).max(180).optional()
}).strict().superRefine((value,ctx)=>{
 if(value.source==='MANUAL'&&(value.manualLatitude===undefined||value.manualLongitude===undefined))ctx.addIssue({code:'custom',message:'MANUAL_LOCATION_REQUIRED'});
 if(value.source!=='MANUAL'&&(value.manualLatitude!==undefined||value.manualLongitude!==undefined))ctx.addIssue({code:'custom',message:'UNSELECTED_MANUAL_LOCATION'});
});
export const deviceCommandSchema=z.object({deviceId:uuid,command:z.enum(TELEMATICS_COMMANDS),
 intervalSeconds:z.number().int().min(30).max(3600).optional(),idempotencyKey:uuid,confirmed:z.boolean().optional(),stepUpId:uuid.optional()
}).strict().superRefine((value,ctx)=>{
 if((value.command==='REPORT_INTERVAL')!==(value.intervalSeconds!==undefined))ctx.addIssue({code:'custom',message:'INVALID_REPORT_INTERVAL'});
 if(value.command.startsWith('ENGINE_')&&(!value.confirmed||!value.stepUpId))ctx.addIssue({code:'custom',message:'ENGINE_STEP_UP_REQUIRED'});
});
const attributes=z.object({ignition:z.boolean().optional(),battery:z.number().finite().min(0).max(100).optional(),
 power:z.number().finite().min(0).max(1000).optional(),alarm:z.enum(['sos','powerCut','overspeed','vibration','lowBattery','tampering']).optional()}).strict();
export const normalizedTelemetrySchema=z.object({eventKey:z.string().regex(/^[A-Za-z0-9:_-]{1,120}$/),
 gatewayDeviceId:z.number().int().positive().safe(),protocol:z.enum(TELEMATICS_PROTOCOLS),protocolDeviceId:z.string().regex(/^[A-Za-z0-9_-]{5,40}$/),
 observedAt:revision,receivedAt:revision,valid:z.boolean(),latitude:z.number().finite().min(-90).max(90),longitude:z.number().finite().min(-180).max(180),
 speedKph:z.number().finite().min(0).max(300),course:z.number().finite().min(0).lt(360).nullable().default(null),attributes
}).strict();

/** Validate normalized gateway data without treating an identifier as authentication. */
export function validateTelemetry(input,now=new Date()){
 const fix=normalizedTelemetrySchema.parse(input),stamp=now.getTime(),observed=Date.parse(fix.observedAt),received=Date.parse(fix.receivedAt);
 if(!Number.isFinite(stamp)||received>stamp+120000||observed>stamp+120000||observed>received+120000
  ||received<stamp-30*86400000||observed<stamp-30*86400000)throw new Error('TELEMETRY_TIME_INVALID');
 return fix;
}

/** Only this many-to-one projection may supplement a capacity payload. */
export function approximateTelematicsPosition(latitude,longitude,precisionKm){
 if(!isValidCoordinate(latitude,longitude)||![1,3,5,10,20].includes(precisionKm))throw new Error('INVALID_LOCATION');
 return {...obscureCoordinate(latitude,longitude,precisionKm),precisionKm};
}

/** No real hardware profile is certified by this implementation. */
export function deviceCommandCapability({modelProfile,synthetic},command){
 if(!TELEMATICS_COMMANDS.includes(command))return false;
 return synthetic===true&&modelProfile==='SYNTHETIC_GT06';
}

/** HTTP dispatch is never a hardware acknowledgement. */
export function commandDispatchState(status){
 if(status===200)return 'DISPATCHED';
 if(status===202)return 'UNKNOWN';
 return 'FAILED';
}
