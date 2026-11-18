import {useCallback,useState} from 'react';
import {View} from 'react-native';
import {useTrackingRequests,type SendTrackingRequest} from '../../../../src/lib/tracking-sessions/request-workflow';
import {useAccount} from '../session/provider';
import {AppLink} from './app-link';
import {Button,Card,Copy,ErrorText,Field,Title} from './ui';
import {useLanguage} from '../localization/provider';

export function TrackingRequests({sessionId}:{sessionId?:string}){
 const account=useAccount(),{t}=useLanguage(),request=account.request;
 const send=useCallback<SendTrackingRequest>(async command=>{
  const response=await request('/api/tracking/requests',command) as {ok:boolean;data:unknown};
  if(!response.ok)throw Error();
  return response.data;
 },[request]);
 const w=useTrackingRequests(send,sessionId),[locationId,setLocationId]=useState('');
 return <Card><Title message={sessionId?'Request a vehicle':'Tracking requests'}/>
  {w.error&&<ErrorText message="Could not load Tracking sessions. Please try again."/>}
  {sessionId?<>{!!w.target?.selected&&<Copy>{t('Requested vehicle')} · {w.target.selected}</Copy>}
   <Field message="Truck number, driver or provider" value={w.query} editable={!w.busy} onChangeText={w.setQuery} maxLength={100}/>
   <Button secondary message="Search" disabled={w.busy||w.query.trim().length<2} onPress={()=>void w.search()}/>
   {w.target?.items.map(row=><View key={row.vehicleId}><Copy>{row.label}{row.connected?' · '+t('In your network'):''}</Copy>
    <Button secondary message="Request tracking" disabled={w.busy} onPress={()=>void w.select(row)}/></View>)}
   {w.target&&w.target.items.length===0&&w.searched&&!w.busy?<Copy message="No trucks match your search."/>:null}
  </>:<>
   {!w.busy&&!w.error&&!w.incoming.length&&<Copy message="No pending tracking requests."/>}
   {w.incoming.map(row=><View key={row.id} style={{gap:10}}>
    <Copy>{row.broker} · {row.reference}</Copy><Copy>{row.cargo} · {row.vehicle}</Copy><Copy>{row.route.map(p=>p.label).join(' → ')}</Copy>
    <Copy>{[row.pickupDate,row.deliveryDate].filter(Boolean).join(' → ')}</Copy>
    <Button secondary message={locationId===row.id?'Status and approximate location':'Status only'} disabled={w.busy} onPress={()=>setLocationId(locationId===row.id?'':row.id)}/>
    <Button message="Accept tracking request" disabled={w.busy} onPress={()=>void w.accept(row,locationId===row.id?'LOCATION_AND_STATUS':'STATUS_ONLY')}/>
   </View>)}
   {!!w.shipment&&<AppLink href={{pathname:'/shipment-detail',params:{id:w.shipment}}} message="Open Tracking"/>}
  </>}
  {w.busy&&<Copy message="Loading Tracking"/>}
  {(!sessionId||w.error)&&<Button secondary message="Refresh requests" disabled={w.busy} onPress={()=>void w.refresh()}/>}
 </Card>;
}
