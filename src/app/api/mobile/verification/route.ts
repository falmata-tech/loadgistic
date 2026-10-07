import { z } from 'zod';
import { mobileActor, mobileJson, mobileFailure, MobileError } from '@/lib/mobile/server';
import { mobileUpload, fileFailure } from '@/lib/mobile/file-server';
import { projectVerificationCenter } from '@/lib/mobile/file-contract.js';
import { getVerificationCenter, submitVerification } from '@/lib/verification.js';
export const runtime = 'nodejs';
const command = z.object({ subjectId: z.string().uuid(), subjectType: z.enum(['ORGANIZATION', 'PROVIDER_PROFILE', 'DRIVER', 'VEHICLE']), verificationType: z.enum(['IDENTITY', 'BUSINESS_LICENSE', 'BUSINESS_ADDRESS', 'DRIVER_IDENTITY', 'VEHICLE_OWNERSHIP', 'VEHICLE_AUTHORIZATION']), documentName: z.string().trim().min(1).max(150), relatedVehicleId: z.union([z.string().uuid(), z.literal('')]).default(''), expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).default('') }).strict();
export async function GET(request: Request) {
 try { const user = await mobileActor(request); return mobileJson(projectVerificationCenter(await getVerificationCenter(user))); } catch (error) { return mobileFailure(error); }
}
export async function POST(request: Request) {
 try { const user = await mobileActor(request), upload = await mobileUpload(request), parsed = command.safeParse(upload.command);
  if (!parsed.success) throw new MobileError(400, 'INVALID_INPUT', 'Check the document details.');
  const input = parsed.data, center = projectVerificationCenter(await getVerificationCenter(user));
  const subject = center.subjects.find((item: { id: string; kind: string; allowedTypes: string[]; vehicles: { id: string }[] }) => item.id === input.subjectId && item.kind === input.subjectType);
  if (!subject) throw new MobileError(403, 'FORBIDDEN', 'You cannot submit documents for this profile or truck.');
  if (!subject.allowedTypes.includes(input.verificationType)) throw new MobileError(409, 'CHANGED', 'This document is already submitted or is not available. Refresh your documents.');
  if (input.verificationType === 'VEHICLE_AUTHORIZATION') {
   const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Addis_Ababa', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
   if (!input.expiresOn || input.expiresOn <= today || (input.subjectType === 'VEHICLE' ? input.relatedVehicleId !== input.subjectId : !subject.vehicles.some((item: { id: string }) => item.id === input.relatedVehicleId))) throw new MobileError(400, 'INVALID_INPUT', 'Choose the truck and a future permission expiry date.');
  }
  try { await submitVerification(user, input, upload.file); } catch (error) { fileFailure(error); }
  return mobileJson({ ok: true });
 } catch (error) { return mobileFailure(error); }
}
