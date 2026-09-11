import { notFound, redirect } from 'next/navigation';

export default async function PublicHandlePage({params}:{params:Promise<{publicHandle:string}>}){
  const {publicHandle}=await params;
  const decoded=decodeURIComponent(publicHandle);
  if(!decoded.startsWith('@')||decoded.length<2)notFound();
  redirect(`/providers/${encodeURIComponent(decoded.slice(1))}`);
}
