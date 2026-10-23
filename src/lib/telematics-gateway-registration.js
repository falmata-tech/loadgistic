import {loadGatewayConfigurations,verifyGatewayDevice} from './telematics-gateway-auth.js';
import {DEMO_ADMIN_SPARE} from './demo-admin-spare.js';

async function jsonResponse(response){
 if(Number(response.headers.get('content-length')||0)>16384||!response.body)throw new Error('GATEWAY_REGISTRATION_UNAVAILABLE');
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;
  if(size>16384){await reader.cancel();throw new Error('GATEWAY_REGISTRATION_UNAVAILABLE');}chunks.push(part.value);}}
 finally{reader.releaseLock();}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new Error('GATEWAY_REGISTRATION_UNAVAILABLE');}
}
async function request(config,path,method='GET',body){
 return fetch(new URL(path,config.apiUrl.endsWith('/')?config.apiUrl:`${config.apiUrl}/`),{
  method,headers:{Authorization:`Bearer ${config.apiToken}`,Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(5000),redirect:'error',cache:'no-store'});
}
function exact(device,command){
 return Number.isSafeInteger(device?.id)&&device.id>0&&!device.disabled&&device.uniqueId===command.protocolDeviceId
  &&device.name===command.label&&device.model===command.model
  &&device.attributes?.['loadgistic.imei']===command.imei
  &&device.attributes?.['loadgistic.protocol']===command.protocol
  &&device.attributes?.['loadgistic.synthetic']===command.synthetic;
}
/** Reuse only the exact binding. Ambiguous writes remain at the gateway for explicit retry/reconciliation. */
async function registerGatewayDevice(command,configurations){
 const config=configurations.find(row=>row.id===command.gatewayId);
 if(!config)throw new Error('GATEWAY_REGISTRATION_UNAVAILABLE');
 const lookup=async()=>{
  const url=new URL('devices',config.apiUrl.endsWith('/')?config.apiUrl:`${config.apiUrl}/`);
  url.searchParams.set('uniqueId',command.protocolDeviceId);
  const response=await request(config,url.href);
  if(!response.ok)throw new Error('GATEWAY_REGISTRATION_UNAVAILABLE');
  const matches=await jsonResponse(response);
  if(!Array.isArray(matches)||matches.length>1)throw new Error('DEVICE_BINDING_CONFLICT');
  if(matches.length&&!exact(matches[0],command))throw new Error('DEVICE_BINDING_CONFLICT');
  return matches[0]||null;
 };
 let device=await lookup();
 if(!device){
  let response;
  try{response=await request(config,'devices','POST',{name:command.label,uniqueId:command.protocolDeviceId,
   model:command.model,attributes:{'loadgistic.imei':command.imei,'loadgistic.protocol':command.protocol,'loadgistic.synthetic':command.synthetic}});}
  catch{response=null;}
  if(response?.ok){try{device=await jsonResponse(response);}catch{throw new Error('GATEWAY_REGISTRATION_PENDING_LINK');}
   if(!exact(device,command))throw new Error('GATEWAY_REGISTRATION_PENDING_LINK');}
  else{
   try{device=await lookup();}catch(error){if(error instanceof Error&&error.message==='DEVICE_BINDING_CONFLICT')throw error;}
   if(!device)throw new Error(response?.status===401||response?.status===403?'GATEWAY_REGISTRATION_UNAVAILABLE':'GATEWAY_REGISTRATION_PENDING_LINK');
  }
 }
 try{await verifyGatewayDevice({...command,gatewayDeviceId:device.id},configurations);}
 catch{throw new Error('GATEWAY_REGISTRATION_PENDING_LINK');}
 return device.id;
}
export async function registerPhysicalGatewayDevice(command,configurations=loadGatewayConfigurations()){
 if(command.synthetic!==false)throw new Error('GATEWAY_REGISTRATION_UNAVAILABLE');
 return registerGatewayDevice(command,configurations);
}

/** Only the immutable spare fixture can be created on the synthetic gateway. */
export async function registerAdminSpareGatewayDevice(gatewayId,configurations=loadGatewayConfigurations()){
 if(!gatewayId)throw new Error('DEMO_GATEWAY_UNAVAILABLE');
 return registerGatewayDevice({gatewayId,imei:DEMO_ADMIN_SPARE.imei,
  protocolDeviceId:DEMO_ADMIN_SPARE.imei,protocol:'gt06',label:DEMO_ADMIN_SPARE.label,
  model:DEMO_ADMIN_SPARE.model,synthetic:true},configurations);
}

/** Read a pre-registered fictional binding; never create arbitrary synthetic IDs. */
export async function readSyntheticGatewayDevice(gatewayId,imei,configurations=loadGatewayConfigurations()){
 const config=configurations.find(row=>row.id===gatewayId);
 if(!config||!/^[0-9]{15}$/.test(imei))throw new Error('DEMO_FIXTURE_UNAVAILABLE');
 const url=new URL('devices',config.apiUrl.endsWith('/')?config.apiUrl:`${config.apiUrl}/`);
 url.searchParams.set('uniqueId',imei);
 const response=await request(config,url.href);
 if(!response.ok)throw new Error('DEMO_GATEWAY_UNAVAILABLE');
 const matches=await jsonResponse(response);
 if(!Array.isArray(matches)||matches.length!==1||!Number.isSafeInteger(matches[0]?.id)||matches[0].id<1
  ||matches[0].disabled||matches[0].uniqueId!==imei||matches[0].attributes?.['loadgistic.imei']!==imei
  ||matches[0].attributes?.['loadgistic.protocol']!=='gt06'||matches[0].attributes?.['loadgistic.synthetic']!==true)
  throw new Error('DEMO_FIXTURE_UNAVAILABLE');
 return matches[0].id;
}
