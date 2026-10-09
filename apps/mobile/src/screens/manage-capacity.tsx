import {CAPACITY_SHARING_CHOICES,capacitySharingMode,capacitySharingLabel} from '../../../../src/lib/capacity-sharing';
import {useLanguage} from '../localization/provider';
import {locationAreaLabel} from '../localization/location-copy';
import {CAPACITY_LOAD_CHOICES,capacityLoadExplanation,capacityLoadLabel} from '../../../../src/lib/capacity-load-preferences';
import {useCapacityLocation} from '../hooks/capacity-location';
import type {CapacityTruck as Truck, CapacityWorkspace as Workspace} from '../api/capacity';
import {CoveragePreview} from '../components/coverage-preview';
import {TrackingMap} from '../components/tracking-map';
import { AppLink } from '../components/app-link';
import { Cities } from '../components/cities';
import { ProfileSetup } from '../components/profile-setup';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, Switch, Text, View } from 'react-native';
import { Redirect, useFocusEffect } from 'expo-router';
import { useAccountQuery } from '../hooks/account-query';
import { useAccount } from '../session/provider';
import { Page, Card, Title, Copy, Field, Button, ErrorText } from '../components/ui';
import { emptyPlace, PlacePicker } from '../components/place-picker';
import { captureCapacityLocation } from '../location/capture';
import { privacyRadii, type ApproximateFix } from '../location/privacy';

