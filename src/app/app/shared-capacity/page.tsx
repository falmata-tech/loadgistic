import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function AccountSharedCapacityPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const input=await searchParams;
 const query=new URLSearchParams();
 for(const [key,value] of Object.entries(input))if(typeof value==='string')query.set(key,value);
 query.set('view','private');
 redirect(`/?${query.toString()}`);
}
