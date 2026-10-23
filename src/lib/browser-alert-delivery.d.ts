export type BrowserAlertStatus='OFF'|'ON'|'DENIED'|'UNSUPPORTED'|'UNAVAILABLE';
export type BrowserAlertDelivery={prepare():Promise<BrowserAlertStatus>;toggle():Promise<BrowserAlertStatus>;status():BrowserAlertStatus;enabled():boolean;reconcile(category:'chat'|'handover',hrefs:string[]):Promise<void>;deliver(input:{eventKey:string;body:string;href:string}):Promise<boolean>;dispose():Promise<void>};
export function safeNotificationPath(value:unknown):string|null;
export function createBrowserAlertDelivery(identity:string):BrowserAlertDelivery;
