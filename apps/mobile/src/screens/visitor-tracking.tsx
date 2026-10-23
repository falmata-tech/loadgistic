import {useLanguage} from '../localization/provider';
import { AppLink } from '../components/app-link';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { VisitorAccess } from '../components/visitor-access';
import { Page, Title, Copy, Card, Button, ErrorText, LoadingSpinner } from '../components/ui';
import { useVisitorQuery } from '../hooks/visitor-query';
import { statusLabel } from '../api/tracking';
import {parseTrackingPage,type TrackingPage} from '../api/runtime-content';
import {useVisitor} from '../session/visitor-provider';
import {Map,Camera} from '../components/map-platform';
import {mapStyle} from '../components/map-style';
export default function VisitorTracking() {
 const visitor=useVisitor();
 if(visitor.ready&&visitor.snapshot.foreground&&visitor.snapshot.tracking)return <Page><VisitorAccess scope="tracking"><Shipments /></VisitorAccess></Page>;
 return <View style={{flex:1}}>
  <View style={StyleSheet.absoluteFill}><Map style={{flex:1}} mapStyle={mapStyle} attribution><Camera initialViewState={{center:[39.5,9],zoom:5}}/></Map></View>
  <ScrollView pointerEvents="box-none" keyboardShouldPersistTaps="handled" style={{flexGrow:0,flexShrink:1,maxHeight:'100%'}} contentContainerStyle={{padding:20,paddingBottom:40}}><View style={{backgroundColor:'#fff',borderRadius:16}}><VisitorAccess scope="tracking"/></View></ScrollView>
 </View>;
}
function Shipments() {
 const {t}=useLanguage();
 const [page, setPage] = useState(1), query = useVisitorQuery<TrackingPage>('tracking', `/api/mobile/visitor/tracking/shipments?page=${page}`,parseTrackingPage);
 return <><Title message={"Your shipments"}/><ErrorText message={query.error} />{query.loading && <LoadingSpinner accessibilityLabel="Loading your shipments" />}<Button secondary message="Refresh shipments" busy={query.loading} onPress={() => { void query.reload(); }} />
  {query.data?.items.length === 0 && <Copy message={"No shipments are currently shared with this email."}/>}
  {query.data?.items.map(item => <Card key={item.id}><Title>{item.origin} → {item.destination}</Title><Copy>{item.code} · {t(statusLabel(item.status))}</Copy><AppLink href={{ pathname: '/visitor-shipment', params: { id: item.id } }} style={{ paddingVertical: 12, color: '#155eef' }} message={"View updates"}/></Card>)}
  {page > 1 && <Button secondary message="Previous shipments" busy={query.loading} onPress={() => setPage(value => value - 1)} />}{query.data && page < query.data.pageCount && <Button secondary message="More shipments" busy={query.loading} onPress={() => setPage(value => value + 1)} />}
 </>;
}
