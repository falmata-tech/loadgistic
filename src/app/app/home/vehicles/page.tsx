import {ProviderHome} from '@/components/provider-home';

export default function ProviderVehiclesPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 return <ProviderHome requested="vehicles" searchParams={searchParams}/>;
}
