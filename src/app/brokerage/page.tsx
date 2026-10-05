import {BrokerageQueue} from '@/components/brokerage-queue';
export default async function BrokeragePage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 return <BrokerageQueue query={await searchParams} path="/brokerage"/>;
}
