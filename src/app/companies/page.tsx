import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';

export default async function LegacyDirectory({
  searchParams
}: {
  searchParams: Promise<Record<string,string | undefined>>;
}) {
  await requireUser();
  const query = await searchParams;
  const target = new URLSearchParams();
  if (query.type) target.set('type',query.type);
  if (query.q) target.set('q',query.q);
  const suffix = target.size ? `?${target.toString()}` : '';
  redirect(`/app/providers${suffix}`);
}
