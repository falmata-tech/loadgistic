import {TrackingRequests} from './connect-tracking';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {AppState,Share,Text,View} from 'react-native';
import {useAccount} from '../session/provider';
import {useAccountQuery} from '../hooks/account-query';
import {useLanguage} from '../localization/provider';
import {statusLabel} from '../api/tracking';
import {trackingData,trackingSessionViewSchema,trackingSessionIssueSchema,trackingSessionListSchema,type TrackingSessionView} from '../api/tracking-sessions';
import {trackingSessionCreate,type TrackingSessionIssue} from '../../../../src/lib/tracking-sessions/contracts';
import {trackingLinkToken} from '../../../../src/lib/tracking-sessions/client';
import {Button,Card,Copy,ErrorText,Field,LoadingSpinner,Title,palette} from './ui';
import {PlacePicker,emptyPlace} from './place-picker';
import {DatePicker} from './date-picker';
import {Choices} from './choices';
import {PrivateFile} from './private-file';
import {TrackingMap} from './tracking-map';
import {Switch} from './branded-switch';
import {TrackingTeamAccess} from './tracking-team-access';
import {useForegroundRefresh} from '../hooks/foreground-refresh';
import {TRACKING_REFRESH_INTERVAL_MS,trackingShipmentActiveStatus} from '../../../../src/lib/tracking-refresh-policy.js';
type Business={id:string;name:string;handle:string};
type ManagerProps={sessionId:string;workspaceId?:string;businesses?:Business[]};
export function TrackingSessionManager(props:ManagerProps){
 const account=useAccount();return <TrackingSessionManagerView key={`${account.session?.user.id||''}:${props.sessionId}:${props.workspaceId||''}`} {...props}/>;
}
function TrackingSessionManagerView({sessionId,workspaceId,businesses=[]}:ManagerProps){
 const account=useAccount(),{t}=useLanguage(),path=`/api/tracking/sessions/${sessionId}`,query=useAccountQuery<unknown>(`${path}?view=manager${workspaceId?`&workspaceId=${workspaceId}`:''}`);
 const [issued,setIssued]=useState<TrackingSessionIssue|null>(null),[days,setDays]=useState('7'),[allowLocation,setAllowLocation]=useState(false),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[error,setError]=useState(''),lock=useRef(false);
 const [rating,setRating]=useState('5'),[reviewNote,setReviewNote]=useState(''),[reviewTerms,setReviewTerms]=useState(false);
 const mounted=useRef(false),[seenData,setSeenData]=useState(query.data);
 let data:TrackingSessionView|null=null;try{if(query.data){data=trackingData(query.data,trackingSessionViewSchema);if(data.id!==sessionId)data=null;}}catch{}
 if(seenData!==query.data){setSeenData(query.data);if(query.data===null&&!query.loading)setIssued(null);}
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{const listener=AppState.addEventListener('change',state=>{if(state!=='active')setIssued(null);});return()=>listener.remove();},[]);
 const refreshQuery=query.refresh,autoRefresh=useCallback(async()=>{if(!lock.current)await refreshQuery();},[refreshQuery]);
 useForegroundRefresh(autoRefresh,Boolean(data&&(data.state==='PENDING_PROVIDER'||data.state==='CONNECTED'&&trackingShipmentActiveStatus(data.tracking?.status))),TRACKING_REFRESH_INTERVAL_MS);
 async function change(action:'ISSUE'|'REVOKE'|'APPROVE'|'REVIEW',linkId?:string){if(lock.current||uncertain||!data||action==='REVIEW'&&(!reviewTerms||!Number.isInteger(Number(rating))||Number(rating)<1||Number(rating)>5))return;lock.current=true;setBusy(true);if(action==='REVOKE'&&issued?.link.id===linkId)setIssued(null);setError('');try{
  const endpoint=path+(action==='APPROVE'?'/approve':action==='REVIEW'?'/review':`/links${action==='REVOKE'?`?linkId=${linkId}`:''}`),body=action==='REVIEW'?{rating:Number(rating),note:reviewNote.trim(),termsAccepted:true}:{...workspaceId?{workspaceId}:{},...action==='ISSUE'?{expiresInDays:Number(days),allowLocation}:{}};
  const raw=await account.request(endpoint,body,action==='REVOKE'?{method:'DELETE'}:undefined);
  if(!mounted.current)return;
  if(action==='ISSUE'){const value=trackingData(raw,trackingSessionIssueSchema);if(!trackingLinkToken(value.link.url,__DEV__))throw Error();setIssued(value);}else trackingData(raw,{parse:value=>value});
  if(!await query.reloadConfirmed())setUncertain(true);
 }catch{if(mounted.current){setUncertain(true);setError('The result could not be confirmed. Refresh to check saved links before making another change.');}}finally{if(mounted.current){lock.current=false;setBusy(false);}}}
 async function refresh(){if(await query.reloadConfirmed()){setUncertain(false);setError('');}}
 if(!data)return <View style={{minHeight:240,gap:12}}><ErrorText message={query.error||(!query.loading?'Could not load Tracking. Please refresh and try again.':'')}/>{query.loading?<LoadingSpinner/>:<Button secondary message="Refresh Tracking" onPress={()=>void refresh()}/>}</View>;
 const location=data.tracking?.location;
 return <View style={{gap:16}}><Title>{data.reference}</Title>{!!data.brokerReference&&<Copy>{t('Your shipment reference')} · {data.brokerReference}</Copy>}<Copy>{data.cargoSummary}</Copy><Copy message={data.requestExpired?'This tracking request has expired.':data.state==='PENDING_PROVIDER'?'Waiting for a Transport Provider to connect. No vehicle location is shared yet.':data.state==='CANCELLED'?'Tracking cancelled':'Provider connected'}/>{data.state==='PENDING_PROVIDER'&&data.capabilities.canIssueLink?<TrackingRequests key={data.id} sessionId={data.id}/>:null}<TrackingMap route={data.route} location={location?{longitude:location.coordinate[0],latitude:location.coordinate[1],radius:location.radiusKm,area:location.label,updatedAt:location.updatedAt,source:location.source}:null}/>{data.tracking&&<><Copy>{t(statusLabel(data.tracking.status))}</Copy>{data.tracking.events.map(event=><View key={event.id} style={{gap:5}}><Copy>{t(statusLabel(event.status))} · {new Date(event.createdAt).toLocaleString()}</Copy>{!!event.note&&<Copy>{event.note}</Copy>}{data?.capabilities.canReadProof&&event.hasProof&&<PrivateFile label={t('Open proof')} load={async()=>trackingData(await account.request(`${path}/proof/${event.id}?format=base64`),{parse:value=>value})}/>}</View>)}</>}
  <ErrorText message={error||query.error}/><Button secondary message="Refresh Tracking" busy={busy||query.loading} onPress={()=>void refresh()}/>
  {issued&&<Card><Title message="Save this link and code"/><Copy message="They are shown once. Share both privately with the intended person."/><Copy message="Tracking link"/><Text selectable style={{color:palette.ink}}>{issued.link.url}</Text><Copy message="Tracking code"/><Text selectable style={{fontSize:22,fontWeight:'700',color:palette.ink}}>{issued.link.code}</Text><Copy>{t('Expires')}: {new Date(issued.link.expiresAt).toLocaleString()}</Copy><Button secondary message="Share link and code" onPress={()=>{void Share.share({message:`${issued.link.url}\n${t('Tracking code')}: ${issued.link.code}`}).catch(()=>setError('Could not open sharing. Select the link and code to copy them.'));}}/></Card>}
  {data.capabilities.canIssueLink&&<View style={{gap:12}}><Copy message="Link expiry"/><Choices value={days} options={[1,7,14,30].map(value=>({id:String(value),label:`${value} ${t('days')}`}))} onChange={setDays} disabled={busy||uncertain}/><View style={{flexDirection:'row',alignItems:'center',gap:10}}><Switch accessibilityLabel={t('Include approximate location when the provider has enabled it.')} value={allowLocation} onValueChange={setAllowLocation} disabled={busy||uncertain}/><View style={{flex:1}}><Copy message="Include approximate location when the provider has enabled it."/></View></View><Button message="Create Tracking link" disabled={uncertain} busy={busy} onPress={()=>void change('ISSUE')}/></View>}
  <Title message="Saved links"/>{!data.links.length?<Copy message="No links created yet."/>:data.links.map(link=><View key={link.id} style={{gap:8}}><Copy>{t(link.revokedAt?'Revoked':'Expires')}: {new Date(link.revokedAt||link.expiresAt).toLocaleString()}</Copy>{data?.capabilities.canRevokeLink&&!link.revokedAt&&<Button secondary message="Revoke link" busy={busy} disabled={uncertain} onPress={()=>void change('REVOKE',link.id)}/>}</View>)}
  {data.workspaceId===null&&!!data.shipmentId&&data.capabilities.canManageTeam===true&&businesses.length>0&&<TrackingTeamAccess shipmentId={data.shipmentId} businesses={businesses} endpoint={`${path}/sharing`}/>}
  {data.capabilities.canApprove&&<><Copy message="Check the unloading proof before approving. Your approval completes the shipment."/><Button message="Approve unloading" busy={busy} disabled={uncertain} onPress={()=>void change('APPROVE')}/></>}
  {data.tracking?.review?<Card><Title message="Your review"/><Copy>{data.tracking.review.rating} / 5</Copy>{!!data.tracking.review.note&&<Copy>{data.tracking.review.note}</Copy>}</Card>:data.capabilities.canReview&&<Card><Title message="Rating"/><Choices value={rating} options={[5,4,3,2,1].map(value=>({id:String(value),label:String(value)}))} onChange={setRating} disabled={busy||uncertain}/><Field message="Comment (optional)" value={reviewNote} onChangeText={setReviewNote} maxLength={1000} multiline editable={!busy&&!uncertain}/><View style={{flexDirection:'row',alignItems:'center',gap:10}}><Switch accessibilityLabel={t('I agree to the Terms and content rules.')} value={reviewTerms} onValueChange={setReviewTerms} disabled={busy||uncertain}/><View style={{flex:1}}><Copy message="I agree to the Terms and content rules."/></View></View><Button message="Publish review" busy={busy} disabled={uncertain||!reviewTerms} onPress={()=>void change('REVIEW')}/></Card>}
 </View>;
}
export function TrackingShipmentLinks({shipmentId,workspaceId}:{shipmentId:string;workspaceId?:string}){
 const account=useAccount(),[session,setSession]=useState<TrackingSessionView|null>(null),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[error,setError]=useState(''),lock=useRef(false);
 async function open(){if(lock.current||uncertain)return;lock.current=true;setBusy(true);setError('');try{setSession(trackingData(await account.request('/api/tracking/sessions/from-shipment',{shipmentId,...workspaceId?{workspaceId}:{}}),trackingSessionViewSchema));}catch{setUncertain(true);setError('Could not confirm sharing setup. Refresh the shipment before trying again.');}finally{lock.current=false;setBusy(false);}}
 return session?<TrackingSessionManager key={session.id} sessionId={session.id} workspaceId={workspaceId}/>:<View style={{gap:12}}><Button secondary message="Share Tracking link" busy={busy} disabled={uncertain} onPress={()=>void open()}/><ErrorText message={error}/></View>;
}
type BusinessTrackingSessionsProps={workspaceId?:string;canCreate?:boolean;businesses?:Business[]};
export function BusinessTrackingSessions(props:BusinessTrackingSessionsProps){
 const account=useAccount();
 return <BusinessTrackingList key={`${account.session?.user.id||''}:${props.workspaceId||'personal'}`} {...props}/>;
}
function BusinessTrackingList({workspaceId,canCreate=false,businesses=[]}:BusinessTrackingSessionsProps){
 const [page,setPage]=useState(1),[selected,setSelected]=useState(''),[creating,setCreating]=useState(false);
 const [draftReference,setDraftReference]=useState(''),[reference,setReference]=useState('');
 const searchBody=useMemo(()=>reference&&workspaceId?{workspaceId,page,reference}:undefined,[workspaceId,page,reference]);
 const path=searchBody?'/api/tracking/sessions/search':`/api/tracking/sessions?page=${page}${workspaceId?`&workspaceId=${workspaceId}`:''}`;
 const query=useAccountQuery<unknown>(path,searchBody);
 function search(next:string){
  setSelected('');setPage(1);setReference(next.trim());
  if(next.trim()===reference&&page===1)void query.reload();
 }
 let data:ReturnType<typeof trackingSessionListSchema.parse>|null=null;try{if(query.data){data=trackingData(query.data,trackingSessionListSchema);if(data.workspaceId!==(workspaceId||null))data=null;}}catch{}
 return <View style={{gap:16}}><Title message="Tracking sessions"/>{creating&&workspaceId&&canCreate?<CreateTrackingSession workspaceId={workspaceId} onCancel={()=>{setCreating(false);void query.reload();}} onCreated={session=>{setCreating(false);setSelected(session.id);void query.reload();}}/>:<>{canCreate&&!!workspaceId&&<Button message="Create Tracking session" onPress={()=>setCreating(true)}/>}
  {!!workspaceId&&<><Field message="Search by your shipment reference" value={draftReference} maxLength={80} onChangeText={setDraftReference} onSubmitEditing={()=>search(draftReference)}/><Button secondary message="Search" onPress={()=>search(draftReference)}/>{!!reference&&<Button secondary message="Clear" onPress={()=>{setDraftReference('');search('');}}/>}</>}
  <ErrorText message={query.error}/>{!data&&query.loading?<LoadingSpinner/>:<Button secondary message="Refresh Tracking" busy={query.loading} onPress={()=>void query.reload()}/>}{data&&!data.sessions.length&&<Copy message={reference?"No shipments match that reference.":"No Tracking sessions yet."}/>}{data?.sessions.map(session=><Button key={session.id} secondary label={`${session.brokerReference||session.reference} · ${session.cargoSummary}`} onPress={()=>setSelected(session.id)}/>)}</>}{!!selected&&<TrackingSessionManager key={`${workspaceId||'personal'}:${selected}`} sessionId={selected} workspaceId={workspaceId} businesses={businesses}/>}{data&&data.pageCount>1&&<><Button secondary message="Previous" disabled={page===1||query.loading} onPress={()=>setPage(value=>value-1)}/><Button secondary message="Next" disabled={page>=data.pageCount||query.loading} onPress={()=>setPage(value=>value+1)}/></>}</View>;
}
function CreateTrackingSession({workspaceId,onCreated,onCancel}:{workspaceId:string;onCreated:(session:TrackingSessionView)=>void;onCancel:()=>void}){
 const account=useAccount(),[pickup,setPickup]=useState(emptyPlace),[passing,setPassing]=useState(emptyPlace),[delivery,setDelivery]=useState(emptyPlace),[cargo,setCargo]=useState(''),[brokerReference,setBrokerReference]=useState(''),[pickupDate,setPickupDate]=useState(''),[deliveryDate,setDeliveryDate]=useState(''),[busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false),[error,setError]=useState(''),lock=useRef(false);
 async function create(){if(lock.current||uncertain)return;const input=trackingSessionCreate.safeParse({workspaceId,cargoDescription:cargo,brokerReference,pickupDate,deliveryDate,route:[pickup,...(passing.placeRef?[passing]:[]),delivery].map(point=>({placeRef:point.placeRef}))});if(!input.success){setError('Check the cities, cargo and delivery date.');return;}lock.current=true;setBusy(true);setError('');try{onCreated(trackingData(await account.request('/api/tracking/sessions',input.data),trackingSessionViewSchema));}catch{setUncertain(true);setError('We could not confirm the result. Check saved Tracking sessions before creating another.');}finally{lock.current=false;setBusy(false);}}
 return <Card><Title message="Create Tracking session"/><Copy message="Save the route, then choose a truck to invite."/>{[{label:'Pickup city',value:pickup,change:setPickup},{label:'Passing through city (optional)',value:passing,change:setPassing},{label:'Delivery city',value:delivery,change:setDelivery}].map(point=><PlacePicker key={point.label} label={point.label} value={point.value} onChange={point.change} disabled={busy||uncertain}/>)}{!!passing.placeRef&&<Button secondary message="Remove stop" disabled={busy||uncertain} onPress={()=>setPassing(emptyPlace())}/>}<Field message="Your shipment reference (optional)" value={brokerReference} onChangeText={setBrokerReference} maxLength={80} editable={!busy&&!uncertain}/><Field message="Cargo" value={cargo} onChangeText={setCargo} maxLength={500} editable={!busy&&!uncertain}/><DatePicker message="Expected pickup" value={pickupDate} onChange={setPickupDate} disabled={busy||uncertain}/><DatePicker message="Expected delivery" value={deliveryDate} onChange={setDeliveryDate} disabled={busy||uncertain}/><ErrorText message={error}/><Button message="Create Tracking session" busy={busy} disabled={uncertain} onPress={()=>void create()}/><Button secondary message={uncertain?'Check saved Tracking':'Cancel'} busy={busy} onPress={onCancel}/></Card>;
}
