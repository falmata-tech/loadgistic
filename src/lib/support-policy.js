export const PUBLIC_SUPPORT_CLOSED_MESSAGE='Live support is available to transport providers in their dashboard.';
export function isTransportSupportMember(user){return ['TRANSPORTER','DRIVER'].includes(user?.role);}
export function canSendSupportMessage(user){return isTransportSupportMember(user)||['ADMIN','SUPPORT'].includes(user?.role);}
