import {createHash} from 'node:crypto';
import {pilotUuid,PRODUCTION_PILOT_SOURCE} from './production-pilot-policy.mjs';
import {DEMO_MOTION_COHORT} from '../src/lib/demo-motion-cohort.js';

export const DEMO_PILOT_SOURCE=PRODUCTION_PILOT_SOURCE;
export const DEMO_PILOT_TARGETS=Object.freeze(['company-truck','personal-truck',
 'fleet-01','fleet-02','fleet-04','fleet-05','fleet-07']);

function localUuid(key){
 const b=createHash('sha256').update(`loadgistic-fixture:${key}`).digest().subarray(0,16);
 b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;
 const h=b.toString('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

// Preparation only: names/metadata never substitute for these exact existing
// vehicle and owner scopes. This module performs no I/O or hosted mutation.
export function demoPilotBindingPlan(){
 return Object.entries(DEMO_MOTION_COHORT).map(([target,c])=>{
  const personal=target==='personal-truck',company=target==='company-truck';
  const vehicleKey=c.vehicleFixtureKey||(personal?'veh-driver-1':'veh-trans-1');
  const organizationKey=c.organizationFixtureKey||(company?'org-transporter':null);
  const providerKey=personal?'provider-driver':null;
  const scope=uuid=>({vehicleId:uuid(vehicleKey),organizationId:organizationKey?uuid(organizationKey):null,
   providerProfileId:providerKey?uuid(providerKey):null});
  const local=scope(localUuid);
  if(local.vehicleId!==c.vehicleId)throw Error('DEMO_PILOT_SOURCE_DRIFT');
  return {target,eligible:DEMO_PILOT_TARGETS.includes(target),vehicleKey,
   ownerKey:c.ownerFixtureKey||(personal?'user-driver':'user-transporter'),
   driverKeys:c.driverFixtureKey?[c.driverFixtureKey]:personal?['user-driver']:['user-company-driver','user-transporter'],
   imei:c.imei,source:c.source,latitude:c.latitude,longitude:c.longitude,
   slot:company?1:personal?2:Number(target.slice(-2))+2,local,pilot:scope(pilotUuid)};
 });
}
