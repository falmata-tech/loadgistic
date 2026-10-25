import Link from 'next/link';
import {MapPinned,Network} from 'lucide-react';
import {AccountNetwork} from '@/components/account-network';
import {VehicleSharingBoard,type SharingVehicle} from '@/components/vehicle-sharing-board';
import {Text} from '@/components/localization';
import {requireUser} from '@/lib/auth';
import {listPrivateCapacityNetwork} from '@/lib/private-capacity.js';
import {PageHeader} from '@/components/page-header';
import {Flash} from '@/components/flash';
import {FleetSetupEmpty} from '@/components/fleet-setup-empty';
import {providerWorkspaceCapabilities} from '@/lib/provider-workspace.js';
import {accountDirectoryPort} from '@/lib/account-directory';

export default async function DirectoryPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const user=await requireUser(['TRANSPORTER','DRIVER','CUSTOMER'],{allowLimited:true});
 const query=await searchParams,provider=user.role!=='CUSTOMER';
 const vehicles=provider?await listPrivateCapacityNetwork(user) as SharingVehicle[]:[];
 if(user.driver_kind==='COMPANY'&&!vehicles.length)return <div className="page private-capacity-network"><PageHeader icon={Network} title={<Text message="Network"/>}/><FleetSetupEmpty companyDriver fleetOwner={false}/></div>;
 const connections=provider?(await accountDirectoryPort().connections(user.id)).filter(item=>item.status==='ACCEPTED'):[];
 return <div className="page private-capacity-network">
  <PageHeader icon={Network} title={<Text message="Network"/>} action={!provider?<Link className="button secondary small" href="/?view=private"><MapPinned aria-hidden="true"/><Text message="Shared with you"/></Link>:undefined}/>
  <Flash error={query.error} success={query.success}/>
  <AccountNetwork canShareVehicles={provider} initialView={query.view==='vehicles'?'VEHICLES':'FIND'}>
   {vehicles.length?<VehicleSharingBoard vehicles={vehicles} connections={connections}/>:provider?<FleetSetupEmpty companyDriver={user.driver_kind==='COMPANY'} fleetOwner={providerWorkspaceCapabilities(user).canManageFleet}/>:null}
  </AccountNetwork>
 </div>;
}
