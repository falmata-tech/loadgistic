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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import {Switch} from '../components/branded-switch';
import {SafeAreaView} from 'react-native-safe-area-context';
import { Redirect, useFocusEffect } from 'expo-router';
import { useAccountQuery } from '../hooks/account-query';
import { useAccount } from '../session/provider';
import { Page, Card, Title, Copy, Button, ErrorText, palette, LoadingSpinner } from '../components/ui';
import { emptyPlace, PlacePicker } from '../components/place-picker';
import { captureCapacityLocation } from '../location/capture';
import { privacyRadii, type ApproximateFix } from '../location/privacy';
import RegularService from './regular-service';
import {WorkspaceSection} from '../components/workspace-section';
import {workspaceCapabilities} from '../navigation/destinations';
import Documents from './documents';
import {AppIcon,type IconName} from '../components/app-icon';
import {TruckLocationSource} from '../components/fleet-devices';
import {capacityStatusPresentation} from '../theme/capacity-status-presentation';

const explain = (error: unknown) => error instanceof Error ? error.message : 'Could not save. Please try again.';
export default function CapacityManagement({embedded=false,vehicleId,active=true}:{embedded?:boolean;vehicleId?:string;active?:boolean}={}) {
  const {t}=useLanguage();
  const account = useAccount(), [selected, setSelected] = useState('');
  const { data, error, reload } = useAccountQuery<Workspace>('/api/mobile/capacity');
  if (account.busy) return <Page embedded={embedded}><LoadingSpinner /></Page>;
  if (!account.session) return <Redirect href="/account" />;
  if(!embedded&&!workspaceCapabilities(account.session).ownsProviderAccount)return <Page><Title message="My vehicle"/><ErrorText message={error?t(error):''}/>{!data&&!error&&<LoadingSpinner accessibilityLabel={t('Loading vehicle capacity')}/>}{!!error&&<Button message="Refresh" onPress={()=>{void reload();}}/>}{data?.vehicles.length===0&&<Copy message="Ask your fleet owner to assign your vehicle."/>}{data?.vehicles.map(truck=><Card key={truck.id}><Title>{truck.label}</Title><Copy>{truck.plate} · {truck.driver}</Copy><Copy>{t(!truck.current?'No capacity published yet':truck.current.status==='EMPTY'?'Empty':truck.current.status==='PARTIAL'?'Partial':'Off Duty')}</Copy>{truck.location&&<Copy>{locationAreaLabel(truck.location.area,t)} · {t('{radius} km radius',{radius:truck.location.radius})}</Copy>}<AppLink href="/account" message="Open driving controls" style={{color:'#155eef',fontWeight:'700',paddingVertical:12}}/><WorkspaceSection message="Vehicle documents" icon="documents"><Documents embedded scope={{kind:'ENTITY',subjectKind:'VEHICLE',id:truck.id}}/></WorkspaceSection></Card>)}</Page>;
  return <Page embedded={embedded}>{!embedded&&<Title message={"Vehicle capacity"}/>}{(!embedded||!vehicleId)&&<Copy message="Keep your availability, coverage and approximate location up to date."/>}<ErrorText message={error?t(error):''} />
    {!data && !error && <LoadingSpinner accessibilityLabel="Loading vehicle capacity" />}
    {!!error && <Button message="Refresh" onPress={() => { void reload(); }} />}
    {!embedded&&<ProfileSetup published={data?.profilePublished} />}{data?.vehicles.length === 0 && <Card><Copy message={"Add your vehicle, or ask your fleet owner to assign one, before sharing capacity."}/>{workspaceCapabilities(account.session).ownsProviderAccount&&<AppLink href="/fleet" message={"Vehicles and drivers"}/>}</Card>}
    {!!vehicleId&&data&&!data.vehicles.some(truck=>truck.id===vehicleId)&&<Copy message="This vehicle is no longer available in your workspace."/>}
    {(vehicleId?data?.vehicles.filter(truck=>truck.id===vehicleId):data?.vehicles)?.map(truck => <TruckCapacity key={`${truck.id}:${truck.driverId}`} truck={truck} showIdentity={!embedded||!vehicleId} active={active} canPublish={Boolean(data?.canPublish)} canRegular={workspaceCapabilities(account.session).ownsProviderAccount} canManageLocation={workspaceCapabilities(account.session).canManageFleet} editingSection={selected.startsWith(`${truck.id}:`)?selected.slice(truck.id.length+1) as CapacityTask:null} onEdit={task=>setSelected(`${truck.id}:${task}`)} onCancel={()=>setSelected('')} onSaved={()=>{setSelected('');void reload();}} refresh={reload}/>)}
  </Page>;
}
type CapacityTask='CAPACITY'|'SHARING'|'ROUTES'|'LOCATION';
function TruckCapacity({truck,showIdentity,active,canPublish,canRegular,canManageLocation,editingSection,onEdit,onCancel,onSaved,refresh}:{truck:Truck;showIdentity:boolean;active:boolean;canPublish:boolean;canRegular:boolean;canManageLocation:boolean;editingSection:CapacityTask|null;onEdit:(task:CapacityTask)=>void;onCancel:()=>void;onSaved:()=>void;refresh:()=>Promise<void>}) {
  const {t,locale}=useLanguage(),[saving,setSaving]=useState(false);
  const automatic=useCapacityLocation(truck,Boolean(editingSection)||!active,refresh);
  const regular=useMemo(()=>(truck.regularServices||[]).filter(item=>item.vehicleId===truck.id&&item.driverId===truck.driverId).map(item=>({kind:item.geometry,places:item.geometry==='ROUTE'?item.route:item.boundary,partial:false})),[truck.id,truck.driverId,truck.regularServices]);
  const when=(value:string)=>new Date(value).toLocaleString(locale==='om'?'en-ET':locale);
  const mapLocation=truck.location?.coordinate?{latitude:truck.location.coordinate[1],longitude:truck.location.coordinate[0],radius:truck.location.radius,area:truck.location.area,updatedAt:truck.location.updatedAt,source:truck.publishedLocationSource,...(truck.locationIsDemo?{demo:true as const}:{})}:null;
  const coverage=truck.current&&truck.current.status!=='OFF_DUTY'?{kind:truck.current.availabilityGeometry,places:truck.current.availabilityGeometry==='ROUTE'?truck.current.route:truck.current.boundary,partial:truck.current.status==='PARTIAL'}:undefined;
  const hasMapSignals=Boolean(mapLocation||coverage||regular.length);
  const taskTitle=editingSection==='CAPACITY'?(canPublish?'Update capacity':'Update duty status'):editingSection==='SHARING'?'Sharing settings':editingSection==='ROUTES'?'Routes and areas':'Vehicle location';
  const close=()=>{if(saving)return;onCancel();void refresh();};
  return <>
    <Card>{showIdentity&&<><Title>{truck.label}</Title><Copy>{truck.plate} · {truck.driver||t('No driver assigned')}</Copy></>}
      <View style={{flexDirection:'row',alignItems:'center',flexWrap:'wrap',gap:8}}>
        <View style={{paddingHorizontal:10,paddingVertical:6,borderRadius:8,backgroundColor:truck.current?.status==='PARTIAL'?capacityStatusPresentation.PARTIAL.soft:truck.current?.status==='EMPTY'?palette.successSoft:'#edf2f7'}}><Text style={{fontSize:13,fontWeight:'700',color:truck.current?.status==='PARTIAL'?capacityStatusPresentation.PARTIAL.text:truck.current?.status==='EMPTY'?palette.success:palette.muted}}>{t(truck.current?truck.current.status==='EMPTY'?'Empty':truck.current.status==='PARTIAL'?'Partial':'Off Duty':'No capacity published yet')}</Text></View>
        {truck.current&&<Text style={{fontSize:13,fontWeight:'600',color:palette.muted}}>{t(capacitySharingLabel(capacitySharingMode(truck.current.sharingMode,truck.current.visibility)))}</Text>}
        {truck.current?.status==='EMPTY'&&<Text style={{fontSize:13,fontWeight:'600',color:palette.ink}}>{t(capacityLoadLabel(truck.current.acceptedLoads))}</Text>}
      </View>
      <View testID="fleet-capacity-map" style={{height:390,position:'relative',borderRadius:14,overflow:'hidden',borderWidth:1,borderColor:palette.border}}>
        <TrackingMap fill regular={regular} vehicleConfiguration={truck.configuration||'Vehicle'} location={mapLocation} coverage={coverage}/>
        {!hasMapSignals&&<View pointerEvents="none" style={{position:'absolute',left:10,right:88,bottom:12,alignItems:'flex-start'}}><View style={{paddingHorizontal:12,paddingVertical:9,borderRadius:11,borderWidth:1,borderColor:palette.border,backgroundColor:'rgba(255,255,255,.96)'}}><Text style={{fontSize:13,fontWeight:'700',color:palette.ink}}>{t('No signal on the map yet')}</Text><Text style={{fontSize:12,lineHeight:18,color:palette.muted}}>{t('Add a location or publish capacity to see it here.')}</Text></View></View>}
        <View pointerEvents="box-none" style={{position:'absolute',top:8,right:8,bottom:8,justifyContent:'center',alignItems:'flex-end'}}>
          <View style={{gap:7}}>
            <MapTaskButton label={canPublish?'Capacity':'Duty'} hint={canPublish?'Update capacity':'Update duty status'} icon="truck" onPress={()=>onEdit('CAPACITY')}/>
            <MapTaskButton label="Sharing" hint="Update sharing settings" icon="network" disabled={!canPublish||!truck.current} onPress={()=>onEdit('SHARING')}/>
            {canRegular&&Boolean(truck.driverId)&&<MapTaskButton label="Routes" hint="Manage corridor routes and service areas" icon="route" onPress={()=>onEdit('ROUTES')}/>}
            {canManageLocation&&<MapTaskButton label="Location" hint="Set vehicle location" icon="pin" onPress={()=>onEdit('LOCATION')}/>}
          </View>
        </View>
      </View>
      <Copy>{truck.location?`${locationAreaLabel(truck.location.area,t)} · ${t('{radius} km radius',{radius:truck.location.radius})} · ${t('Location updated {date}',{date:when(truck.location.updatedAt)})}`:t('No driver location shared yet')}</Copy>
      {truck.current&&<Copy>{t('Capacity updated {date}',{date:when(truck.current.updatedAt)})}</Copy>}
      {truck.canLocate&&truck.current&&truck.current.status!=='OFF_DUTY'&&<Copy message="Approximate location updates every 10 minutes while Capacity is open."/>}
      {automatic.busy&&<Copy message="Updating vehicle location…"/>}<ErrorText message={automatic.error?t(automatic.error):''}/>
    </Card>
    <Modal visible={Boolean(editingSection)} transparent animationType="slide" onRequestClose={close}>
      <SafeAreaView style={{flex:1,backgroundColor:'rgba(11,29,58,.2)',justifyContent:'flex-end',paddingHorizontal:8,paddingTop:18}}>
        <View style={{width:'100%',maxWidth:640,maxHeight:'94%',alignSelf:'center',backgroundColor:'#fff',borderRadius:20,overflow:'hidden',flexShrink:1}} accessibilityViewIsModal>
          <View style={{flexDirection:'row',alignItems:'center',gap:10,padding:14,borderBottomWidth:1,borderColor:palette.border}}>
            <View style={{flex:1,minWidth:0,gap:3}}><Text accessibilityRole="header" style={{fontSize:18,lineHeight:24,fontWeight:'700',color:palette.ink}}>{t(taskTitle)}</Text><Text numberOfLines={1} style={{fontSize:12,color:palette.muted}}>{truck.label} · {truck.plate}</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel={t('Close capacity editor')} accessibilityState={{disabled:saving}} disabled={saving} onPress={close} style={{width:48,height:48,alignItems:'center',justifyContent:'center'}}><AppIcon name="close" color={palette.blue}/></Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:16,gap:14,paddingBottom:28}}>
            {editingSection==='CAPACITY'&&<CapacityEditor section="CAPACITY" showClose={false} truck={truck} canPublish={canPublish} onBusy={setSaving} onCancel={close} onSaved={onSaved}/>}
            {editingSection==='SHARING'&&<CapacityEditor section="SHARING" showClose={false} truck={truck} canPublish={canPublish} onBusy={setSaving} onCancel={close} onSaved={onSaved}/>}
            {editingSection==='ROUTES'&&<RegularService embedded vehicleId={truck.id} expectedDriverId={truck.driverId} onBusy={setSaving} onSaved={onSaved}/>}
            {editingSection==='LOCATION'&&<TruckLocationSource vehicleId={truck.id} onBusy={setSaving} onSaved={onSaved}/>}
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  </>;
}
function MapTaskButton({label,hint,icon,disabled=false,onPress}:{label:string;hint:string;icon:IconName;disabled?:boolean;onPress:()=>void}){const {t}=useLanguage();return <Pressable accessibilityRole="button" accessibilityLabel={t(hint)} accessibilityState={{disabled}} disabled={disabled} onPress={onPress} style={{width:78,minHeight:58,paddingVertical:6,paddingHorizontal:3,borderRadius:11,borderWidth:1,borderColor:palette.border,backgroundColor:'rgba(255,255,255,.98)',alignItems:'center',justifyContent:'center',gap:3,opacity:disabled?0.55:1,boxShadow:'0px 2px 8px rgba(23,44,70,.13)'}}><AppIcon name={icon} size={19} color={disabled?palette.muted:palette.blue}/><Text style={{fontSize:10,fontWeight:'700',color:disabled?palette.muted:palette.ink,textAlign:'center'}}>{t(label)}</Text></Pressable>;}
function TaskHeading({message,icon}:{message:string;icon:IconName}){const {t}=useLanguage();return <View style={{flexDirection:'row',alignItems:'center',gap:9}}><AppIcon name={icon} size={20} color={palette.blue}/><Text style={{fontSize:18,lineHeight:24,fontWeight:'800',color:palette.ink}}>{t(message)}</Text></View>;}
function Choices({ value, options, onChange, busy }: { value: string; options: [string, string][]; onChange: (value: string) => void; busy: boolean }) {
  const {t}=useLanguage();
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{options.map(([id, label]) => <Pressable key={id} accessibilityRole="radio" accessibilityLabel={t(label)} accessibilityState={{ checked: value === id, disabled: busy }} disabled={busy} onPress={() => onChange(id)} style={{ minHeight: 48, minWidth: 70, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: value === id ? '#155eef' : '#cbd5e1', backgroundColor: value === id ? '#155eef' : '#fff', justifyContent: 'center' }}><Text style={{ color: value === id ? '#fff' : '#0b1d3a', fontWeight: '600' }}>{t(label)}</Text></Pressable>)}</View>;
}
export type CapacitySection='ALL'|'HOME'|'LOCATION'|'CAPACITY'|'SHARING';
export function CapacityEditor({ truck, canPublish, onSaved, onCancel, onBusy, section='ALL',showClose=true }: { truck: Truck; canPublish: boolean; onSaved: () => void; onCancel: () => void; onBusy?: (busy: boolean) => void; section?:CapacitySection;showClose?:boolean }) {
  const {t}=useLanguage();
  const account = useAccount(), current = truck.current;
  const home=section==='HOME', [advanced,setAdvanced]=useState(false);
  const all=section==='ALL'||(home&&!canPublish);
  const show=(group:'CAPACITY'|'COVERAGE'|'SHARING'|'LOADS'|'LOCATION')=>all||section===group||(section==='CAPACITY'&&(group==='CAPACITY'||group==='COVERAGE'||group==='LOADS'))||(home&&(group==='CAPACITY'||group==='COVERAGE'||group==='SHARING'||(group==='LOADS'&&advanced)||(group==='LOCATION'&&!truck.location)));
  const [status, setStatus] = useState(current?.status || 'EMPTY'), [loads, setLoads] = useState(current?.acceptedLoads || 'FTL'), [geometry, setGeometry] = useState(current?.availabilityGeometry || 'ROUTE'), [sharingMode, setSharingMode] = useState<string>(capacitySharingMode(current?.sharingMode,current?.visibility));
  const [route, setRoute] = useState(current?.route.length ? current.route : [emptyPlace(), emptyPlace()]), [boundary, setBoundary] = useState(current?.boundary.length ? current.boundary : [emptyPlace(), emptyPlace(), emptyPlace()]), [center, setCenter] = useState(current?.areaCenter || emptyPlace());
  const [multiPick, setMultiPick] = useState(current?.acceptsMultiPick || false), [multiDrop, setMultiDrop] = useState(current?.acceptsMultiDrop || false), [radius, setRadius] = useState(Math.min(20,truck.location?.radius || 10));
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
      if (!truck.driver) throw new Error('Assign a driver before publishing this vehicle.');
      if (!truck.location && !locationSaved) throw new Error(truck.canSetManualLocation ? 'Update the Capacity map location first.' : truck.canLocate ? 'Share this vehicle’s location first.' : 'Ask the assigned driver to share the vehicle location, then refresh.');
      const places = geometry === 'ROUTE' ? route : [center, ...boundary];
      if (places.some(place => !place.placeRef)) throw new Error('Choose each city from the suggestions.');
    }
    await account.request('/api/mobile/capacity', { action: 'PUBLISH', vehicleId: truck.id, status, acceptedLoads: status === 'PARTIAL' ? 'PTL' : loads, availabilityGeometry: geometry, visibility:sharingMode==='PUBLIC'||sharingMode==='BOTH'?'OPEN':'PRIVATE', sharingMode,
      currentRoutePlaces: route.filter(place => place.placeRef).map(place => ({ placeRef: place.placeRef })), capacityAreaCenterPlaceRef: center.placeRef,
      capacityAreaBoundaryPlaces: boundary.filter(place => place.placeRef).map(place => ({ placeRef: place.placeRef })), acceptsMultiPick: multiPick, acceptsMultiDrop: multiDrop });
    onSaved();
  });
  const duty = (onDuty: boolean) => run(async () => {
    if (onDuty && (!truck.selectedLocationSource||truck.selectedLocationSource==='MOBILE') && !fix) throw new Error('Refresh the vehicle location before marking it Available.');
    await account.request('/api/mobile/capacity', { action: 'DUTY', vehicleId: truck.id, onDuty, ...(onDuty && fix ? fix : {}) }); onSaved();
  });
  return <View style={{ gap: 16 }}>
    {home&&canPublish&&<Copy message="Set the space available now and where you can take a load."/>}
    {truck.canLocate && show('LOCATION') && <>{all&&<TaskHeading message="Vehicle location" icon="pin"/>}<Copy message={"Your exact position stays on your phone. Choose the approximate radius to share."}/><Choices value={String(radius)} options={privacyRadii.map(value => [String(value), `${value} km`])} busy={busy} onChange={value => { setRadius(Number(value)); setFix(null); }} /><Button message="Share vehicle location" onPress={locate} busy={busy} />{locationSaved && <Copy message={"Approximate location saved."}/>}</>}
    {fix&&!home&&show('LOCATION')&&<TrackingMap location={{latitude:fix.approximateLat,longitude:fix.approximateLng,radius:fix.locationPrecisionKm,area:'',updatedAt:''}}/>}
    {canPublish && section!=='LOCATION' ? <>{show('CAPACITY')&&<><TaskHeading message="Availability" icon="truck"/><Choices value={status} options={[['EMPTY', 'Empty'], ['PARTIAL', 'Partial'], ['OFF_DUTY', 'Off Duty']]} busy={busy} onChange={value => { setStatus(value); if (value === 'PARTIAL') setGeometry('ROUTE'); }} />{status!=='OFF_DUTY'&&<View style={{gap:7,paddingTop:10,borderTopWidth:1,borderColor:palette.borderSoft}}>{status==='EMPTY'?<><View style={{flexDirection:'row',alignItems:'center',gap:7}}><AppIcon name="boxes" size={17} color={palette.blue}/><Text style={{fontSize:14,fontWeight:'800',color:palette.ink}}>{t('Load type')}</Text></View><Choices value={loads} options={CAPACITY_LOAD_CHOICES} busy={busy} onChange={setLoads}/><Copy>{t(capacityLoadExplanation(loads))}</Copy></>:<Copy message="Remaining space is for shared loads."/>}</View>}</>}
      {status !== 'OFF_DUTY' && <>
        {show('COVERAGE')&&<><TaskHeading message="Where is this vehicle available?" icon="route"/><Choices value={geometry} options={status === 'PARTIAL' ? [['ROUTE', 'Route']] : [['ROUTE', 'Route'], ['RADIUS', 'Service area']]} busy={busy} onChange={setGeometry} />
        {geometry === 'ROUTE' ? <Cities items={route} onChange={setRoute} minimum={2} label={t('Route city')} busy={busy} /> : <><PlacePicker label={t('Area center')} value={center} onChange={setCenter} disabled={busy} /><Cities items={boundary} onChange={setBoundary} minimum={3} label={t('Boundary city')} busy={busy} /></>}
        {!home&&<CoveragePreview kind={geometry} places={geometry==='ROUTE'?route:boundary}/>}</>}
        {home&&<Pressable accessibilityRole="button" accessibilityLabel={t('Stops')} accessibilityState={{expanded:advanced,disabled:busy}} disabled={busy} onPress={()=>setAdvanced(value=>!value)} style={{minHeight:46,paddingHorizontal:12,borderWidth:1,borderColor:palette.border,borderRadius:10,flexDirection:'row',alignItems:'center',gap:8,alignSelf:'flex-start'}}><AppIcon name="route" size={18} color={palette.blue}/><Text style={{fontWeight:'700',color:palette.ink}}>{t('Stops')}</Text><AppIcon name="chevronDown" size={17} color={palette.muted}/></Pressable>}
        {show('LOADS')&&<>
        <View style={{gap:6}}><View style={{flexDirection:'row',alignItems:'center',gap:7}}><AppIcon name="route" size={17} color={palette.blue}/><Text style={{fontWeight:'800',color:palette.ink}}>{t('Stops')}</Text></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Copy message={"Multiple pickups"}/><Switch accessibilityLabel={t('Multiple pickups')} value={multiPick} onValueChange={setMultiPick} disabled={busy} /></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><Copy message={"Multiple drop-offs"}/><Switch accessibilityLabel={t('Multiple drop-offs')} value={multiDrop} onValueChange={setMultiDrop} disabled={busy} /></View>
        </View></>}{show('SHARING')&&<>
          <TaskHeading message="Who can see it?" icon="users"/>
          <Choices value={sharingMode} options={CAPACITY_SHARING_CHOICES} busy={busy} onChange={setSharingMode}/>
          {sharingMode==='BOTH'?<Copy message="Connected shippers and brokers can also see this vehicle privately."/>
            :sharingMode==='PUBLIC'?<Copy message="Anyone browsing the map can see this vehicle."/>
            :<Copy message="Only shippers and brokers you share with can see this vehicle."/>}
          <AppLink href="/network" message="Manage vehicle sharing" style={{color:'#155eef',fontWeight:'700',paddingVertical:12}}/>
        </>}
        {!truck.canLocate && !truck.location && <Copy message={truck.canSetManualLocation?"Set your location using Vehicle location on Home before publishing.":"Choose the vehicle’s location source in Fleet, then refresh before publishing."}/>}
      </>}
      <ErrorText message={error?t(error):''} /><Button message={section==='SHARING'?'Save sharing settings':'Save capacity'} onPress={save} busy={busy} />
    </> : !canPublish && section!=='LOCATION' ? <><Copy message={"Your fleet owner manages capacity. You can share location and change your duty status."}/><ErrorText message={error?t(error):''} />{truck.current && truck.current.status !== 'OFF_DUTY' ? <Button message="Go Off Duty" busy={busy} onPress={() => duty(false)} /> : truck.dutyConfigured ? <Button message="Mark Available" busy={busy} onPress={() => duty(true)} /> : <Copy message={"Ask your fleet owner to set up capacity before marking this vehicle Available."}/>}</> : <ErrorText message={error?t(error):''}/>}
    {showClose&&section!=='HOME'&&<Button secondary message="Close" onPress={onCancel} busy={busy} />}
  </View>;
}