const explain = (error: unknown) => error instanceof Error ? error.message : 'Could not save. Please try again.';
export default function CapacityManagement({embedded=false,vehicleId}:{embedded?:boolean;vehicleId?:string}={}) {
  const {t}=useLanguage();
  const account = useAccount(), [selected, setSelected] = useState(vehicleId||'');
  const { data, error, reload } = useAccountQuery<Workspace>('/api/mobile/capacity');
  if (account.busy) return <Page embedded={embedded}><ActivityIndicator /></Page>;
  if (!account.session) return <Redirect href="/account" />;
  return <Page embedded={embedded}>{!embedded&&<Title message={"Truck capacity"}/>}<Copy message={"Keep your availability, coverage and approximate location up to date."}/><ErrorText message={error?t(error):''} />
    {!data && !error && <ActivityIndicator accessibilityLabel="Loading truck capacity" />}
    {!!error && <Button message="Refresh" onPress={() => { void reload(); }} />}
    <ProfileSetup published={data?.profilePublished} />{!embedded&&typeof data?.profilePublished === 'boolean' && <AppLink href="/regular-service" style={{ paddingVertical: 12, color: '#0c7275' }} message={"Regular service route or area"}/>}{data?.vehicles.length === 0 && <Card><Copy message={"Add your truck, or ask your fleet owner to assign one, before sharing capacity."}/>{account.session.user.operatingModel!=='COMPANY_DRIVER'&&<AppLink href="/fleet" message={"Trucks and drivers"}/>}</Card>}
    {vehicleId&&data&&!data.vehicles.some(truck=>truck.id===vehicleId)&&<Copy message="This truck is no longer available in your workspace."/>}
    {(vehicleId?data?.vehicles.filter(truck=>truck.id===vehicleId):data?.vehicles)?.map(truck => <TruckCapacity key={truck.id} truck={truck} canPublish={Boolean(data?.canPublish)} editing={selected===truck.id} onEdit={()=>setSelected(truck.id)} onCancel={()=>setSelected('')} onSaved={()=>{setSelected('');void reload();}} refresh={reload}/>)}
  </Page>;
}
function TruckCapacity({truck,canPublish,editing,onEdit,onCancel,onSaved,refresh}:{truck:Truck;canPublish:boolean;editing:boolean;onEdit:()=>void;onCancel:()=>void;onSaved:()=>void;refresh:()=>Promise<void>}) {
  const {t,locale}=useLanguage();
  const automatic=useCapacityLocation(truck,editing,refresh);
  const when=(value:string)=>new Date(value).toLocaleString(locale==='om'?'en-ET':locale);
  return <Card><Title>{truck.label}</Title><Copy>{truck.plate} · {truck.driver||t('No driver assigned')}</Copy>
    <Copy>{truck.current ? `${t(truck.current.status==='EMPTY'?'Empty':truck.current.status==='PARTIAL'?'Partial':'Off Duty')} · ${t(capacitySharingLabel(capacitySharingMode(truck.current.sharingMode,truck.current.visibility)))}` : t('No capacity published yet')}</Copy>
    {truck.current?.status==='EMPTY'&&<Copy>{t(capacityLoadLabel(truck.current.acceptedLoads))}</Copy>}
    {truck.current&&<Copy>{t('Capacity updated {date}',{date:when(truck.current.updatedAt)})}</Copy>}
    <Copy>{truck.location ? `${locationAreaLabel(truck.location.area,t)} · ${t('{radius} km radius',{radius:truck.location.radius})}\n${t('Location updated {date}',{date:when(truck.location.updatedAt)})}` : t('No driver location shared yet')}</Copy>
    {!editing&&truck.location?.coordinate&&<TrackingMap location={{latitude:truck.location.coordinate[1],longitude:truck.location.coordinate[0],radius:truck.location.radius,area:truck.location.area,updatedAt:truck.location.updatedAt}} coverage={truck.current&&truck.current.status!=='OFF_DUTY'?{kind:truck.current.availabilityGeometry,places:truck.current.availabilityGeometry==='ROUTE'?truck.current.route:truck.current.boundary,partial:truck.current.status==='PARTIAL'}:undefined}/>}
    {truck.canLocate&&truck.current&&truck.current.status!=='OFF_DUTY'&&<Copy message="Your approximate location updates every 10 minutes while Home or Truck capacity is open. Updates pause when you leave or lock your phone."/>}
    {automatic.busy&&<Copy message="Updating truck location…"/>}<ErrorText message={automatic.error?t(automatic.error):''}/>
    {!editing?<Button label={t(canPublish?'Manage capacity':'Location and availability')} busy={automatic.busy} onPress={onEdit}/>:<CapacityEditor truck={truck} canPublish={canPublish} onCancel={onCancel} onSaved={onSaved}/>}
  </Card>;
}
function Choices({ value, options, onChange, busy }: { value: string; options: [string, string][]; onChange: (value: string) => void; busy: boolean }) {
  const {t}=useLanguage();
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{options.map(([id, label]) => <Pressable key={id} accessibilityRole="radio" accessibilityLabel={t(label)} accessibilityState={{ checked: value === id, disabled: busy }} disabled={busy} onPress={() => onChange(id)} style={{ minHeight: 48, minWidth: 70, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: value === id ? '#0c7275' : '#cbdadb', backgroundColor: value === id ? '#0c7275' : '#fff', justifyContent: 'center' }}><Text style={{ color: value === id ? '#fff' : '#172c46', fontWeight: '600' }}>{t(label)}</Text></Pressable>)}</View>;
}
export type CapacitySection='ALL'|'HOME'|'LOCATION';
export function CapacityEditor({ truck, canPublish, onSaved, onCancel, onBusy, section='ALL' }: { truck: Truck; canPublish: boolean; onSaved: () => void; onCancel: () => void; onBusy?: (busy: boolean) => void; section?:CapacitySection }) {
  const {t}=useLanguage();
  const account = useAccount(), current = truck.current;
  const home=section==='HOME', [advanced,setAdvanced]=useState(false);
  const all=section==='ALL'||(home&&!canPublish);
  const show=(group:'CAPACITY'|'COVERAGE'|'SHARING'|'LOADS'|'LOCATION')=>all||section===group||(home&&(group==='CAPACITY'||group==='COVERAGE'||group==='SHARING'||(group==='LOADS'&&advanced)||(group==='LOCATION'&&!truck.location)));
  const [status, setStatus] = useState(current?.status || 'EMPTY'), [loads, setLoads] = useState(current?.acceptedLoads || 'FTL'), [geometry, setGeometry] = useState(current?.availabilityGeometry || 'ROUTE'), [sharingMode, setSharingMode] = useState<string>(capacitySharingMode(current?.sharingMode,current?.visibility)), [exclusiveEmail,setExclusiveEmail]=useState(current?.exclusiveEmail||''),[exclusiveName,setExclusiveName]=useState(current?.exclusiveName||'');
  const [route, setRoute] = useState(current?.route.length ? current.route : [emptyPlace(), emptyPlace()]), [boundary, setBoundary] = useState(current?.boundary.length ? current.boundary : [emptyPlace(), emptyPlace(), emptyPlace()]), [center, setCenter] = useState(current?.areaCenter || emptyPlace());
  const [multiPick, setMultiPick] = useState(current?.acceptsMultiPick || false), [multiDrop, setMultiDrop] = useState(current?.acceptsMultiDrop || false), [radius, setRadius] = useState(truck.location?.radius || 20);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [locationSaved, setLocationSaved] = useState(false), [fix, setFix] = useState<ApproximateFix | null>(null);
  const running = useRef(false), active = useRef(false), generation = useRef(0);
  useFocusEffect(useCallback(() => { active.current = true; return () => { active.current = false; generation.current++; }; }, []));
  useEffect(() => { const listener = AppState.addEventListener('change', state => { if (state !== 'active') generation.current++; }); return () => listener.remove(); }, []);
  const run = async (action: () => Promise<void>) => { if (running.current) return; running.current = true; onBusy?.(true); setBusy(true); setError(''); try { await action(); } catch (error) { setError(explain(error)); } finally { running.current = false; onBusy?.(false); setBusy(false); } };
  const locate = () => run(async () => {
    let version = generation.current;
    const captured = await captureCapacityLocation(radius,true,()=>{
      if (!active.current || AppState.currentState !== 'active') throw new Error('Location sharing paused. Return to this screen and try again.');
      version=generation.current;
    });
    if (!active.current || AppState.currentState !== 'active' || version !== generation.current) throw new Error('Location sharing paused. Return to this screen and try again.');
    await account.request('/api/mobile/capacity', { action: 'LOCATION', vehicleId: truck.id, ...captured });
    setFix(captured); setLocationSaved(true);
  });
  const save = () => run(async () => {
    if (status !== 'OFF_DUTY') {
      if (!truck.driver) throw new Error('Assign a driver before publishing this truck.');
      if (!truck.location && !locationSaved) throw new Error(truck.canLocate ? 'Share this truck’s location first.' : 'Ask the assigned driver to share the truck location, then refresh.');
      const places = geometry === 'ROUTE' ? route : [center, ...boundary];
      if (places.some(place => !place.placeRef)) throw new Error('Choose each city from the suggestions.');
    }
    await account.request('/api/mobile/capacity', { action: 'PUBLISH', vehicleId: truck.id, status, acceptedLoads: status === 'PARTIAL' ? 'PTL' : loads, availabilityGeometry: geometry, visibility:sharingMode==='PUBLIC'||sharingMode==='BOTH'?'OPEN':'PRIVATE', sharingMode, exclusiveEmail,...((show('SHARING')||exclusiveName)?{exclusiveName}:{}),
      currentRoutePlaces: route.filter(place => place.placeRef).map(place => ({ placeRef: place.placeRef })), capacityAreaCenterPlaceRef: center.placeRef,
      capacityAreaBoundaryPlaces: boundary.filter(place => place.placeRef).map(place => ({ placeRef: place.placeRef })), acceptsMultiPick: multiPick, acceptsMultiDrop: multiDrop });
    onSaved();
  });
  const duty = (onDuty: boolean) => run(async () => {
    if (onDuty && !fix) throw new Error('Refresh the truck location before marking it Available.');
    await account.request('/api/mobile/capacity', { action: 'DUTY', vehicleId: truck.id, onDuty, ...(onDuty ? fix : {}) }); onSaved();
  });
  return <View style={{ gap: 16 }}>
    {home&&canPublish&&<Copy message="Set the space available now and where you can take a load."/>}
    {truck.canLocate && show('LOCATION') && <>{all&&<Title message={"Truck location"}/>}<Copy message={"Your exact position stays on your phone. Choose the approximate radius to share."}/><Choices value={String(radius)} options={privacyRadii.map(value => [String(value), `${value} km`])} busy={busy} onChange={value => { setRadius(Number(value)); setFix(null); }} /><Button message="Share truck location" onPress={locate} busy={busy} />{locationSaved && <Copy message={"Approximate location saved."}/>}</>}
    {fix&&!home&&show('LOCATION')&&<TrackingMap location={{latitude:fix.approximateLat,longitude:fix.approximateLng,radius:fix.locationPrecisionKm,area:'',updatedAt:''}}/>}
    {canPublish && section!=='LOCATION' ? <>{show('CAPACITY')&&<><Title message={"Available space"}/><Choices value={status} options={[['EMPTY', 'Empty'], ['PARTIAL', 'Partial'], ['OFF_DUTY', 'Off Duty']]} busy={busy} onChange={value => { setStatus(value); if (value === 'PARTIAL') setGeometry('ROUTE'); }} /></>}
      {status !== 'OFF_DUTY' && <>
        {status==='EMPTY'&&(show('CAPACITY')||show('LOADS'))&&<><Title message="Which loads will you take?"/><Choices value={loads} options={CAPACITY_LOAD_CHOICES} busy={busy} onChange={setLoads}/><Copy>{t(capacityLoadExplanation(loads))}</Copy></>}
        {status==='PARTIAL'&&show('CAPACITY')&&<Copy message="Remaining space is for shared loads."/>}
        {show('COVERAGE')&&<>{home?<Title message="Where can you take a load?"/>:all&&<Title message={"Availability coverage"}/>}<Choices value={geometry} options={status === 'PARTIAL' ? [['ROUTE', 'Route']] : [['ROUTE', 'Route'], ['RADIUS', 'Service area']]} busy={busy} onChange={setGeometry} />
        {geometry === 'ROUTE' ? <Cities items={route} onChange={setRoute} minimum={2} label={t('Route city')} busy={busy} /> : <><PlacePicker label={t('Area center')} value={center} onChange={setCenter} disabled={busy} /><Cities items={boundary} onChange={setBoundary} minimum={3} label={t('Boundary city')} busy={busy} /></>}
        {!home&&<CoveragePreview kind={geometry} places={geometry==='ROUTE'?route:boundary}/>}</>}
        {home&&<Button secondary message="Load preferences" onPress={()=>setAdvanced(value=>!value)} busy={busy}/>}
        {show('LOADS')&&<>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Copy message={"Multiple pickups"}/><Switch accessibilityLabel={t('Multiple pickups')} value={multiPick} onValueChange={setMultiPick} disabled={busy} /></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Copy message={"Multiple drop-offs"}/><Switch accessibilityLabel={t('Multiple drop-offs')} value={multiDrop} onValueChange={setMultiDrop} disabled={busy} /></View>
        </>}{show('SHARING')&&<>
          {(all||home)&&<Title message="Who can see it?"/>}
          <Choices value={sharingMode} options={CAPACITY_SHARING_CHOICES} busy={busy} onChange={setSharingMode}/>
          {sharingMode==='EXCLUSIVE'?<><Field message="Person or company name" value={exclusiveName} onChangeText={setExclusiveName} maxLength={100} editable={!busy}/><Field message="Only this email can see the truck" value={exclusiveEmail} onChangeText={setExclusiveEmail} keyboardType="email-address" autoCapitalize="none" maxLength={254} editable={!busy}/></>
            :sharingMode==='BOTH'?<Copy message="Invited contacts also see this truck in their private feed."/>
            :sharingMode==='PUBLIC'?<Copy message="Anyone browsing the map can see this truck."/>
            :<Copy message="Only approved contacts can see this truck."/>}
          <Copy message="Manage contacts in Network. Changing sharing keeps their history and your location privacy."/>
        </>}
        {!truck.canLocate && !truck.location && <Copy message={"Ask the assigned driver to share the truck’s location before publishing."}/>}
      </>}
      <ErrorText message={error?t(error):''} /><Button message="Save capacity" onPress={save} busy={busy} />
    </> : !canPublish && section!=='LOCATION' ? <><Copy message={"Your fleet owner manages capacity. You can share location and change your duty status."}/><ErrorText message={error?t(error):''} />{truck.current && truck.current.status !== 'OFF_DUTY' ? <Button message="Go Off Duty" busy={busy} onPress={() => duty(false)} /> : truck.dutyConfigured ? <Button message="Mark Available" busy={busy} onPress={() => duty(true)} /> : <Copy message={"Ask your fleet owner to set up capacity before marking this truck Available."}/>}</> : <ErrorText message={error?t(error):''}/>}
    <Button secondary message="Close" onPress={onCancel} busy={busy} />
  </View>;
}
