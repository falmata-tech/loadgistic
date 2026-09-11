import { redirect } from 'next/navigation';

export const dynamic='force-dynamic';
export default async function ProvidersPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const query=await searchParams;const params=new URLSearchParams();if(query.q)params.set('q',query.q);const suffix=params.size?`?${params.toString()}`:'';redirect(`/${suffix}`);
}
