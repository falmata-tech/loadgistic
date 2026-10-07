import {z} from 'zod';
export const portraitUpload=z.object({action:z.literal('UPLOAD'),consent:z.literal(true)}).strict();
export const portraitRemove=z.object({action:z.literal('REMOVE'),confirm:z.literal(true)}).strict();
