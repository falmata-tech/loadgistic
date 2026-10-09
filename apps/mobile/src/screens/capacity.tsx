import {useChatUpdates} from '../session/chat-alert-provider';
import { useLanguage } from '../localization/provider';
import { useVisitor } from '../session/visitor-provider';
import { VisitorAccess } from '../components/visitor-access';
import {AppIcon} from '../components/app-icon';
import { Link, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import CapacityMap from '../components/CapacityMap';
import { apiOrigin,apiRequest } from '../api/http';
import { discoveryParams,filterCount,parseDiscovery,type TruckFilters,type DiscoveryResult,type ProfileResult } from '../api/discovery';
import { DiscoveryFilters } from '../components/discovery-filters';
import { ResultsDrawer } from '../components/results-drawer';
import { VEHICLE_CONFIGURATIONS } from '../../../../src/lib/vehicle-configurations';
import { DiscoveryResults } from '../components/discovery-results';
import { LoadingBar } from '../components/loading-bar';
import { loadCapacity, loadSharedCapacity, type CapacitySignal } from '../api/public-capacity';

const emptySignals:CapacitySignal[]=[];

export default function App() {
  const params = useLocalSearchParams<{q?:string}>();
  const initialQuery = typeof params.q === 'string' ? params.q : '';
  return <Capacity key={initialQuery} initialQuery={initialQuery} />;
}
function Capacity({initialQuery}:{initialQuery:string}) {
  const {t}=useLanguage(),updates=useChatUpdates();
  const visitor = useVisitor(), visitorController = visitor.controller;
  const [filters,setFilters]=useState<TruckFilters>({}),[filtersOpen,setFiltersOpen]=useState(false),[drawer,setDrawer]=useState(false),[page,setPage]=useState(1);
  const filterKey=JSON.stringify(filters);
  const [controlsHeight,setControlsHeight]=useState(48);
  const [mode, setMode] = useState<'open' | 'private'>('open');
  const sharedIdentity = visitor.snapshot.capacity?.startedAt, sharedReady = Boolean(visitor.ready && visitor.snapshot.foreground && sharedIdentity);
  const [input, setInput] = useState(initialQuery), [query, setQuery] = useState(initialQuery), [revision, setRevision] = useState(0);
  const requestKey = `${mode}:${query}:${filterKey}:${revision}:${sharedIdentity || ''}:${sharedReady}`;
  const canLoad = mode === 'open' || sharedReady;
  const [result, setResult] = useState<{ key: string; items: CapacitySignal[]; loading: boolean; error: string } | null>(null);
  const [selection, setSelection] = useState<{ key: string; signal: CapacitySignal } | null>(null);
  const clearSelection=useCallback(()=>setSelection(null),[]);
  const profileKey=`${requestKey}:page:${page}`;
  const [profiles,setProfiles]=useState<{key:string;result:DiscoveryResult|null;error:string;loading:boolean}|null>(null);
  const profileState=profiles?.key===profileKey?profiles:null;
  const profileResult=profileState?.result||null;
  const current = result?.key === requestKey ? result : null;
  const items = current?.items || emptySignals, loading = canLoad && (current?.loading ?? true), error = current?.error || '';
  const selected = selection?.key === requestKey ? selection.signal : null;
  const selectMapSignal=useCallback((signal:CapacitySignal)=>{setSelection({key:requestKey,signal});setDrawer(false);},[requestKey]);
  const setSelected = (signal: CapacitySignal | null) => setSelection(signal ? { key: requestKey, signal } : null);
  useEffect(() => {
    if (!canLoad) return;
    const controller = new AbortController();
    let timeout = setTimeout(() => controller.abort('timeout'), 30000);
    const onPage = (items: CapacitySignal[]) => { if (!controller.signal.aborted) {clearTimeout(timeout);timeout=setTimeout(()=>controller.abort('timeout'),30000);setResult({ key: requestKey, items, loading: true, error: '' });} };
    const loading = mode === 'private' ? loadSharedCapacity(query, controller.signal, onPage, (path, signal) => visitorController.request('capacity', path, undefined, signal), filters) : loadCapacity(apiOrigin, query, controller.signal, onPage, fetch, filters);
    loading.catch(() => {
      if (!controller.signal.aborted || controller.signal.reason === 'timeout') setResult(previous => ({ key: requestKey, items: previous?.key === requestKey ? previous.items : [], loading: false, error: 'Could not finish loading trucks. Please try again.' }));
    }).finally(() => { clearTimeout(timeout); if (!controller.signal.aborted || controller.signal.reason === 'timeout') setResult(previous => previous?.key === requestKey ? { ...previous, loading: false } : { key: requestKey, items: [], loading: false, error: '' }); });
    return () => { controller.abort(); clearTimeout(timeout); };
  }, [query, requestKey, canLoad, mode, visitorController, filters]);
  useEffect(()=>{
    if(!canLoad)return;const controller=new AbortController();
    const params=discoveryParams(query,filters,page),path=`/api/mobile/${mode==='private'?'visitor/capacity/search':'public/discovery'}?${params}`;
    const promise=mode==='private'?visitorController.request('capacity',path,undefined,controller.signal):apiRequest(path,{signal:controller.signal});
    promise.then(raw=>{const data=parseDiscovery(raw);if(!controller.signal.aborted)setProfiles({key:profileKey,result:data,error:'',loading:false});}).catch(error=>{if(!controller.signal.aborted)setProfiles({key:profileKey,result:null,loading:false,error:error instanceof Error?error.message:'Could not load transporters.'});});
    return()=>controller.abort();
  },[profileKey,canLoad,mode,query,filters,page,visitorController]);
  const resetResults = () => { setResult(null); setSelection(null); };
  const search = () => { resetResults(); Keyboard.dismiss(); setQuery(input.trim()); setPage(1);setDrawer(true); setRevision(value => value + 1); };
  const clearAll=()=>{resetResults();setFilters({});setInput('');setQuery('');setPage(1);setRevision(v=>v+1);};
  const showProfile=(profile:ProfileResult)=>{resetResults();setQuery('');setInput('');setFilters({...filters,provider:profile.kind==='COMPANY_DRIVER'?'':profile.handle,truck:profile.kind==='COMPANY_DRIVER'?profile.capacityId:''});setPage(1);setDrawer(false);};
  return <View style={styles.screen} onTouchStart={()=>{if(mode==='private'&&sharedReady)void visitorController.touch('capacity').catch(()=>undefined);}}>
    <View style={styles.intro}><Text style={styles.title}>{t('Find truck capacity')}</Text><Text style={styles.copy}>{t('Transporters share availability and routes with brokers, shippers and receivers.')}</Text></View>
    <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 12, gap: 8 }}>{([['open', 'Open to the public'], ['private', 'Privately shared with you']] as const).map(([value, label]) => <Pressable key={value} accessibilityRole="tab" accessibilityState={{ selected: mode === value }} onPress={() => { resetResults(); setMode(value);setPage(1);setDrawer(false); }} style={{ flex: 1, minHeight: 48, borderWidth: 1, borderColor: '#0c7275', borderRadius: 12, padding: 10, justifyContent: 'center', backgroundColor: mode === value ? '#0c7275' : '#fff' }}><Text style={{ color: mode === value ? '#fff' : '#0c7275', fontWeight: '600', textAlign: 'center' }}>{t(label)}</Text></Pressable>)}</View>
    {mode === 'private' && sharedReady && <Pressable accessibilityRole="button" onPress={() => { void visitorController.clear('capacity').catch(() => setResult({ key: requestKey, items: [], loading: false, error: 'Could not clear saved email access. Try closing it again.' })); }} style={{ paddingHorizontal: 18, paddingVertical: 12 }}><Text style={styles.link}>{t('Close private access')}</Text></Pressable>}
    <View style={styles.search}><TextInput accessibilityLabel={t('Search transporters')} placeholder={t('Name, handle or city')} placeholderTextColor="#526875" value={input} maxLength={120} onChangeText={setInput} onSubmitEditing={search} returnKeyType="search" style={styles.input} /><Pressable accessibilityRole="button" accessibilityLabel={t('Search')} onPress={search} style={styles.button}><AppIcon name="search" color="#fff"/></Pressable></View>
    <View style={styles.map} onTouchStart={() => { if (mode === 'private') void visitorController.touch('capacity').catch(() => undefined); }}><CapacityMap key={requestKey} items={mode === 'private' && !sharedReady ? emptySignals : items} selected={selected} loading={loading} onSelect={selectMapSignal} onDeselect={clearSelection} />
      {canLoad&&<View onLayout={event=>setControlsHeight(event.nativeEvent.layout.height)} style={{position:'absolute',top:12,left:12,right:12,flexDirection:'row',gap:8}}><Pressable accessibilityRole="button" accessibilityState={{expanded:drawer}} onPress={()=>{if(selected)setSelected(null);setDrawer(!drawer);}} style={styles.mapButton}><AppIcon name="results" size={19} color="#0c7275"/><Text style={styles.link}>{drawer?t('Hide results'):`${t('Results')}${profileResult?` (${profileResult.total})`:''}`}</Text></Pressable><Pressable accessibilityRole="button" onPress={()=>setFiltersOpen(true)} style={styles.mapButton}><AppIcon name="filters" size={19} color="#0c7275"/><Text style={styles.link}>{t('Truck filters')}{filterCount(filters)?` (${filterCount(filters)})`:''}</Text></Pressable>{!!(query||filterCount(filters))&&<Pressable accessibilityRole="button" accessibilityLabel={t('Clear all')} onPress={clearAll} style={[styles.mapButton,{flex:0}]}><AppIcon name="close" color="#0c7275"/></Pressable>}</View>}
      {drawer&&canLoad&&<ResultsDrawer top={controlsHeight+20} onClose={()=>setDrawer(false)}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{padding:14}}><DiscoveryResults result={profileResult} loading={profileState?.loading??true} error={profileState?.error||''} onPage={setPage} onRetry={()=>setRevision(v=>v+1)} onMap={showProfile}/></ScrollView></ResultsDrawer>}
      {loading && <View accessibilityRole="progressbar" accessibilityLabel="Loading truck availability" style={styles.loading}><LoadingBar label="Loading truck availability"/></View>}
      {!!error && !drawer && <View style={[styles.notice,{top:controlsHeight+20}]}><Text accessibilityRole="alert">{error}</Text><Pressable accessibilityRole="button" onPress={() => { resetResults(); setRevision(value => value + 1); }} style={styles.clear}><Text style={styles.link}>{t('Try again')}</Text></Pressable></View>}
      {!drawer && !loading && !error && items.length === 0 && (mode === 'open' || sharedReady) && <View style={[styles.notice,{top:controlsHeight+20}]}><Text>{t('No matching available trucks.')}</Text></View>}
      {mode === 'private' && !sharedReady && <ScrollView keyboardShouldPersistTaps="handled" style={{ position: 'absolute', top: 12, left: 12, right: 12, bottom: 12 }} contentContainerStyle={{ backgroundColor: '#fff', borderRadius: 16 }}><VisitorAccess scope="capacity" /></ScrollView>}
    </View>
    <View style={styles.chatRow}><Link href="/arrange-transport" asChild><Pressable accessibilityRole="button" accessibilityLabel={t('Need help with transport?')} style={styles.chat}><AppIcon name="chat" color="#fff" size={21}/><View style={{flexShrink:1}}><Text style={styles.buttonText}>{t('Need help with transport?')}</Text><Text style={{fontSize:11,color:'#fff'}}>{t('Let us handle it')} · {t('Live chat')}</Text></View>{updates.transportUnreadCount>0&&<View style={{borderRadius:12,paddingHorizontal:6,paddingVertical:3,backgroundColor:'#ffcb05'}}><Text style={{fontWeight:'800',fontSize:12,color:'#172c46'}}>{updates.transportUnreadCount}</Text></View>}</Pressable></Link></View>

    {filtersOpen&&canLoad&&<DiscoveryFilters initial={filters} configurations={profileResult?.configurations||[...VEHICLE_CONFIGURATIONS]} onClose={()=>setFiltersOpen(false)} onApply={next=>{resetResults();setFilters(next);setFiltersOpen(false);setPage(1);setRevision(v=>v+1);}}/>}
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' }, header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 9 }, logo: { width: 36, height: 36 }, brand: { fontSize: 24, fontWeight: '700', color: '#0c7275' },
  intro: { paddingHorizontal: 16, paddingTop:12, paddingBottom: 12 }, title: { fontSize: 20, fontWeight: '700', color: '#172c46', flexShrink: 1 }, copy: { fontSize: 14, lineHeight: 21, color: '#526875', marginTop: 5 },
  search: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 12, gap: 8 }, input: { flex: 1, color:'#172c46',fontSize:16,borderWidth: 1, borderColor: '#cbdadb', borderRadius: 12, paddingHorizontal: 12, minHeight: 48 }, button: { backgroundColor: '#0c7275', borderRadius: 12, padding: 13, justifyContent: 'center' }, buttonText: { color: '#fff', fontWeight: '700' }, clear: { minHeight: 48, minWidth: 48, padding: 10, justifyContent: 'center' }, link: { flexShrink:1, color: '#0c7275', fontWeight: '700' },
  map: { flex: 1 }, mapButton:{flex:1,flexDirection:"row",alignItems:"center",gap:6,minHeight:46,paddingHorizontal:12,paddingVertical:12,backgroundColor:"#fff",borderRadius:12,borderWidth:1,borderColor:"#cbdadb"}, results:{position:"absolute",top:68,left:12,bottom:12,width:"88%",maxWidth:360,backgroundColor:"#fff",borderRadius:16,borderWidth:1,borderColor:"#cbdadb",overflow:"hidden"}, loading: { position: 'absolute', top: 0, left: 0, right:0, backgroundColor: '#fff' }, notice: { position: 'absolute', top: 68, left: 16, right: 16, borderRadius: 12, backgroundColor: '#fff', padding: 16 },
  chatRow:{padding:8,alignItems:"flex-end",backgroundColor:"#f4f8f8"},chat:{minHeight:48,maxWidth:'100%',flexShrink:1,flexDirection:"row",gap:9,alignItems:"center",backgroundColor:"#0c7275",paddingVertical:8,paddingHorizontal:14,borderRadius:13},
  detail: { padding: 18, maxHeight: 230, borderTopWidth: 1, borderColor: '#d6e4e4' }, detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, age: { color: '#526875', fontSize: 12, marginTop: 6 },
});
