import {redirect} from 'next/navigation';

export default async function RetiredAuthenticatedProvider({params}:{params:Promise<{handle:string}>}){
  const {handle}=await params;
  redirect(`/providers/${encodeURIComponent(handle)}`);
}
