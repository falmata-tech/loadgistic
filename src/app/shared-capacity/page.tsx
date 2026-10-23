import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
// Retain old bookmarks, email links and filter form destinations without a second UI.
export default async function SharedCapacityPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const raw=await searchParams;
  const query=new URLSearchParams();
  for(const [key,value] of Object.entries(raw))if(typeof value==='string')query.set(key,value);
  query.set('view','private');
  redirect(`/?${query.toString()}`);
}
