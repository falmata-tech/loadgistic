import { z } from 'zod';
import { mobileActor, mobileBody, mobileFailure, mobileJson, MobileError } from '@/lib/mobile/server';
import { getOwnCompanyPage, updateCompanyPage } from '@/lib/provider-profile.js';
import { PROVIDER_REGIONS } from '@/lib/provider-regions.js';
import { errorMessage } from '@/lib/errors';
export const runtime = 'nodejs';
const publicIdentity={accountName:z.string().trim().min(1).max(140).optional(),handle:z.string().trim().min(2).max(64).optional()};
const input = z.object({...publicIdentity, headline: z.string().trim().max(120), about: z.string().trim().max(2000), services: z.string().trim().max(1000).optional(), basePlaceRef: z.string().max(150), baseRegionCode: z.string().max(80), contactPhone: z.string().trim().max(50), contactWhatsapp: z.string().trim().max(50), contactEmail: z.union([z.literal(''), z.string().trim().email().max(254)]), contactWebsite: z.union([z.literal(''), z.string().url().startsWith('https://').max(500)]), showContactPhone: z.boolean(), showContactWhatsapp: z.boolean(), showContactEmail: z.boolean(), showContactWebsite: z.boolean(), published: z.boolean() }).strict();
const personalInput=z.object({...publicIdentity,basePlaceRef:z.string().max(150),baseRegionCode:z.string().max(80),published:z.boolean()}).strict();
const text = (value: unknown) => typeof value === 'string' ? value : '';
async function owner(request: Request) { const user = await mobileActor(request); if (user.driver_kind === 'COMPANY') throw new MobileError(403, 'FORBIDDEN', 'Your fleet owner manages the transporter profile.'); return user; }
export async function GET(request: Request) {
 try { const user = await owner(request), page = await getOwnCompanyPage(user); if (!page) throw new MobileError(404, 'NOT_FOUND', 'The transporter profile is unavailable.');
  return mobileJson({ accountName:text(page.account_name||page.name),managerName:text(page.manager_name),handle: text(page.handle), name: text(page.name), regions: PROVIDER_REGIONS, imageUrl: text(page.profile_image_url), customImage: page.profile_image_is_custom === true,
   profile: { accountName:text(page.account_name||page.name),handle:text(page.handle),headline: text(page.headline), about: text(page.about), services: '', basePlaceRef: text(page.city_place_ref), basePlaceLabel: text(page.city), baseRegionCode: text(page.base_region_code), contactPhone: text(page.contact_phone), contactWhatsapp: text(page.contact_whatsapp), contactEmail: text(page.contact_email), contactWebsite: text(page.contact_website), showContactPhone: page.show_contact_phone === true, showContactWhatsapp: page.show_contact_whatsapp === true, showContactEmail: page.show_contact_email === true, showContactWebsite: page.show_contact_website === true, published: page.published === true },
  });
 } catch (error) { return mobileFailure(error); }
}
export async function POST(request: Request) {
 try { const user = await owner(request), parsed = (user.role==='TRANSPORTER'?input:z.union([personalInput,input])).safeParse(await mobileBody(request));
  if (!parsed.success) throw new MobileError(400, 'INVALID_INPUT', 'Check your profile fields. Use a valid email and an https:// website address.');
  const {services:retiredServices,...profile}=parsed.data as Record<string,unknown>;
  try { await updateCompanyPage(user, profile); } catch (error) { const code = error instanceof Error ? error.message : ''; if (/^(ACCOUNT_HANDLE_|INVALID_|LOCALITY_|BASE_LOCATION_|PROVIDER_BASE_)/.test(code)) throw new MobileError(400, 'INVALID_INPUT', errorMessage(error)); throw error; }
  return mobileJson({ ok: true });
 } catch (error) { return mobileFailure(error); }
}
