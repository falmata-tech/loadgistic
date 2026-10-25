import {useBlockedProviders} from '../hooks/content-blocks';
import { useLanguage } from '../localization/provider';
import { useVisitor } from '../session/visitor-provider';
import {AppIcon} from '../components/app-icon';
import { Redirect,router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import { BackHandler, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import CapacityMap from '../components/CapacityMap';
import { apiOrigin,apiRequest } from '../api/http';
import {discoveryParams,filterCount,parseDiscovery,peopleSearchFilters,profileTruckFilters,initialCapacityIdentity,type TruckFilters,type DiscoveryResult,type ProfileResult} from '../api/discovery';
import { DiscoveryFilters } from '../components/discovery-filters';
import { ResultsDrawer } from '../components/results-drawer';
import {Copy,LoadingSpinner,Page,palette} from '../components/ui';
import {useAccount} from '../session/provider';
import { VEHICLE_CONFIGURATIONS } from '../../../../src/lib/vehicle-configurations';
import { DiscoveryResults } from '../components/discovery-results';
import { LoadingBar } from '../components/loading-bar';
import { capacityIntroduction } from '../../../../src/lib/platform-copy.js';
import { loadCapacity, loadSharedCapacity, type CapacitySignal } from '../api/public-capacity';
import type {CapacityWorkspace} from '../api/capacity';
import {useAccountQuery} from '../hooks/account-query';
import {transporterSearchQuery,TRANSPORTER_SEARCH_DELAY_MS,TRANSPORTER_SEARCH_TIMEOUT_MS} from '../../../../src/lib/transporter-search.js';
import {loadAccountCapacity,loadBusinessCapacity} from '../api/business-workspaces';
import {ApiError} from '../api/response';
import {useForegroundRefresh} from '../hooks/foreground-refresh';
export type BusinessCapacityContext={workspaceId:string;scopeKey:string;request:(path:string)=>Promise<unknown>};
export type AccountCapacityContext={scopeKey:string;request:(path:string)=>Promise<unknown>;networkHref?:'/network'|'/directory'};

const emptySignals:CapacitySignal[]=[];
type SearchState={generation:number;scopeKey:string;query:string;page:number;result:DiscoveryResult|null;loading:boolean;error:string};
type SearchRequest=Pick<SearchState,'generation'|'scopeKey'|'query'|'page'>&{load:(query:string,page:number,signal:AbortSignal)=>Promise<unknown>};

function useTransporterSearch({initialInput,enabled,scopeKey,load}:{initialInput:string;enabled:boolean;scopeKey:string;load:SearchRequest['load']}) {
  const [input,setInput]=useState(initialInput),[state,setState]=useState<SearchState|null>(null);
  const inputValue=useRef(initialInput);
  const generation=useRef(0),timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const active=useRef<{controller:AbortController}|null>(null),queued=useRef<SearchRequest|null>(null);
  const requested=useRef<SearchRequest|null>(null);
  const cancelTimer=useCallback(()=>{if(timer.current!==null){clearTimeout(timer.current);timer.current=null;}},[]);
  const invalidate=useCallback((abort=false)=>{generation.current++;cancelTimer();queued.current=null;if(abort)active.current?.controller.abort();},[cancelTimer]);
  const run=useCallback(function start(request:SearchRequest) {
    if(request.generation!==generation.current)return;
    requested.current=request;
    const {generation:version,scopeKey,query,page}=request,fields={generation:version,scopeKey,query,page};
    setState({...fields,result:null,loading:true,error:''});
    if(active.current){queued.current=request;return;}
    const work={controller:new AbortController()};active.current=work;
    const timeout=setTimeout(()=>work.controller.abort('timeout'),TRANSPORTER_SEARCH_TIMEOUT_MS);
    void request.load(request.query,request.page,work.controller.signal).then(raw=>{
      const result=parseDiscovery(raw);
      if(request.generation===generation.current&&!work.controller.signal.aborted)setState({...fields,result,loading:false,error:''});
    }).catch(error=>{
      if(request.generation===generation.current&&(!work.controller.signal.aborted||work.controller.signal.reason==='timeout'))setState({...fields,result:null,loading:false,error:work.controller.signal.reason==='timeout'?'Search is temporarily unavailable. Please try again.':error instanceof Error?error.message:'Could not load transporters.'});
    }).finally(()=>{
      clearTimeout(timeout);if(active.current===work)active.current=null;
      const next=queued.current;queued.current=null;
      if(next&&next.generation===generation.current)start(next);
    });
  },[]);
  // Clear/close discard interest without pretending an HTTP abort cancels SQL.
  // Access-scope changes and unmount still clean up the transport itself.
  useEffect(()=>()=>{invalidate(true);setState(null);},[scopeKey,invalidate]);
  useEffect(()=>{if(enabled)return()=>{invalidate();setState(null);};},[enabled,invalidate]);
  useEffect(()=>{
    const query=transporterSearchQuery(input);if(!enabled||!query)return;
    const previous=requested.current;
    if(previous?.generation===generation.current&&previous.query===query&&previous.scopeKey===scopeKey)return;
    timer.current=setTimeout(()=>{timer.current=null;run({generation:generation.current,scopeKey,query,page:1,load});},TRANSPORTER_SEARCH_DELAY_MS);
    return cancelTimer;
  },[enabled,input,scopeKey,load,run,cancelTimer]);
  const changeInput=(value:string)=>{if(value===inputValue.current)return;invalidate();inputValue.current=value;setInput(value);setState(null);};
  const requestPage=(page=1)=>{const query=transporterSearchQuery(inputValue.current);if(!enabled||!query)return;invalidate();run({generation:generation.current,scopeKey,query,page,load});};
  const clear=()=>{invalidate();inputValue.current='';setInput('');setState(null);};
  const cancel=useCallback(()=>{invalidate();setState(null);},[invalidate]);
  const current=state?.scopeKey===scopeKey&&state.query===transporterSearchQuery(input)?state:null;
  const isCurrent=()=>Boolean(current&&current.generation===generation.current);
  return{input,changeInput,clear,cancel,submit:()=>requestPage(),onPage:(page:number)=>{if(isCurrent())requestPage(page);},retry:()=>{if(isCurrent())requestPage(current?.page||1);},state:current,isCurrent};
}

export default function App() {
  const params = useLocalSearchParams<{q?:string;view?:string;provider?:string;truck?:string}>();
  const auth=useAccount(),session=auth.session,privateView=params.view==='private';
  const workspace=session?.user.role==='CUSTOMER'?session.user.selectedBusinessWorkspace:null;
  const business=useMemo<BusinessCapacityContext|undefined>(()=>privateView&&workspace?.permissions.capacity&&session?{
    workspaceId:workspace.id,scopeKey:`${session.user.id}:${workspace.id}:${workspace.membershipRevision||''}`,request:auth.request
  }:undefined,[privateView,workspace,session,auth.request]);
  if(privateView&&auth.busy)return <Page><LoadingSpinner/></Page>;
  if(privateView&&!session)return <Redirect href="/account?from=capacity"/>;
  if(privateView&&['TRANSPORTER','DRIVER'].includes(session?.user.role||''))return <Redirect href="/"/>;
  if(privateView&&!business)return <Page><Copy message="Vehicles shared with you are not available for this account."/></Page>;
  const initialQuery = typeof params.q === 'string' ? params.q : '';
  const initialMode=privateView?'private':'open';
  const initialFilters=initialCapacityIdentity(params);
  return <Capacity key={`${initialMode}:${business?.scopeKey||''}:${initialQuery}:${initialFilters.provider}:${initialFilters.truck}`} initialQuery={initialQuery} initialMode={initialMode} initialFilters={initialFilters} business={business} showModeSwitch={!session||Boolean(workspace?.permissions.capacity)}/>;
}
export function BusinessCapacityMap({context}:{context:BusinessCapacityContext}){return <Capacity key={context.scopeKey} initialQuery="" initialMode="private" initialFilters={{}} business={context}/>;}
export function AccountCapacityMap({context}:{context:AccountCapacityContext}){return <Capacity key={context.scopeKey} initialQuery="" initialMode="private" initialFilters={{}} account={context}/>;}
export function PublicCapacityHome({active}:{active:boolean}){const {data}=useAccountQuery<CapacityWorkspace>('/api/mobile/capacity');return <Capacity initialQuery="" initialMode="open" initialFilters={{}} ownSignalIds={data?.vehicles.map(vehicle=>vehicle.current?.id).filter((id):id is string=>Boolean(id))} active={active}/>;}
function Capacity({initialQuery,initialMode,initialFilters,business,account,ownSignalIds,showModeSwitch=false,active=true}:{initialQuery:string;initialMode:'open'|'private';initialFilters:TruckFilters;business?:BusinessCapacityContext;account?:AccountCapacityContext;ownSignalIds?:string[];showModeSwitch?:boolean;active?:boolean}) {
  const {t}=useLanguage();
  const [focused,setFocused]=useState(false);
  useFocusEffect(useCallback(()=>{setFocused(active);return()=>setFocused(false);},[active]));
  const visitor = useVisitor(), visitorController = visitor.controller;
  const [filters,setFilters]=useState<TruckFilters>(initialFilters),[filtersOpen,setFiltersOpen]=useState(false),[drawer,setDrawer]=useState(false);
  const {blocked}=useBlockedProviders(),blockKey=JSON.stringify(blocked);
  const effectiveFilters=useMemo(()=>({...filters,...(blocked.length?{blocked:blockKey}:{})}),[filters,blockKey,blocked.length]);
  const filterKey=JSON.stringify(effectiveFilters);
  const [controlsHeight,setControlsHeight]=useState(48);
  const bottomInset=20;
  const mode=initialMode;
  const sharedIdentity = visitor.snapshot.capacity?.startedAt, sharedReady = Boolean(business||account||visitor.ready && visitor.snapshot.foreground && sharedIdentity);
  const [query, setQuery] = useState(''), [revision, setRevision] = useState(0);
  const [refreshTick,setRefreshTick]=useState(0);
  const refreshCapacity=useCallback(async()=>{setRefreshTick(value=>value+1);},[]);
  const profileFilters=useMemo<TruckFilters>(()=>blocked.length?{blocked:blockKey}:{},[blockKey,blocked.length]);
  const requestKey = `${business?.scopeKey||account?.scopeKey||''}:${mode}:${query}:${filterKey}:${revision}:${business||account?'':sharedIdentity || ''}:${sharedReady}`;
  const canLoad = mode === 'open' || sharedReady;
  useForegroundRefresh(refreshCapacity,focused&&canLoad,60000);
  const [result, setResult] = useState<{ key: string; items: CapacitySignal[]; loading: boolean; error: string } | null>(null);
  const [selection, setSelection] = useState<{ key: string; signal: CapacitySignal } | null>(null);
  const selectionRef=useRef(selection);
  useEffect(()=>{selectionRef.current=selection;},[selection]);
  const [initialSelectionActive,setInitialSelectionActive]=useState(Boolean(initialFilters.truck));
  const clearSelection=useCallback(()=>{setInitialSelectionActive(false);setSelection(null);},[]);
  const searchScopeKey=`${business?.scopeKey||account?.scopeKey||''}:${mode}:${JSON.stringify(profileFilters)}:${business||account?'':sharedIdentity||''}:${sharedReady}`;
  const loadProfiles=useCallback((query:string,page:number,signal:AbortSignal)=>{
    if(business)return business.request(`/api/business-workspaces/${encodeURIComponent(business.workspaceId)}/capacity/discovery?${discoveryParams(query,{},page)}`);
    if(account)return account.request(`/api/mobile/account-capacity/search?${discoveryParams(query,{},page)}`);
    const params=discoveryParams(query,profileFilters,page),path=`/api/mobile/${mode==='private'?'visitor/capacity/search':'public/discovery'}?${params}`;
    return mode==='private'?visitorController.request('capacity',path,undefined,signal):apiRequest(path,{signal});
  },[mode,profileFilters,visitorController,business,account]);
  const search=useTransporterSearch({initialInput:initialQuery,enabled:focused&&drawer&&canLoad,scopeKey:searchScopeKey,load:loadProfiles});
  const {input,cancel:cancelSearch}=search,validSearch=transporterSearchQuery(input);
  useEffect(()=>{
    if(!focused||!drawer)return;
    const subscription=BackHandler.addEventListener('hardwareBackPress',()=>{
      cancelSearch();setDrawer(false);return true;
    });
    return()=>subscription.remove();
  },[focused,drawer,cancelSearch]);
  const profileState=search.state;
  const profileResult=profileState?.result||null;
  const current = result?.key === requestKey ? result : null;
  const items = current?.items || emptySignals, loading = canLoad && (current?.loading ?? true), error = current?.error || '';
  const selected=selection?.key===requestKey?items.find(item=>item.id===selection.signal.id)||null:initialSelectionActive?items.find(item=>item.id===initialFilters.truck)||null:null;
  const selectMapSignal=useCallback((signal:CapacitySignal)=>{cancelSearch();setInitialSelectionActive(false);setSelection({key:requestKey,signal});setDrawer(false);},[requestKey,cancelSearch]);
  const setSelected=(signal:CapacitySignal|null)=>{if(signal)selectMapSignal(signal);else clearSelection();};
  useEffect(() => {
    if (!canLoad) return;
    const controller = new AbortController();
    let timeout = setTimeout(() => controller.abort('timeout'), 30000);
    let finalItems:CapacitySignal[]=[];
    const onPage = (items: CapacitySignal[]) => { if (!controller.signal.aborted) {finalItems=items;clearTimeout(timeout);timeout=setTimeout(()=>controller.abort('timeout'),30000);setResult({ key: requestKey, items, loading: true, error: '' });} };
    const loading = business?loadBusinessCapacity(business.workspaceId,controller.signal,onPage,business.request,effectiveFilters):account?loadAccountCapacity(controller.signal,onPage,account.request,effectiveFilters):mode === 'private' ? loadSharedCapacity(query, controller.signal, onPage, (path, signal) => visitorController.request('capacity', path, undefined, signal), effectiveFilters) : loadCapacity(apiOrigin, query, controller.signal, onPage, fetch, effectiveFilters);
    loading.then(()=>{if((business||account)&&!controller.signal.aborted&&selectionRef.current?.key===requestKey&&!finalItems.some(item=>item.id===selectionRef.current?.signal.id))clearSelection();}).catch(error => {
      const denied=Boolean((business||account)&&error instanceof ApiError&&[401,403,404].includes(error.status));
      if(denied)clearSelection();
      if (!controller.signal.aborted || controller.signal.reason === 'timeout') setResult(previous => ({ key: requestKey, items: !denied&&previous?.key === requestKey ? previous.items : [], loading: false, error: 'Could not finish loading vehicles. Please try again.' }));
    }).finally(() => { clearTimeout(timeout); if (!controller.signal.aborted || controller.signal.reason === 'timeout') setResult(previous => previous?.key === requestKey ? { ...previous, loading: false } : { key: requestKey, items: [], loading: false, error: '' }); });
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [query, requestKey, canLoad, mode, visitorController, effectiveFilters,business,account,refreshTick,clearSelection]);
  const resetResults=()=>{setResult(null);clearSelection();};
  const submitSearch=()=>{Keyboard.dismiss();search.submit();};
  const closeSearch=()=>{search.cancel();setDrawer(false);};
  const showProfile=(profile:ProfileResult)=>{if(!search.isCurrent())return;resetResults();setQuery('');setFilters(profileTruckFilters(filters,profile));closeSearch();};
  return <View style={styles.screen}>
    {showModeSwitch&&<><View style={styles.intro}><Text style={styles.title}>{t(capacityIntroduction.title)}</Text><Text style={styles.copy}>{t(capacityIntroduction.body)}</Text></View>
    <View style={{ flexDirection: 'row', marginHorizontal: 12, marginBottom: 8, padding: 3, gap: 4, borderWidth: 1, borderColor: palette.border, borderRadius: 9, backgroundColor: '#f3f5f8' }}>{([['open', 'Open to the public'], ['private', 'Shared with you']] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="tab" aria-selected={mode === value} accessibilityState={{ selected: mode === value }} onPress={() => { if(value===mode)return;router.replace(value==='private'?'/?view=private':'/'); }} style={{ flex: 1, minHeight: 36, borderWidth: 1, borderColor: mode === value ? '#cbd5e1' : 'transparent', borderRadius: 7, padding: 6, justifyContent: 'center', backgroundColor: mode === value ? '#eaf1ff' : 'transparent' }}><Text style={{ color: mode === value ? palette.blue : palette.muted,fontSize:11, fontWeight: mode === value ? '700' : '600', textAlign: 'center' }}>{t(label)}</Text></Pressable>)}</View></>}
    <View testID="capacity-map-workspace" style={styles.map}><CapacityMap key={requestKey} items={mode === 'private' && !sharedReady ? emptySignals : items} ownSignalIds={ownSignalIds} selected={selected} loading={loading} topInset={controlsHeight+20} bottomInset={bottomInset} onSelect={selectMapSignal} onDeselect={clearSelection} />
      {canLoad&&<View onLayout={event=>setControlsHeight(event.nativeEvent.layout.height)} style={{position:'absolute',top:12,left:12,right:12,flexDirection:'row',gap:8}}><Pressable accessibilityRole="button" accessibilityLabel={t('Search transporters')} accessibilityState={{expanded:drawer}} onPress={()=>{if(selected)setSelected(null);if(drawer)closeSearch();else setDrawer(true);}} style={styles.mapButton}><AppIcon name="search" size={19} color={palette.blue}/><Text style={styles.link}>{t('Search')}</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel={t('Vehicle filters')} onPress={()=>setFiltersOpen(true)} style={styles.mapButton}><AppIcon name="filters" size={19} color={palette.blue}/><Text style={styles.link}>{t('Filter')}{filterCount(peopleSearchFilters(filters))?` (${filterCount(peopleSearchFilters(filters))})`:''}</Text></Pressable></View>}
      {drawer&&canLoad&&<ResultsDrawer top={controlsHeight+20} bottom={bottomInset} onClosing={search.cancel} onClose={closeSearch}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:14,gap:14}}><View style={styles.search}><View style={styles.inputFrame}><TextInput accessibilityLabel={t('Search transporters')} placeholder={t('Account name, manager or @handle')} placeholderTextColor="#526875" value={input} maxLength={120} onChangeText={search.changeInput} onSubmitEditing={submitSearch} returnKeyType="search" style={styles.input}/><Pressable accessibilityRole="button" accessibilityLabel={t('Clear search')} onPress={search.clear} style={styles.inputClear}><AppIcon name="close" color="#155eef" size={19}/></Pressable></View><Pressable accessibilityRole="button" accessibilityLabel={t('Search')} accessibilityState={{disabled:!validSearch}} disabled={!validSearch} onPress={submitSearch} style={[styles.button,!validSearch&&{opacity:0.55}]}><AppIcon name="search" color="#fff"/></Pressable></View>{!validSearch?<Text style={styles.copy}>{t(input.trim()?'Enter at least two characters.':'Search by account name, manager, @handle or city.')}</Text>:profileState?<DiscoveryResults result={profileResult} loading={profileState.loading} error={profileState.error} onPage={search.onPage} onRetry={search.retry} onMap={showProfile}/>:<LoadingBar label="Finding transporters"/>}</ScrollView></ResultsDrawer>}
      {loading && <View style={styles.loading}><LoadingBar label="Loading vehicle availability"/></View>}
      {!!error && !drawer && <View style={[styles.notice,{top:controlsHeight+20}]}><Text accessibilityRole="alert">{error}</Text><Pressable accessibilityRole="button" onPress={() => { resetResults(); setRevision(value => value + 1); }} style={styles.clear}><Text style={styles.link}>{t('Try again')}</Text></Pressable></View>}
      {!drawer && !loading && !error && items.length === 0 && (mode === 'open' || sharedReady) && <View style={[styles.notice,{top:controlsHeight+20}]}><Text>{t(account?'No vehicles are shared with this account yet.':'No matching available vehicles.')}</Text>{account?.networkHref?<Pressable accessibilityRole="button" onPress={()=>router.navigate(account.networkHref!)} style={{minHeight:44,justifyContent:'center'}}><Text style={styles.link}>{t('Open Network')}</Text></Pressable>:null}</View>}
    </View>

    {filtersOpen&&canLoad&&<DiscoveryFilters initial={peopleSearchFilters(filters)} configurations={profileResult?.configurations||[...VEHICLE_CONFIGURATIONS]} onClose={()=>setFiltersOpen(false)} onClearProfile={filters.provider||filters.truck||query?()=>{resetResults();setFilters(peopleSearchFilters(filters));setQuery('');}:undefined} onApply={next=>{resetResults();setFilters({...next,provider:filters.provider,truck:filters.truck});setFiltersOpen(false);setRevision(v=>v+1);}}/>}
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' }, header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 9 }, logo: { width: 36, height: 36 }, brand: { fontSize: 24, fontWeight: '700', color: '#155eef' },
  intro: { paddingHorizontal: 16, paddingTop:8, paddingBottom: 8 }, title: { fontSize: 18, fontWeight: '700', color: '#0b1d3a', flexShrink: 1 }, copy: { fontSize: 12, lineHeight: 17, color: palette.muted, marginTop: 4 },
  search: { flexDirection: 'row',gap:8 }, inputFrame:{flex:1,minWidth:0,flexDirection:'row',borderWidth:1,borderColor:'#cbd5e1',borderRadius:12}, input: { flex: 1,minWidth:0,color:'#0b1d3a',fontSize:16,paddingHorizontal:10,minHeight:48 }, inputClear:{minHeight:48,minWidth:44,alignItems:'center',justifyContent:'center'}, button: { minHeight:48,minWidth:48,backgroundColor:'#155eef',borderRadius:12,alignItems:'center',justifyContent:'center' }, buttonText: { color: '#fff', fontWeight: '700' }, clear: { minHeight: 48, minWidth: 48, padding: 10, justifyContent: 'center' }, link: { flexShrink:1, color: '#155eef', fontWeight: '700' },
  map: { flex: 1 }, mapButton:{flex:1,flexDirection:"row",alignItems:"center",gap:6,minHeight:46,paddingHorizontal:12,paddingVertical:12,backgroundColor:"#fff",borderRadius:12,borderWidth:1,borderColor:"#cbd5e1"}, results:{position:"absolute",top:68,left:12,bottom:12,width:"88%",maxWidth:360,backgroundColor:"#fff",borderRadius:16,borderWidth:1,borderColor:"#cbd5e1",overflow:"hidden"}, loading: { position: 'absolute', top: 0, left: 0, right:0, backgroundColor: '#fff' }, notice: { position: 'absolute', top: 68, left: 16, right: 16, borderRadius: 12, backgroundColor: '#fff', padding: 16 },
  chatRow:{position:'absolute',left:8,right:8,bottom:40,alignItems:"flex-end"},chat:{minHeight:48,maxWidth:'100%',flexShrink:1,flexDirection:"row",gap:9,alignItems:"center",backgroundColor:"#155eef",paddingVertical:8,paddingHorizontal:14,borderRadius:13},
  detail: { padding: 18, maxHeight: 230, borderTopWidth: 1, borderColor: palette.borderSoft }, detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, age: { color: '#526875', fontSize: 12, marginTop: 6 },
});
