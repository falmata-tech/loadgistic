import type { ManagedCurrentUser } from '@/lib/identity/supabase';
import { getOwnCompanyPage } from '@/lib/provider-profile.js';

export async function mobileProfilePublished(user: ManagedCurrentUser): Promise<boolean | null> {
  if (user.driver_kind === 'COMPANY') return null;
  const page = await getOwnCompanyPage(user);
  return page ? page.published === true : null;
}
