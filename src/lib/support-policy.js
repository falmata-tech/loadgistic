import {managedBusinessContext} from './identity/business-context.js';
export const PUBLIC_SUPPORT_CLOSED_MESSAGE='Software support is available in your workspace.';
export function isTransportSupportMember(user){return ['TRANSPORTER','DRIVER'].includes(user?.role) || Boolean(managedBusinessContext(user))
 || Boolean(user?.id && user.active === true && ['SHIPPER','RECEIVER'].includes(user.role) && (user.platform_role || user.role) === user.role);}
export function canSendSupportMessage(user){return isTransportSupportMember(user)||['ADMIN','SUPPORT'].includes(user?.role);}

const supportCategoryLabels={ACCOUNT:'Account',VERIFICATION:'Verification',LOAD_TRACKING:'Shipment & tracking',
 CAPACITY:'Capacity',GPS_SETUP:'GPS device setup',PAYMENT:'Other',OTHER:'Other'};
export function supportCategoryName(value){return supportCategoryLabels[value]||'Other';}
