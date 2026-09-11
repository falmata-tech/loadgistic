import { redirect } from 'next/navigation';

export default async function LegacyDirectory({
  searchParams
}: {
  searchParams: Promise<Record<string,string | undefined>>;
}) {
  const query = await searchParams;
  const target = new URLSearchParams();
  if (query.q) target.set('q',query.q);
  const suffix = target.size ? `?${target.toString()}` : '';
  redirect(`/${suffix}`);
}
