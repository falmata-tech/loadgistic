import {useState} from 'react';
import {ActivityIndicator,Pressable,Text,View} from 'react-native';
import {Redirect,router,useLocalSearchParams} from 'expo-router';
import {useAccount} from '../session/provider';
import {useAccountQuery} from '../hooks/account-query';
import {useForegroundRefresh} from '../hooks/foreground-refresh';
import {useLanguage} from '../localization/provider';
import {Page,Title,Copy,Button,ErrorText,palette} from '../components/ui';
import {AppIcon} from '../components/app-icon';
import {AppLink} from '../components/app-link';
import {TrackingWorkspace} from '../components/tracking-workspace';
import {statusLabel} from '../api/tracking';
import {parseBusinessTrackingList,parseBusinessTrackingDetail,type BusinessTrackingList,type BusinessTrackingDetail} from '../api/business-workspaces';
export default function BusinessTracking(){
 const account=useAccount(),workspace=account.session?.user.selectedBusinessWorkspace;
 if(account.busy)return <Page><ActivityIndicator/></Page>;
 if(!account.session)return <Redirect href="/account"/>;
 if(account.session.user.role!=='CUSTOMER'||!workspace)return <Redirect href="/workspaces"/>;
 if(!workspace.permissions.tracking)return <Page><Copy message="Your team access does not include that page. Contact your business admin."/></Page>;
 return <Shipments key={`${account.session.user.id}:${workspace.id}:${workspace.membershipRevision}`} workspaceId={workspace.id}/>;
}
function Shipments({workspaceId}:{workspaceId:string}){
 const {t}=useLanguage(),[page,setPage]=useState(1),query=useAccountQuery<BusinessTrackingList>(`/api/business-workspaces/${workspaceId}/tracking?page=${page}`);
 let data:BusinessTrackingList|null=null;let invalid='';try{if(query.data)data=parseBusinessTrackingList(query.data,workspaceId);}catch{invalid=t('Could not load shipment updates. Please try again.');}
 return <Page><View style={{flexDirection:'row',alignItems:'center',gap:12}}><View style={{flex:1}}><Title message="Tracking"/></View><Button secondary message="Open tracking" onPress={()=>router.push('/visitor-tracking')}/></View>
  <ErrorText message={query.error||invalid}/>{query.loading&&<ActivityIndicator/>}{!!(query.error||invalid)&&<Button secondary message="Refresh updates" onPress={()=>{void query.reload();}}/>}
  {data?.shipments.map(shipment=><Pressable key={shipment.id} accessibilityRole="button" onPress={()=>router.push({pathname:'/business-shipment',params:{id:shipment.id}})} style={{paddingVertical:17,borderBottomWidth:1,borderColor:palette.border,gap:7}}><View style={{flexDirection:'row',gap:10,alignItems:'center'}}><AppIcon name="route" color={palette.teal}/><Text style={{flex:1,fontSize:16,fontWeight:'700',color:palette.ink}}>{shipment.origin} → {shipment.destination}</Text><AppIcon name="next"/></View><Text style={{fontSize:13,fontWeight:'600',color:palette.teal}}>{t(statusLabel(shipment.status))}</Text><Text style={{fontSize:14,lineHeight:20,color:palette.muted}}>{shipment.cargo}</Text></Pressable>)}
  {data&&!data.total&&<Copy message="No shipments shared yet"/>}
  {data&&data.pageCount>1&&<><Copy>{t('Page {page} of {pages}',{page:data.page,pages:data.pageCount})}</Copy><Button secondary message="Previous" disabled={page===1||query.loading} onPress={()=>setPage(value=>value-1)}/><Button secondary message="Next" disabled={page>=data.pageCount||query.loading} onPress={()=>setPage(value=>value+1)}/></>}
 </Page>;
}
export function BusinessShipment(){
 const account=useAccount(),workspace=account.session?.user.selectedBusinessWorkspace,{id}=useLocalSearchParams<{id:string}>();
 if(account.busy)return <Page><ActivityIndicator/></Page>;
 if(!account.session||account.session.user.role!=='CUSTOMER'||!workspace)return <Redirect href="/workspaces"/>;
 if(!workspace.permissions.tracking)return <Page><Copy message="Your team access does not include that page. Contact your business admin."/></Page>;
 return <Shipment key={`${account.session.user.id}:${workspace.id}:${workspace.membershipRevision}:${id}`} workspaceId={workspace.id} shipmentId={typeof id==='string'?id:''}/>;
}
function Shipment({workspaceId,shipmentId}:{workspaceId:string;shipmentId:string}){
 const {t}=useLanguage(),query=useAccountQuery<BusinessTrackingDetail>(`/api/business-workspaces/${workspaceId}/tracking/${encodeURIComponent(shipmentId)}`);
 let data:BusinessTrackingDetail|null=null;let invalid='';try{if(query.data)data=parseBusinessTrackingDetail(query.data,workspaceId,shipmentId);}catch{invalid=t('Could not load shipment updates. Please try again.');}
 useForegroundRefresh(query.refresh,Boolean(data&& !['COMPLETED','CANCELLED'].includes(data.status)));
 if(!data)return <Page><ErrorText message={query.error||invalid}/>{query.loading?<ActivityIndicator/>:<Button secondary message="Refresh updates" onPress={()=>{void query.reload();}}/>}</Page>;
 return <TrackingWorkspace code={data.code} status={data.status} route={data.route} location={data.location} truck={data.publicTruck} canViewLocation={data.canViewLocation} recordedStatuses={data.events.map(event=>event.status)}>
  <ErrorText message={query.error}/><Copy>{data.cargo}</Copy><Button secondary message="Refresh updates" busy={query.refreshing} onPress={()=>{void query.reload();}}/>
  {data.events.map(event=><View key={event.id} style={{gap:4,paddingVertical:9,borderBottomWidth:1,borderColor:palette.border}}><Text style={{fontWeight:'700',color:palette.ink}}>{t(statusLabel(event.status))}</Text><Copy>{new Date(event.createdAt).toLocaleString()}</Copy>{!!event.note&&<Copy>{event.note}</Copy>}</View>)}
  {data.isOwner&&<><Copy message="Verify the shipment owner email to manage sharing."/><AppLink href={{pathname:'/visitor-shipment',params:{id:shipmentId}}} message="Open tracking"/></>}
 </TrackingWorkspace>;
}
