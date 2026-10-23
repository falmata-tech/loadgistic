import * as Crypto from 'expo-crypto';
import * as Storage from '../session/storage';
import {apiRequest} from '../api/http';
import {createPhoneInstallationController,parseLocationBinding,type LocationBinding,type LocationRequest,type LocationIdentity} from './phone-installation-controller';
const identityKey='loadgistic.location.installation.v1',legacyKey='loadgistic.shipment.location.device.v1',bindingKey='loadgistic.location.binding.v1',pendingKey='loadgistic.location.revocations.v1';
let writes:Promise<unknown>=Promise.resolve();
function serial<T>(work:()=>Promise<T>){const next=writes.then(work,work);writes=next.catch(()=>undefined);return next;}
const options={keychainAccessible:Storage.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY};
async function identity():Promise<LocationIdentity>{return serial(async()=>{
 const raw=await Storage.getItemAsync(identityKey);if(raw){const value=JSON.parse(raw) as LocationIdentity;if(!/^[a-f0-9-]{36}$/i.test(value.installationId)||!/^[a-f0-9]{64}$/.test(value.secret))throw Error('Phone location identity needs attention.');return value;}
 const saved=await Storage.getItemAsync(legacyKey),installationId=saved&&/^[a-f0-9-]{36}$/i.test(saved)?saved:Crypto.randomUUID();
 const secret=Array.from(await Crypto.getRandomBytesAsync(32),byte=>byte.toString(16).padStart(2,'0')).join('');const value={installationId,secret};
 await Storage.setItemAsync(identityKey,JSON.stringify(value),options);await Storage.setItemAsync(legacyKey,installationId,options);return value;
 });}
async function bindings(key:string){const raw=await Storage.getItemAsync(key);if(!raw)return[];const value:unknown=JSON.parse(raw);if(!Array.isArray(value))throw Error('Phone location cleanup needs attention.');return value.map(item=>parseLocationBinding(item));}
const controller=createPhoneInstallationController({now:Date.now,uuid:Crypto.randomUUID,identity,
 read:async()=>{const raw=await Storage.getItemAsync(bindingKey);return raw?parseLocationBinding(JSON.parse(raw)):null;},
 write:async(binding:LocationBinding|null)=>{if(binding)await Storage.setItemAsync(bindingKey,JSON.stringify(binding),options);else await Storage.deleteItemAsync(bindingKey);},
 pending:()=>bindings(pendingKey),savePending:value=>Storage.setItemAsync(pendingKey,JSON.stringify(value),options),
 release:body=>apiRequest('/api/mobile/location/installation',{body}),
});
export function configurePhoneLocation(actor:string,request:LocationRequest|null,stop?:()=>Promise<void>){controller.setAccount(actor,request,stop);}
export const preparePhoneLocation=()=>controller.prepare();
export const releasePhoneLocation=()=>controller.release();
export const locationInstallationIdentity=identity;
