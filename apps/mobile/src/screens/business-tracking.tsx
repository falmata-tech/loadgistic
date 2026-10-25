import {useState} from 'react';
import { Pressable, Text, View } from 'react-native';
import {Redirect,router,useLocalSearchParams} from 'expo-router';
import {useAccount} from '../session/provider';
import {useAccountQuery} from '../hooks/account-query';
import {useForegroundRefresh} from '../hooks/foreground-refresh';
import {useLanguage} from '../localization/provider';
import { Page, Title, Copy, Field, Button, ErrorText, palette, LoadingSpinner } from '../components/ui';
import {AppIcon} from '../components/app-icon';
import {TrackingWorkspace} from '../components/tracking-workspace';
import {TrackingSharing} from '../components/tracking-sharing';
import {PrivateFile} from '../components/private-file';
import {Choices} from '../components/choices';
import {AppLink} from '../components/app-link';
import {TrackingDemoLabel} from '../components/tracking-demo-label';
import {isDemoTrackingShipment,demoTrackingLabel} from '../../../../src/lib/demo-tracking-identity.js';
import {statusLabel} from '../api/tracking';
import {parseBusinessTrackingList,parseBusinessTrackingDetail,type BusinessTrackingList,type BusinessTrackingDetail} from '../api/business-workspaces';
export default function BusinessTracking(){
 const account=useAccount(),workspace=account.session?.user.selectedBusinessWorkspace;
 if(account.busy)return <Page><LoadingSpinner/></Page>;
 if(!account.session)return <Redirect href="/account"/>;
 if(account.session.user.role!=='CUSTOMER'||!workspace)return <Redirect href="/workspaces"/>;
 if(!workspace.permissions.tracking)return <Page><Copy message="Your team access does not include that page. Contact your workspace admin."/></Page>;
 return <Shipments key={`${account.session.user.id}:${workspace.id}:${workspace.membershipRevision}`} workspaceId={workspace.id}/>;
}
function Shipments({workspaceId}:{workspaceId:string}){
 const {t}=useLanguage(),[page,setPage]=useState(1),query=useAccountQuery<BusinessTrackingList>(`/api/business-workspaces/${workspaceId}/tracking?page=${page}`);
 let data:BusinessTrackingList|null=null;let invalid='';try{if(query.data)data=parseBusinessTrackingList(query.data,workspaceId);}catch{invalid=t('Could not load shipment updates. Please try again.');}
 return <Page><Title message="Tracking"/>
  <ErrorText message={query.error||invalid}/>{query.loading&&<LoadingSpinner/>}{!!(query.error||invalid)&&<Button secondary message="Refresh updates" onPress={()=>{void query.reload();}}/>}
  {data?.shipments.map(shipment=><Pressable key={shipment.id} accessibilityRole="button" onPress={()=>router.push({pathname:'/business-shipment',params:{id:shipment.id}})} style={{paddingVertical:17,borderBottomWidth:1,borderColor:palette.border,gap:7}}><View style={{flexDirection:'row',gap:10,alignItems:'center'}}><AppIcon name="route" color={palette.blue}/><Text style={{flex:1,fontSize:16,fontWeight:'700',color:palette.ink}}>{shipment.origin} → {shipment.destination}</Text><AppIcon name="next"/></View>{isDemoTrackingShipment(shipment.id)&&<TrackingDemoLabel/>}<Text style={{fontSize:13,fontWeight:'600',color:palette.blue}}>{t(statusLabel(shipment.status))}</Text><Text style={{fontSize:14,lineHeight:20,color:palette.muted}}>{shipment.cargo}</Text></Pressable>)}
  {data&&!data.total&&<><Copy message="No shipments shared yet"/><Copy message="When a shipment owner shares tracking with your workspace, it will appear here."/></>}
  {data&&data.pageCount>1&&<><Copy>{t('Page {page} of {pages}',{page:data.page,pages:data.pageCount})}</Copy><Button secondary message="Previous" disabled={page===1||query.loading} onPress={()=>setPage(value=>value-1)}/><Button secondary message="Next" disabled={page>=data.pageCount||query.loading} onPress={()=>setPage(value=>value+1)}/></>}
 </Page>;
}
export function BusinessShipment(){
 const account=useAccount(),workspace=account.session?.user.selectedBusinessWorkspace,{id}=useLocalSearchParams<{id:string}>();
 if(account.busy)return <Page><LoadingSpinner/></Page>;
 if(!account.session||account.session.user.role!=='CUSTOMER'||!workspace)return <Redirect href="/workspaces"/>;
 if(!workspace.permissions.tracking)return <Page><Copy message="Your team access does not include that page. Contact your workspace admin."/></Page>;
 return <Shipment key={`${account.session.user.id}:${workspace.id}:${workspace.membershipRevision}:${id}`} workspaceId={workspace.id} shipmentId={typeof id==='string'?id:''}/>;
}
function Shipment({workspaceId,shipmentId}:{workspaceId:string;shipmentId:string}){
 const {t}=useLanguage(),account=useAccount(),path=`/api/business-workspaces/${workspaceId}/tracking/${encodeURIComponent(shipmentId)}`,query=useAccountQuery<BusinessTrackingDetail>(path);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[rating,setRating]=useState(''),[note,setNote]=useState(''),[termsAccepted,setTermsAccepted]=useState(false);
 async function act(input:{action:'APPROVE'}|{action:'REVIEW';rating:number;note:string;termsAccepted:true}){
  if(busy)return;setBusy(true);setError('');try{await account.request(`${path}/actions`,input);await query.reload();}
  catch(problem){setError(problem instanceof Error?problem.message:'Could not save. Refresh and try again.');}finally{setBusy(false);}
 }
 let data:BusinessTrackingDetail|null=null;let invalid='';try{if(query.data)data=parseBusinessTrackingDetail(query.data,workspaceId,shipmentId);}catch{invalid=t('Could not load shipment updates. Please try again.');}
 useForegroundRefresh(query.refresh,Boolean(data&& !['COMPLETED','CANCELLED'].includes(data.status)));
 if(!data)return <Page><ErrorText message={query.error||invalid}/>{query.loading?<LoadingSpinner/>:<Button secondary message="Refresh updates" onPress={()=>{void query.reload();}}/>}</Page>;
 return <TrackingWorkspace shipmentId={shipmentId} code={data.code} status={data.status} route={data.route} location={data.location} truck={data.publicTruck} canViewLocation={data.canViewLocation} recordedStatuses={data.events.map(event=>event.status)}>
  <ErrorText message={query.error}/><Copy>{data.cargo}</Copy><Button secondary message="Refresh updates" busy={query.refreshing} onPress={()=>{void query.reload();}}/>
  {data.events.map(event=><View key={event.id} style={{gap:4,paddingVertical:9,borderBottomWidth:1,borderColor:palette.border}}><Text style={{fontWeight:'700',color:palette.ink}}>{t(statusLabel(event.status))}</Text>{isDemoTrackingShipment(shipmentId)&&<TrackingDemoLabel kind="event"/>}<Copy>{new Date(event.createdAt).toLocaleString()}</Copy>{!!event.note&&<Copy>{event.note}</Copy>}{data.isOwner&&event.hasProof?<PrivateFile label={t(isDemoTrackingShipment(shipmentId)?demoTrackingLabel('proof'):'View photo proof')} load={()=>account.request(`${path}/proof/${event.id}?format=base64`)}/>:null}</View>)}
  {data.isOwner&&<TrackingSharing shipmentId={shipmentId} workspaceId={workspaceId}/>}
  {data.isOwner&&data.canApprove?<View style={{gap:9,paddingVertical:14}}><Title message="Approve unloading"/><Copy message="Check the unloading photo and confirm the shipment has arrived. Your approval completes this shipment."/><ErrorText message={error}/><Button message="Approve unloading" busy={busy} onPress={()=>void act({action:'APPROVE'})}/></View>:null}
  {data.isOwner&&data.canReview?<View style={{gap:9,paddingVertical:14}}><Title message="Review your transporter"/><Choices value={rating} options={[5,4,3,2,1].map(value=>({id:String(value),label:`${value} ${value===1?'star':'stars'}`}))} onChange={setRating} disabled={busy}/><Field message="Review comment (optional)" value={note} onChangeText={setNote} maxLength={1000} editable={!busy} multiline/><Pressable accessibilityRole="checkbox" accessibilityState={{checked:termsAccepted}} onPress={()=>setTermsAccepted(value=>!value)} style={{minHeight:48,flexDirection:'row',gap:9,alignItems:'center'}}><Text style={{fontSize:21,color:palette.blue}}>{termsAccepted?'☑':'☐'}</Text><Copy message="I agree to the Terms and content rules."/></Pressable><AppLink href="/terms" message="Terms"/><ErrorText message={error}/><Button message="Publish review" busy={busy} disabled={!rating||!termsAccepted} onPress={()=>void act({action:'REVIEW',rating:Number(rating),note,termsAccepted:true})}/></View>:data.isOwner&&data.review?<View style={{gap:5,paddingVertical:14}}><Title message="Your review"/><Copy>{data.review.rating} / 5</Copy><Copy>{data.review.note||t('No written comment.')}</Copy></View>:null}
 </TrackingWorkspace>;
}
