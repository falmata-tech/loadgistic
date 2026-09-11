import { redirect } from 'next/navigation';

export const dynamic='force-dynamic';

export default async function CapacityCompatibilityPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
  const raw=await searchParams;
  const params=new URLSearchParams();
  for(const [key,value] of Object.entries(raw)){
    if(Array.isArray(value))for(const item of value)params.append(key,item);
    else if(value)params.set(key,value);
  }
  redirect(`/${params.size?`?${params.toString()}`:''}`);
}
