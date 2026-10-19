import {CoveragePreview} from '../components/coverage-preview';
import { useRef, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAccount } from '../session/provider';
import { useAccountQuery } from '../hooks/account-query';
import { Page, Title, Copy, Card, Button, ErrorText } from '../components/ui';
import { Choices } from '../components/choices';
import { Cities } from '../components/cities';
import { PlacePicker, emptyPlace } from '../components/place-picker';
import type {Service} from '../api/regular';
export type {Service} from '../api/regular';
type Scope={vehicleId:string;expectedDriverId:string};
type Props=Partial<Scope>&{embedded?:boolean;onBusy?:(busy:boolean)=>void;onSaved?:()=>void};
export default function RegularService({embedded=false,vehicleId,expectedDriverId,onBusy,onSaved}:Props={}) {
 const account = useAccount();
 if (account.busy) return <Page embedded={embedded}><ActivityIndicator /></Page>;
 if (!account.session) return <Redirect href="/account" />;
 if(!vehicleId||!expectedDriverId)return <Redirect href={account.session.user.operatingModel==='COMPANY_DRIVER'?'/manage-capacity':'/fleet'}/>;
 return <ScopedRegularService key={`${vehicleId}:${expectedDriverId}`} embedded={embedded} vehicleId={vehicleId} expectedDriverId={expectedDriverId} onBusy={onBusy} onSaved={onSaved}/>;
}
function ScopedRegularService({embedded,vehicleId,expectedDriverId,onBusy,onSaved}:Props&Scope) {
 const path=`/api/mobile/regular-service?${new URLSearchParams({vehicleId,expectedDriverId})}`;
 const query=useAccountQuery<{services:Service[]}>(path);
 const service=query.data?.services.find(item=>item.vehicleId===vehicleId&&item.driverId===expectedDriverId);
 return <Page embedded={embedded}>{!embedded&&<Title message="Regular service"/>}<Copy message="Regular service is not a current capacity update."/><ErrorText message={query.error}/><Button secondary message="Refresh regular service" busy={query.loading} onPress={()=>{void query.reload();}}/>{query.data&&<Editor key={`${vehicleId}:${expectedDriverId}:${service?.id||'new'}`} vehicleId={vehicleId} expectedDriverId={expectedDriverId} service={service} reload={query.reload} onBusy={onBusy} onSaved={onSaved}/>}</Page>;
}
function Editor({ service, vehicleId, expectedDriverId, reload, onBusy, onSaved }: { service?: Service; reload: () => Promise<void>;onBusy?:(busy:boolean)=>void;onSaved?:()=>void }&Scope) {
 const account = useAccount(), lock = useRef(false), [editing, setEditing] = useState(!service);
 const [geometry, setGeometry] = useState(service?.geometry || 'ROUTE'), [route, setRoute] = useState(service?.route.length ? service.route : [emptyPlace(), emptyPlace()]), [center, setCenter] = useState(service?.center || emptyPlace()), [boundary, setBoundary] = useState(service?.boundary.length ? service.boundary : [emptyPlace(), emptyPlace(), emptyPlace()]);
 const [busy, setBusy] = useState(false), [error, setError] = useState(''),[confirmRemove,setConfirmRemove]=useState(false);
 async function save(remove = false) { if (lock.current) return; lock.current = true; onBusy?.(true); setBusy(true); setError('');
  try { const places = geometry === 'ROUTE' ? route : [center, ...boundary]; if (!remove && places.some(place => !place.placeRef)) throw new Error('Choose every city from the suggestions.');
   await account.request('/api/mobile/regular-service', remove ? { action: 'REMOVE', vehicleId, expectedDriverId, id: service?.id, confirm: true } : { action: 'SAVE', vehicleId, expectedDriverId, replaceId: service?.id || null, geometry, routePlaces: route.filter(place => place.placeRef).map(place => ({ placeRef: place.placeRef })), areaCenterPlaceRef: center.placeRef, areaBoundaryPlaces: boundary.filter(place => place.placeRef).map(place => ({ placeRef: place.placeRef })) });
   setEditing(false); await reload(); setConfirmRemove(false); onSaved?.();
  } catch (error) { setError(error instanceof Error ? error.message : 'Could not confirm the update.'); }
  finally { lock.current = false; onBusy?.(false); setBusy(false); }
 }
 return <Card><ErrorText message={error} />{!!error&&<Copy message="Refresh to check your saved routes before trying again."/>}{service && !editing ? <><Copy>{service.geometry === 'ROUTE' ? service.route.map(place => place.label).join(' ↔ ') : [service.center.label, ...service.boundary.map(place => place.label)].filter(Boolean).join(' · ')}</Copy><Copy message={service.geometry === 'ROUTE' ? 'Regular two-way route' : 'Regular service area'}/><CoveragePreview kind={service.geometry} places={service.geometry==='ROUTE'?service.route:service.boundary} regular/>{confirmRemove?<><Copy message="Remove regular service?"/><Copy message="Current vehicle availability will stay as published."/><Button secondary message="Keep service" disabled={busy} onPress={()=>setConfirmRemove(false)}/><Button message="Remove" busy={busy} onPress={()=>{void save(true);}}/></>:<><Button message="Edit regular service" onPress={() => setEditing(true)} disabled={busy} /><Button secondary message="Remove regular service" busy={busy} onPress={()=>setConfirmRemove(true)}/></>}</> : <><Choices value={geometry} options={[{ id: 'ROUTE', label: 'Route' }, { id: 'RADIUS', label: 'Service area' }]} onChange={value=>{if(value==='ROUTE'||value==='RADIUS')setGeometry(value);}} disabled={busy} />{geometry === 'ROUTE' ? <Cities items={route} onChange={setRoute} minimum={2} label="Route city" busy={busy} /> : <><PlacePicker label="Area center" value={center} onChange={setCenter} disabled={busy} /><Cities items={boundary} onChange={setBoundary} minimum={3} label="Boundary city" busy={busy} /></>}<CoveragePreview kind={geometry} places={geometry==='ROUTE'?route:boundary} regular/><Button message="Save regular service" busy={busy} onPress={() => { void save(); }} />{service && <Button secondary message="Cancel changes" disabled={busy} onPress={() => { setGeometry(service.geometry); setRoute(service.route.length ? service.route : [emptyPlace(), emptyPlace()]); setBoundary(service.boundary.length ? service.boundary : [emptyPlace(), emptyPlace(), emptyPlace()]); setCenter(service.center); setEditing(false); }} />}</>}</Card>;
}
