import {BusinessCapacitySharing,type BusinessCapacityGrant} from '../components/business-capacity-sharing';
import {BusinessDirectory} from '../components/business-directory';
import {WorkspaceTabs,WorkspaceTaskPane} from '../components/workspace-task';
import {capacitySharingLabel} from '../../../../src/lib/capacity-sharing';
import {useLanguage} from '../localization/provider';
import { ProfileSetup } from '../components/profile-setup';
import { useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import {ConfirmationButton} from '../components/confirmation-button';
import { Redirect } from 'expo-router';
import { useAccount } from '../session/provider';
import { useAccountQuery } from '../hooks/account-query';
import { Page, Card, Title, Copy, Field, Button, ErrorText } from '../components/ui';
type Truck = { id: string; label: string; driver: string; sharingMode: string; exclusiveEmail: string; businessGrants?:BusinessCapacityGrant[]; grants: { id: string; name: string; email: string; addedBy: string }[] };
export default function Network() {
 const account = useAccount(), query = useAccountQuery<{ profilePublished: boolean | null; vehicles: Truck[] }>('/api/mobile/network'),[view,setView]=useState('SHARED');
 if (account.busy) return <Page><ActivityIndicator /></Page>;
 if (!account.session) return <Redirect href="/account" />;
 return <Page><Title message="Network"/><WorkspaceTabs value={view} items={[{id:'SHARED',message:'Shared with'},{id:'DIRECTORY',message:'Find businesses'}]} onChange={setView}/><WorkspaceTaskPane active={view==='DIRECTORY'}><BusinessDirectory key={account.session.user.id}/></WorkspaceTaskPane><WorkspaceTaskPane active={view==='SHARED'}><Copy message={"Share privately with the brokers and customers you work with. Each email gets access only to the vehicles you choose."}/><ErrorText message={query.error} /><Button secondary message="Refresh sharing" busy={query.loading} onPress={() => { void query.reload(); }} />
  <ProfileSetup published={query.data?.profilePublished} />{query.data?.vehicles.length === 0 && <Copy message={"No vehicles are available to manage here. Add your vehicle or ask your fleet owner to enable capacity management."}/>}
  {query.data?.vehicles.map(truck => <Sharing key={truck.id} truck={truck} reload={query.reloadConfirmed} />)}
  </WorkspaceTaskPane>
 </Page>;
}
function Sharing({ truck, reload }: { truck: Truck; reload: () => Promise<boolean> }) {
 const {t}=useLanguage();
 const account = useAccount(), lock = useRef(false), [adding,setAdding]=useState(false), [name, setName] = useState(''), [email, setEmail] = useState(''), [editing,setEditing]=useState<Truck['grants'][number]|null>(null),[editName,setEditName]=useState(''), [committed,setCommitted]=useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
 const disabled=busy||committed;
 async function confirmSaved(){
  const confirmed=await reload();
  if(!confirmed){setMessage(t('Your change was saved. Reload to see the latest details.'));return;}
  setEmail('');setName('');setAdding(false);setEditing(null);setCommitted(false);setMessage(t('Sharing updated.'));
 }
 async function save(body: unknown) {
  if(lock.current||committed)return;lock.current=true;setBusy(true);setError('');setMessage('');
  try{await account.request('/api/mobile/network',body);setCommitted(true);await confirmSaved();}
  catch(error){setError(error instanceof Error?error.message:'Could not confirm the change. Refresh sharing before trying again.');}
  finally{lock.current=false;setBusy(false);}
 }
 async function retryRead(){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await confirmSaved();}catch{setError(t('Your change was saved. Reload to see the latest details.'));}finally{lock.current=false;setBusy(false);}}

 return <Card><Title>{truck.label}</Title><Copy>{truck.driver || t('No driver assigned')}</Copy><Copy>{t(capacitySharingLabel(truck.sharingMode))}</Copy><Copy message="Saved contacts get access only when the vehicle’s sharing setting allows them."/>{adding?<View style={{gap:10,marginTop:12}} aria-label={t('Add contact')}><Field message="Person or company name" value={name} onChangeText={setName} maxLength={100} editable={!disabled}/><Field message="Share capacity with this email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" editable={!disabled&&truck.sharingMode!=='EXCLUSIVE'} /><Button message="Add access" busy={busy} disabled={disabled||!name.trim()||!email.trim()||(truck.sharingMode==='EXCLUSIVE'&&email.trim().toLowerCase()!==truck.exclusiveEmail)} onPress={()=>{void save({action:'GRANT',vehicleId:truck.id,email:email.trim(),name:name.trim()});}}/><Button secondary message="Cancel" disabled={disabled} onPress={()=>{setAdding(false);setName('');setEmail('');setError('');}}/></View>:<Button secondary message="Add contact" disabled={disabled} onPress={()=>{setAdding(true);setName('');setEmail(truck.sharingMode==='EXCLUSIVE'?truck.exclusiveEmail:'');}}/>}
  <Copy message={"They verify this email when opening privately shared capacity. The vehicle’s shared location area stays the same."}/>
  {truck.grants.map(grant => <View key={grant.id} testID={'capacity-contact-'+grant.id} style={{ gap: 8, paddingVertical: 8 }}><Copy>{grant.name||grant.email}</Copy>{!!grant.name&&<Copy>{grant.email}</Copy>}<Copy>{t('Added by {name}',{name:grant.addedBy})}</Copy>{editing?.id===grant.id?<View style={{gap:8}}><Field message="Person or company name" value={editName} onChangeText={setEditName} maxLength={100} editable={!disabled}/><Button message="Save name" disabled={disabled||!editName.trim()} busy={busy} onPress={()=>{void save({action:'NAME',grantId:grant.id,name:editName.trim()});}}/><Button secondary message="Cancel" disabled={disabled} onPress={()=>setEditing(null)}/><ErrorText message={error}/></View>:<Button secondary message="Edit name" disabled={disabled} onPress={()=>{setEditing(grant);setEditName(grant.name);setError('');setMessage('');}}/>}<ConfirmationButton message="Remove" disabled={committed} busy={busy} title="Remove capacity access?" detail="This email will no longer see this vehicle in privately shared capacity." cancel="Keep access" confirm="Remove access" onConfirm={()=>{void save({action:'REVOKE',grantId:grant.id});}}/></View>)}
  {!truck.grants.length && <Copy message={"No email access added for this vehicle."}/>}
  <BusinessCapacitySharing vehicleId={truck.id} exclusive={truck.sharingMode==='EXCLUSIVE'} grants={truck.businessGrants||[]} reload={reload}/>
  <ErrorText message={error} />{!!message && <Copy>{message}</Copy>}{committed&&<Button secondary message="Reload saved change" busy={busy} onPress={()=>{void retryRead();}}/>}
 </Card>;
}
