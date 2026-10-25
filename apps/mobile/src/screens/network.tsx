import {BusinessCapacitySharing,type BusinessCapacityGrant} from '../components/business-capacity-sharing';
import {AccountVehicleSharing,type AccountVehicleGrant} from '../components/account-vehicle-sharing';
import type {AccountConnection} from '../../../../src/lib/account-directory';
import {AccountDirectoryNative} from '../components/account-directory';
import {WorkspaceTabs,WorkspaceTaskPane} from '../components/workspace-task';
import {capacitySharingLabel} from '../../../../src/lib/capacity-sharing';
import {useLanguage} from '../localization/provider';
import { ProfileSetup } from '../components/profile-setup';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { Redirect } from 'expo-router';
import { useAccount } from '../session/provider';
import { useAccountQuery } from '../hooks/account-query';
import { Page, Card, Title, Copy, Field, Button, ErrorText, LoadingSpinner } from '../components/ui';
type Truck = { id: string; label: string; driver: string; sharingMode: string; businessGrants?:BusinessCapacityGrant[]; accountGrants?:AccountVehicleGrant[] };
export default function Network() {
 const account = useAccount();
 if (account.busy) return <Page><LoadingSpinner /></Page>;
 if (!account.session) return <Redirect href="/account" />;
 if(account.session.user.role==='CUSTOMER')return <Redirect href="/directory"/>;
 return <ProviderNetwork/>;
}
function ProviderNetwork(){
 const account=useAccount(),query=useAccountQuery<{ profilePublished: boolean | null; vehicles: Truck[] }>('/api/mobile/network'),relationships=useAccountQuery<{items:AccountConnection[]}>('/api/account-connections'),[view,setView]=useState('FIND'),[vehicleSearch,setVehicleSearch]=useState(''),[selectedVehicleId,setSelectedVehicleId]=useState('');
 if(account.session?.user.operatingModel==='COMPANY_DRIVER'){
  if(query.loading)return <Page><LoadingSpinner/></Page>;
  if(query.data&&!query.data.vehicles.length)return <Page><Title message="Network"/><Copy message="Ask your fleet owner to assign a vehicle before sharing capacity."/></Page>;
 }
 const matches=(query.data?.vehicles||[]).filter(vehicle=>`${vehicle.label} ${vehicle.driver}`.toLowerCase().includes(vehicleSearch.trim().toLowerCase()));
 const selected=matches.find(vehicle=>vehicle.id===selectedVehicleId)||matches[0];
 return <Page><Title message="Network"/><WorkspaceTabs value={view} items={[{id:'FIND',message:'Find accounts'},{id:'CONNECTIONS',message:'Connections'},{id:'SHARED',message:'Vehicle sharing'}]} onChange={setView}/><WorkspaceTaskPane active={view==='FIND'}><AccountDirectoryNative view="FIND"/></WorkspaceTaskPane><WorkspaceTaskPane active={view==='CONNECTIONS'}><AccountDirectoryNative view="CONNECTIONS" onShareVehicles={()=>setView('SHARED')}/></WorkspaceTaskPane><WorkspaceTaskPane active={view==='SHARED'}><ErrorText message={query.error}/>{!!query.error&&<Button secondary message="Retry" onPress={() => { void query.reload(); }}/>}
  {query.data?.profilePublished===false&&<ProfileSetup published={false} />}{query.data?.vehicles.length === 0 && <Copy message={"No vehicles are available to manage here. Add your vehicle or ask your fleet owner to enable capacity management."}/>}
  {!!query.data?.vehicles.length&&<><Field message="Find a vehicle" value={vehicleSearch} onChangeText={setVehicleSearch} placeholder="Number, model or driver" maxLength={80}/><ScrollView horizontal showsHorizontalScrollIndicator style={{flexGrow:0}} contentContainerStyle={{gap:8,paddingVertical:4}}>{matches.map(vehicle=><Button key={vehicle.id} secondary={selected?.id!==vehicle.id} label={vehicle.label.split(' · ').at(-1)||vehicle.label} onPress={()=>setSelectedVehicleId(vehicle.id)}/>)}</ScrollView>{!matches.length?<Copy message="No vehicles match this search."/>:null}</>}
  {selected?<Sharing key={selected.id} truck={selected} reload={query.reloadConfirmed} connections={relationships.data?.items||[]} />:null}
  </WorkspaceTaskPane>
 </Page>;
}
function Sharing({ truck, reload, connections }: { truck: Truck; reload: () => Promise<boolean>; connections:AccountConnection[] }) {
 const {t}=useLanguage();
 return <Card><Title>{truck.label}</Title><Copy>{truck.driver || t('No driver assigned')} · {t(capacitySharingLabel(truck.sharingMode))}</Copy>
  <AccountVehicleSharing vehicleId={truck.id} exclusive={truck.sharingMode==='EXCLUSIVE'} connections={connections} grants={truck.accountGrants||[]} reload={reload}/>
  <BusinessCapacitySharing vehicleId={truck.id} exclusive={truck.sharingMode==='EXCLUSIVE'} grants={truck.businessGrants||[]} reload={reload}/>
 </Card>;
}
