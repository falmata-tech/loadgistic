import {fleetReturnPath} from './fleet-navigation.js';
// Presentation context is never authority. Accept only known provider workspaces.
export function workspaceFormReturnPath(value,fallback='/app/verification'){
 if(typeof value!=='string'||/[\u0000-\u0020\u007f\\]/.test(value))return fallback;
 if(['/app/more#business','/app/more#documents','/app/company-page#documents'].includes(value))return value;
 return fleetReturnPath(value,'')||fallback;
}
