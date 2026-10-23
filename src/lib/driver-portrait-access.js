import {providerWorkspaceCapabilities} from './provider-workspace.js';
// HTTP admission follows the current identity projection. The storage RPC repeats
// persisted driver eligibility before reading/reserving/removing any portrait.
export function canManageOwnDriverPortrait(actor){
 if(actor?.active!==true)return false;
 if(actor.role==='DRIVER')return true;
 const capability=providerWorkspaceCapabilities(actor);
 return actor.role==='TRANSPORTER'&&capability.ownsProviderAccount&&capability.drivesTruck;
}
