import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';

export default async function LegacyCompanyProfile({
  params,
  searchParams
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<Record<string,string | undefined>>;
}) {
  await requireUser();
  const { handle } = await params;
  const query = await searchParams;
  const suffix = query.compare === 'coverage' ? '?compare=coverage' : '';
  redirect(`/app/providers/${handle}${suffix}`);
}
