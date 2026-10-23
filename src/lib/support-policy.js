import {managedBusinessContext} from './identity/business-context.js';
export const PUBLIC_SUPPORT_CLOSED_MESSAGE='Software support is available in your workspace.';
export function isTransportSupportMember(user){return ['TRANSPORTER','DRIVER'].includes(user?.role)||Boolean(managedBusinessContext(user));}
export function canSendSupportMessage(user){return isTransportSupportMember(user)||['ADMIN','SUPPORT'].includes(user?.role);}
