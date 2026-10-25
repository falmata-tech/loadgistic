import {redirect} from 'next/navigation';
import {getCurrentUser} from '@/lib/auth';
export const dynamic='force-dynamic';
// Old bookmarks now lead to an account workspace, never an email-only session.
export default async function SharedCapacityPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){
  const user=await getCurrentUser({allowLimited:true});
  if(!user)redirect('/login?from=shared-capacity');
  if(!['TRANSPORTER','DRIVER','CUSTOMER'].includes(user.role))redirect('/app/home');
  const raw=await searchParams;
  const query=new URLSearchParams();
  for(const [key,value] of Object.entries(raw))if(typeof value==='string')query.set(key,value);
  query.set('view','private');
  redirect(`/?${query.toString()}`);
}
