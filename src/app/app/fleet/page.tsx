import {FleetWorkspace} from '@/components/provider-fleet-workspace';

export default async function FleetPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 return <FleetWorkspace searchParams={searchParams}/>;
}
