import {z} from 'zod';
/** Private request proof only. Never include it in a customer/map response. */
export const phoneObservation=z.object({accuracyMeters:z.number().finite().min(0).max(40000).nullable().optional(),speedKph:z.number().finite().min(0).max(300).nullable().optional(),headingDegrees:z.number().finite().min(0).lt(360).nullable().optional()}).strict();
export const phoneInstallationProof=phoneObservation.extend({installationId:z.string().uuid(),secret:z.string().regex(/^[a-f0-9]{64}$/),bindingId:z.string().uuid(),revision:z.string().uuid(),reportId:z.string().uuid(),observedAt:z.number().int().nonnegative().max(8640000000000000)}).strict();
