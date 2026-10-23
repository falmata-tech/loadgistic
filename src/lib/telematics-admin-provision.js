import {provisionDeviceSchema} from './telematics-contract.js';
import {z} from 'zod';

/** Admin-initiated physical enrollment cannot choose its gateway or synthetic state. */
export function adminDeviceRegistrationCommand(input,realGatewayId,demoGatewayId){
 if(!input||typeof input!=='object'||Array.isArray(input)||input.mode!=='REAL'||input.enrollment!=='REGISTER'
  ||!realGatewayId||realGatewayId===demoGatewayId||input.gatewayId!==undefined||input.gatewayDeviceId!==undefined
  ||input.synthetic!==undefined||input.modelProfile!==undefined||input.protocol!=='gt06')throw new Error('INVALID_DEVICE_PROVISION');
 const {mode,enrollment,model,...fields}=input;
 const hardwareModel=z.string().trim().min(2).max(80).parse(model);
 const checked=provisionDeviceSchema.parse({...fields,gatewayId:realGatewayId,gatewayDeviceId:1,
  synthetic:false,modelProfile:'UNVERIFIED'});
 const {gatewayDeviceId:_,...command}=checked;
 return {...command,model:hardwareModel};
}

/** Demo submissions carry only a fixture choice; binding identity comes from the server. */
export function adminDemoIntake(input,demoGatewayId){
 if(!input||typeof input!=='object'||Array.isArray(input)||input.mode!=='DEMO'||!demoGatewayId
  ||Object.keys(input).some(key=>!['mode','ownerOrganizationId','ownerProviderProfileId','imei'].includes(key)))
  throw new Error('INVALID_DEVICE_PROVISION');
 const checked=provisionDeviceSchema.parse({ownerOrganizationId:input.ownerOrganizationId,
  ownerProviderProfileId:input.ownerProviderProfileId,gatewayId:demoGatewayId,gatewayDeviceId:1,
  imei:input.imei,protocol:'gt06',protocolDeviceId:input.imei,label:'Demo GPS device',synthetic:true,modelProfile:'SYNTHETIC_GT06'});
 return {ownerOrganizationId:checked.ownerOrganizationId,ownerProviderProfileId:checked.ownerProviderProfileId,imei:checked.imei};
}

/** Keep the simulator identity server-owned; a submitted identifier is never proof of ownership. */
export function adminDeviceProvisionCommand(input,demoGatewayId){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('INVALID_DEVICE_PROVISION');
 const {mode,synthetic,modelProfile,...fields}=input;
 if(synthetic!==undefined||modelProfile!==undefined)throw new Error('INVALID_DEVICE_PROVISION');
 if(mode!=='DEMO')throw new Error('INVALID_DEVICE_PROVISION');
 if(!demoGatewayId)throw new Error('DEMO_GATEWAY_UNAVAILABLE');
 if(fields.gatewayId!==undefined||fields.protocol!==undefined&&fields.protocol!=='gt06')throw new Error('INVALID_DEVICE_PROVISION');
 return provisionDeviceSchema.parse({...fields,gatewayId:demoGatewayId,protocol:'gt06',synthetic:true,modelProfile:'SYNTHETIC_GT06'});
}
