export type HandoverAlert={id:string;approvedAt:string;approvalKind:'OWNER'|'STAFF';unread:boolean};
export type HandoverAlertSnapshot={unreadCount:number;items:HandoverAlert[]};
export function handoverAlertInput(value:unknown):{id:string;approvedAt:string};
export function handoverAlertSnapshot(value:unknown):HandoverAlertSnapshot;
export function handoverAlertCopy(item:HandoverAlert):string;
export function handoverAlertHref(item:HandoverAlert):string;
export function createHandoverAlertTracker():{reset():void;next(snapshot:HandoverAlertSnapshot):HandoverAlert[]};
