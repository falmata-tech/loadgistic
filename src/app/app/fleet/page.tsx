import {redirect} from 'next/navigation';

export default async function FleetPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
 const params=new URLSearchParams();
 for(const [key,value] of Object.entries(await searchParams))if(typeof value==='string')params.set(key,value);
 redirect(`/app/home/vehicles${params.size?`?${params}`:''}`);
}
