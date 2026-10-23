import {redirect} from 'next/navigation';
import {requireUser} from '../auth';
import {managedBusinessContext} from './business-context.js';
import type {BusinessWorkspaceSummary} from '../business-workspaces/contracts';
export async function requireBusinessWorkspace(permission?:'capacity'|'tracking'|'team'|'owner'){
 const user=await requireUser(undefined,{allowLimited:true});
 const workspace=managedBusinessContext(user) as BusinessWorkspaceSummary|null;
 if(!workspace)redirect('/workspaces');
 if(permission&&!workspace.permissions[permission])redirect('/app/business/account?access=restricted');
 return {user,workspace};
}
