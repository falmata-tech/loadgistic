import {getCurrentUser} from '@/lib/auth';
import {adminProvisionDevice,assertAdminDemoFixtureBinding,assertPhysicalGatewayAvailable,assertSyntheticGatewayAvailable,getAdminProviderDevices,reconcileAdminProvisionedDevice} from '@/lib/telematics.js';
import {mobileBody,mobileJson,mobileFailure,MobileError} from '@/lib/mobile/server';
import {telematicsFailure} from '@/lib/telematics-http';
import {checkRateLimit} from '@/lib/rate-limit.js';
import {adminDemoIntake,adminDeviceProvisionCommand,adminDeviceRegistrationCommand} from '@/lib/telematics-admin-provision.js';
import {readSyntheticGatewayDevice,registerAdminSpareGatewayDevice,registerPhysicalGatewayDevice} from '@/lib/telematics-gateway-registration.js';
export const runtime='nodejs';
export async function POST(request:Request){
 try{const user=await getCurrentUser();if(!user||user.role!=='ADMIN'||!user.active)throw new MobileError(403,'FORBIDDEN','Administrator access is required.');
  if(!(await checkRateLimit(`device-provision:${user.id}`,10,60000)).allowed)throw new MobileError(429,'PLEASE_WAIT','Please wait before adding more devices.');
  const body=await mobileBody(request);
  const demoGatewayId=process.env.TELEMATICS_DEMO_GATEWAY_ID||'';
  if(body?.mode==='REAL'&&body?.enrollment==='REGISTER'){
   const {model,...registration}=adminDeviceRegistrationCommand(body,process.env.TELEMATICS_DEFAULT_GATEWAY_ID||'',demoGatewayId);
   const ownerId=registration.ownerOrganizationId||registration.ownerProviderProfileId||'';
   await getAdminProviderDevices(user,ownerId,registration.ownerOrganizationId?'ORGANIZATION':'PROVIDER_PROFILE',1);
   await assertPhysicalGatewayAvailable(user,registration.gatewayId);
   const gatewayDeviceId=await registerPhysicalGatewayDevice({...registration,model});
   const command={...registration,gatewayDeviceId};
   const prior=await reconcileAdminProvisionedDevice(user,command);
   if(prior)return mobileJson({ok:true,result:prior});
   try{return mobileJson({ok:true,result:await adminProvisionDevice(user,command)});}
   catch{
    const after=await reconcileAdminProvisionedDevice(user,command);
    if(after)return mobileJson({ok:true,result:after});
    throw new Error('GATEWAY_REGISTRATION_PENDING_LINK');
   }
  }
  const intake=adminDemoIntake(body,demoGatewayId);
  const fixture=await assertAdminDemoFixtureBinding(user,{...intake,protocol:'gt06',protocolDeviceId:intake.imei,synthetic:true});
  await assertSyntheticGatewayAvailable(user,demoGatewayId);
  const gatewayDeviceId=fixture.registration==='CREATE'
   ?await registerAdminSpareGatewayDevice(demoGatewayId)
   :await readSyntheticGatewayDevice(demoGatewayId,intake.imei);
  const command=adminDeviceProvisionCommand({mode:'DEMO',...intake,gatewayDeviceId,
   protocolDeviceId:intake.imei,label:fixture.label},demoGatewayId);
  const prior=await reconcileAdminProvisionedDevice(user,command);
  if(prior)return mobileJson({ok:true,result:prior});
  try{return mobileJson({ok:true,result:await adminProvisionDevice(user,command)});}
  catch{
   const after=await reconcileAdminProvisionedDevice(user,command);
   if(after)return mobileJson({ok:true,result:after});
   throw new Error('GATEWAY_REGISTRATION_PENDING_LINK');
  }
 }catch(error){return mobileFailure(telematicsFailure(error));}
}
