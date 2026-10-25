import {ProviderHome} from '@/components/provider-home';

export default function HomePage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 return <ProviderHome searchParams={searchParams}/>;
}
