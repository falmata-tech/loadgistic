// Native in-app delivery remains available. Remote phone push requires its own credential/build rollout.
import type {BrowserAlertDelivery} from '../../../../src/lib/browser-alert-delivery.js';
export function browserAlerts(identity:string):BrowserAlertDelivery{void identity;return {prepare:async()=> 'UNSUPPORTED',toggle:async()=> 'UNSUPPORTED',status:()=> 'UNSUPPORTED',enabled:()=>false,reconcile:async()=>{},deliver:async()=>false,dispose:async()=>{}};}
