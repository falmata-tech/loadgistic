import {BrokerageQueue} from '@/components/brokerage-queue';
export default async function TransportRequestsPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 return <BrokerageQueue query={await searchParams} path="/admin/support/transport-requests"/>;
}
