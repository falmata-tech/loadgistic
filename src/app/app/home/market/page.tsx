import {ProviderHome} from '@/components/provider-home';

export default function ProviderMarketPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 return <ProviderHome requested="market" searchParams={searchParams}/>;
}
