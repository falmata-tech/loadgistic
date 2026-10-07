import {useLanguage} from '../localization/provider';
import { AppLink } from '../components/app-link';
import { useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { VisitorAccess } from '../components/visitor-access';
import { Page, Title, Copy, Card, Button, ErrorText } from '../components/ui';
import { useVisitorQuery } from '../hooks/visitor-query';
import { statusLabel, type TrackingSummary } from '../api/tracking';
export default function VisitorTracking() { return <Page><VisitorAccess scope="tracking"><Shipments /></VisitorAccess></Page>; }
function Shipments() {
 const {t}=useLanguage();
 const [page, setPage] = useState(1), query = useVisitorQuery<{ items: TrackingSummary[]; total: number; page: number; pageCount: number }>('tracking', `/api/mobile/visitor/tracking/shipments?page=${page}`);
 return <><Title message={"Your shipments"}/><ErrorText message={query.error} />{query.loading && <ActivityIndicator accessibilityLabel="Loading your shipments" />}<Button secondary message="Refresh shipments" busy={query.loading} onPress={() => { void query.reload(); }} />
  {query.data?.items.length === 0 && <Copy message={"No shipments are currently shared with this email."}/>}
  {query.data?.items.map(item => <Card key={item.id}><Title>{item.origin} → {item.destination}</Title><Copy>{item.code} · {t(statusLabel(item.status))}</Copy><AppLink href={{ pathname: '/visitor-shipment', params: { id: item.id } }} style={{ paddingVertical: 12, color: '#0c7275' }} message={"View updates"}/></Card>)}
  {page > 1 && <Button secondary message="Previous shipments" busy={query.loading} onPress={() => setPage(value => value - 1)} />}{query.data && page < query.data.pageCount && <Button secondary message="More shipments" busy={query.loading} onPress={() => setPage(value => value + 1)} />}
 </>;
}
