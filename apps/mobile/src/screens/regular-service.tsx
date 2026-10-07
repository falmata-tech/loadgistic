import {CoveragePreview} from '../components/coverage-preview';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';
import { Redirect } from 'expo-router';
import { useAccount } from '../session/provider';
import { useAccountQuery } from '../hooks/account-query';
import { Page, Title, Copy, Card, Button, ErrorText } from '../components/ui';
import { Choices } from '../components/choices';
import { Cities } from '../components/cities';
import { PlacePicker, emptyPlace, type Place } from '../components/place-picker';
export type Service = { id: string; geometry: string; route: Place[]; center: Place; boundary: Place[] };
export default function RegularService({embedded=false,onBusy,onSaved}:{embedded?:boolean;onBusy?:(busy:boolean)=>void;onSaved?:()=>void}={}) {
 const account = useAccount(), query = useAccountQuery<{ services: Service[] }>('/api/mobile/regular-service');
 if (account.busy) return <Page embedded={embedded}><ActivityIndicator /></Page>;
 if (!account.session) return <Redirect href="/account" />;
 return <Page embedded={embedded}>{!embedded&&<Title message={"Regular service"}/>}<Copy message={"Show the route or area your transport business usually serves. Set each truck’s current availability separately."}/><ErrorText message={query.error} /><Button secondary message="Refresh regular service" busy={query.loading} onPress={() => { void query.reload(); }} />{query.data && <Editor key={query.data.services[0]?.id || 'new'} service={query.data.services[0]} reload={query.reload} onBusy={onBusy} onSaved={onSaved} />}</Page>;
}
function Editor({ service, reload, onBusy, onSaved }: { service?: Service; reload: () => Promise<void>;onBusy?:(busy:boolean)=>void;onSaved?:()=>void }) {
 const account = useAccount(), lock = useRef(false), [editing, setEditing] = useState(!service);
 const [geometry, setGeometry] = useState(service?.geometry || 'ROUTE'), [route, setRoute] = useState(service?.route.length ? service.route : [emptyPlace(), emptyPlace()]), [center, setCenter] = useState(service?.center || emptyPlace()), [boundary, setBoundary] = useState(service?.boundary.length ? service.boundary : [emptyPlace(), emptyPlace(), emptyPlace()]);
 const [busy, setBusy] = useState(false), [error, setError] = useState('');
 async function save(remove = false) { if (lock.current) return; lock.current = true; onBusy?.(true); setBusy(true); setError('');
  try { const places = geometry === 'ROUTE' ? route : [center, ...boundary]; if (!remove && places.some(place => !place.placeRef)) throw new Error('Choose every city from the suggestions.');
   await account.request('/api/mobile/regular-service', remove ? { action: 'REMOVE', id: service?.id, confirm: true } : { action: 'SAVE', replaceId: service?.id || null, geometry, routePlaces: route.filter(place => place.placeRef).map(place => ({ placeRef: place.placeRef })), areaCenterPlaceRef: center.placeRef, areaBoundaryPlaces: boundary.filter(place => place.placeRef).map(place => ({ placeRef: place.placeRef })) });
   setEditing(false); await reload(); onSaved?.();
  } catch (error) { setError(`${error instanceof Error ? error.message : 'Could not confirm the update.'} Refresh to check the saved service before trying again.`); }
  finally { lock.current = false; onBusy?.(false); setBusy(false); }
 }
 return <Card><ErrorText message={error} />{service && !editing ? <><Copy>{service.geometry === 'ROUTE' ? service.route.map(place => place.label).join(' ↔ ') : [service.center.label, ...service.boundary.map(place => place.label)].filter(Boolean).join(' · ')}</Copy><Copy>{service.geometry === 'ROUTE' ? 'Regular two-way route' : 'Regular service area'}</Copy><CoveragePreview kind={service.geometry} places={service.geometry==='ROUTE'?service.route:service.boundary} regular/><Button message="Edit regular service" onPress={() => setEditing(true)} disabled={busy} /><Button secondary message="Remove regular service" busy={busy} onPress={() => Alert.alert('Remove regular service?', 'Current truck availability will stay as published.', [{ text: 'Keep service', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => { void save(true); } }])} /></> : <><Choices value={geometry} options={[{ id: 'ROUTE', label: 'Route' }, { id: 'RADIUS', label: 'Service area' }]} onChange={setGeometry} disabled={busy} />{geometry === 'ROUTE' ? <Cities items={route} onChange={setRoute} minimum={2} label="Route city" busy={busy} /> : <><PlacePicker label="Area center" value={center} onChange={setCenter} disabled={busy} /><Cities items={boundary} onChange={setBoundary} minimum={3} label="Boundary city" busy={busy} /></>}<CoveragePreview kind={geometry} places={geometry==='ROUTE'?route:boundary} regular/><Button message="Save regular service" busy={busy} onPress={() => { void save(); }} />{service && <Button secondary message="Cancel changes" disabled={busy} onPress={() => { setGeometry(service.geometry); setRoute(service.route.length ? service.route : [emptyPlace(), emptyPlace()]); setBoundary(service.boundary.length ? service.boundary : [emptyPlace(), emptyPlace(), emptyPlace()]); setCenter(service.center); setEditing(false); }} />}</>}</Card>;
}
