import {useCallback,useEffect,useRef,useState} from 'react';
import {ScrollView,Text,View} from 'react-native';
import {useLocalSearchParams} from 'expo-router';
import {useTrackingSession} from '../session/tracking-session-provider';
import {useLanguage} from '../localization/provider';
import {Button,Copy,ErrorText,Field,LoadingSpinner,palette} from '../components/ui';
import {statusLabel} from '../api/tracking';
import {TrackingWorkspace} from '../components/tracking-workspace';
import {TrackingMap} from '../components/tracking-map';
import {Map,Camera} from '../components/map-platform';
import {mapStyle} from '../components/map-style';
import {trackingRefreshAllowed,trackingRefreshDelay} from '../../../../src/lib/tracking-refresh-policy.js';
export default function VisitorTracking(){const {linkToken}=useLocalSearchParams<{linkToken?:string}>();return <TrackingLinkAccess linkToken={typeof linkToken==='string'?linkToken:undefined}/>;}
export function TrackingLinkAccess(props:{linkToken?:string;sessionId?:string}){return <TrackingLinkAccessView key={`${props.linkToken||''}:${props.sessionId||''}`} {...props}/>;}
function TrackingLinkAccessView({linkToken,sessionId}:{linkToken?:string;sessionId?:string}){
 const {controller,snapshot}=useTrackingSession(),{t}=useLanguage(),lock=useRef(false);
 const [link,setLink]=useState(''),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const matchingLink=!linkToken||controller.matchesLink(linkToken),view=matchingLink&&snapshot.session&&(!sessionId||snapshot.session.id===sessionId)?snapshot.session:null;
 useEffect(()=>{if(linkToken&&!controller.matchesLink(linkToken))void controller.clear();},[linkToken,controller]);
 async function open(){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await controller.open(linkToken||link,code);setCode('');setLink('');}catch{setError('This Tracking link or code is unavailable. Check both and try again.');}finally{lock.current=false;setBusy(false);}}
 if(view)return <TrackingGuestView/>;
 if(matchingLink&&snapshot.sessionId&&!snapshot.foreground)return <TrackingEntrySurface><Copy message="Private access is paused while the app is in the background."/></TrackingEntrySurface>;
 if(matchingLink&&snapshot.sessionId&&snapshot.needsRead)return <TrackingEntrySurface><LoadingSpinner/><Copy message="Checking Tracking access"/><Button secondary message="Refresh updates" onPress={()=>void controller.read(snapshot.sessionId!).catch(()=>setError('Could not refresh Tracking. Please try again.'))}/><ErrorText message={error||snapshot.notice}/></TrackingEntrySurface>;
 return <TrackingEntrySurface><Text accessibilityRole="header" style={{fontSize:24,fontWeight:'700',color:palette.ink}}>{t('Follow your shipment')}</Text><Copy message="Open the shared link and enter its separate code."/>{!!snapshot.notice&&<Copy>{t(snapshot.notice)}</Copy>}{!linkToken&&<Field message="Tracking link" value={link} onChangeText={setLink} autoCapitalize="none" autoComplete="off" maxLength={2048} editable={!busy}/>}<Field message="Tracking code" value={code} onChangeText={value=>setCode(value.toUpperCase())} autoCapitalize="characters" autoComplete="off" maxLength={9} placeholder="XXXX-XXXX" editable={!busy}/><Copy message="The link and code open this load only."/><ErrorText message={error}/><Button message="Open tracking" busy={busy} onPress={()=>void open()}/></TrackingEntrySurface>;
}
function TrackingEntrySurface({children}:{children:import('react').ReactNode}){
 return <View style={{flex:1,minHeight:300}}><View style={{position:'absolute',top:0,left:0,right:0,bottom:0}}><Map style={{flex:1}} mapStyle={mapStyle} attribution><Camera initialViewState={{center:[39.5,9],zoom:5}}/></Map></View><ScrollView keyboardShouldPersistTaps="handled" pointerEvents="box-none" style={{flexGrow:0,maxHeight:'100%'}} contentContainerStyle={{padding:18,paddingBottom:40}}><View style={{padding:20,borderRadius:16,backgroundColor:'#fff',gap:14}}>{children}</View></ScrollView></View>;
}

function TrackingGuestView(){
 const {controller,snapshot}=useTrackingSession(),session=snapshot.session,{t}=useLanguage();
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),failures=useRef(0);
 const refresh=useCallback(async()=>{if(busy||!session)return;setBusy(true);setError('');try{await controller.read(session.id);failures.current=0;}catch{failures.current=Math.min(2,failures.current+1);setError('Could not refresh Tracking. Please try again.');}finally{setBusy(false);}},[busy,session,controller]);
 useEffect(()=>{if(!session)return;const active=session.state==='PENDING_PROVIDER'||!['COMPLETED','CANCELLED'].includes(session.tracking?.status||'');if(!trackingRefreshAllowed({active,visible:snapshot.foreground,expiresAt:snapshot.expiresAt,now:Date.now()}))return;const timer=setTimeout(()=>{if(trackingRefreshAllowed({active,visible:snapshot.foreground,expiresAt:snapshot.expiresAt,now:Date.now()}))void refresh();},trackingRefreshDelay(failures.current));return()=>clearTimeout(timer);},[session,busy,error,snapshot.foreground,snapshot.expiresAt,refresh]);
 if(!session)return null;
 if(session.state==='PENDING_PROVIDER')return <View style={{flex:1,minHeight:300}}><TrackingMap fill route={session.route}/><View style={{position:'absolute',left:12,right:12,bottom:16,padding:14,borderRadius:12,backgroundColor:'#fff',gap:9}}><Copy>{session.reference}</Copy><Copy message="Waiting for a Transport Provider to connect. No vehicle location is shared yet."/><Copy>{session.cargoSummary}</Copy><ErrorText message={error}/><Button secondary message="Refresh updates" busy={busy} onPress={()=>void refresh()}/><Button secondary message="Close Tracking" onPress={()=>void controller.clear()}/></View></View>;
 const tracking=session.state==='CONNECTED'?session.tracking:null,location=tracking?.location;
 return <TrackingWorkspace code={session.reference} status={tracking?.status||'CREATED'} route={session.route} location={location?{latitude:location.coordinate[1],longitude:location.coordinate[0],radius:location.radiusKm,area:location.label,updatedAt:location.updatedAt,source:location.source,...location.demo?{demo:true as const}:{}}:null} truck={null} recordedStatuses={tracking?.events.map(event=>event.status)}>
  <Copy>{session.cargoSummary}</Copy><ErrorText message={error}/><Button secondary message="Refresh updates" busy={busy} onPress={()=>void refresh()}/><Button secondary message="Close Tracking" onPress={()=>void controller.clear()}/>{tracking?.events.map(event=><View key={event.id} style={{gap:4,paddingVertical:8}}><Text style={{fontWeight:'700',color:palette.ink}}>{t(statusLabel(event.status))}</Text><Copy>{new Date(event.createdAt).toLocaleString()}</Copy>{!!event.note&&<Copy>{event.note}</Copy>}</View>)}
 </TrackingWorkspace>;
}
