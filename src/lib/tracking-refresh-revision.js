import {createHash} from 'node:crypto';
import {trackingShipmentActiveStatus} from './tracking-refresh-policy.js';

export function trackingRefreshState(shipment){
 if(!shipment||typeof shipment!=='object')throw new Error('TRACKING_REFRESH_MISSING_PROJECTION');
 const status=shipment.operational_status;
 return {
  // The caller supplies only the already authorized, recipient-safe projection.
  // An opaque digest detects route, event, proof, status, or location changes
  // without adding coordinates or contact details to the poll response.
  revision:createHash('sha256').update(JSON.stringify(shipment)).digest('base64url'),
  active:trackingShipmentActiveStatus(status)
 };
}
