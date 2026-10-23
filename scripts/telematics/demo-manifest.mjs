import {DEMO_MOTION_COHORT,DEMO_MOTION_FLEET_TARGETS} from '../../src/lib/demo-motion-cohort.js';
import {DEMO_ADMIN_SPARE} from '../../src/lib/demo-admin-spare.js';

// Fictional tracker identifiers only. Never derive demo targets from customer data.
export const DEMO_DEVICES=Object.freeze([
 {imei:'990000000000001',protocol:'gt06',protocolDeviceId:'990000000000001',label:'Synthetic GPS one',latitude:9.031,longitude:38.748},
 {imei:'990000000000002',protocol:'gt06',protocolDeviceId:'990000000000002',label:'Synthetic GPS two',latitude:8.542,longitude:39.273}
]);
export const DEMO_GPS_COHORT_DEVICES=Object.freeze(DEMO_MOTION_FLEET_TARGETS.map(name=>{
 const {imei,latitude,longitude}=DEMO_MOTION_COHORT[name];
 return Object.freeze({imei,protocol:'gt06',protocolDeviceId:imei,label:`Synthetic fleet GPS ${name.slice(-2)}`,latitude,longitude});
}));
export const DEMO_ADMIN_SPARE_DEVICE=Object.freeze({imei:DEMO_ADMIN_SPARE.imei,protocol:'gt06',
 protocolDeviceId:DEMO_ADMIN_SPARE.imei,label:DEMO_ADMIN_SPARE.label,latitude:9.038,longitude:38.752});
export function assertDemoDevice(imei){const device=[...DEMO_DEVICES,...DEMO_GPS_COHORT_DEVICES,DEMO_ADMIN_SPARE_DEVICE].find(row=>row.imei===imei);if(!device)throw new Error('DEMO_DEVICE_NOT_ALLOWLISTED');return device;}
export function assertLoopback(value){const url=new URL(value);if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||url.username||url.password)throw new Error('REMOTE_TELEMATICS_DEMO_REFUSED');return url;}
const originalEmails=Object.freeze({'user-admin':'admin@loadgistic.local','user-transporter':'transporter@loadgistic.local','user-driver':'driver@loadgistic.local',
 ...Object.fromEntries(DEMO_MOTION_FLEET_TARGETS.map(name=>{
  const index=name.slice(-2);return [`user-public-fleet-${index}`,`owner-${index}@providers.loadgistic.test`];})),
 ...Object.fromEntries(DEMO_MOTION_FLEET_TARGETS.map(name=>{
  const {driverFixtureKey}=DEMO_MOTION_COHORT[name],index=driverFixtureKey.slice(-3);
  return [driverFixtureKey,`driver-${index}@providers.loadgistic.test`];}))});
/** Marker plus exact fixture key and owner-authorized mailbox; never arbitrary users. */
export function assertDemoIdentity(user,fixtureKey){
 const original=originalEmails[fixtureKey],email=String(user?.email||'').toLowerCase();
 const ownerAlias=/^falmatad97\+[a-z0-9][a-z0-9._-]{0,80}@gmail\.com$/.test(email);
 if(!original||user?.app_metadata?.fixture_source!=='loadgistic'||user?.user_metadata?.fixture_key!==fixtureKey
  ||!(email===original||ownerAlias||fixtureKey==='user-admin'&&email==='falmata.dawano@gmail.com'))throw new Error('DEMO_IDENTITY_NOT_ALLOWLISTED');
 return user;
}
