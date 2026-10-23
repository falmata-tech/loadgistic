import {managedBusinessContext} from './identity/business-context.js';
import {z} from 'zod';
import {normalizePersonalName} from './personal-identity.js';

const phone=z.string().trim().max(32).refine(value=>value===''||
  (/^[0-9+() .-]+$/.test(value)&&value.replace(/\D/g,'').length>=7));
const personalName=z.string().transform(normalizePersonalName).pipe(z.string().max(100).refine(value=>!/[\x00-\x1f\x7f]/.test(value)));
const accountDetails=z.union([
  z.object({name:z.string().trim().min(2).max(100).refine(value=>!/[\x00-\x1f\x7f]/.test(value)),phone}).strict(),
  z.object({firstName:personalName.pipe(z.string().min(1)),lastName:personalName,phone,publicCallbackPhone:phone.optional()}).strict()
    .refine(value=>[value.firstName,value.lastName].filter(Boolean).join(' ').length<=100)
]);

export function parseAccountDetails(value){
  const result=accountDetails.safeParse(value);
  if(!result.success)throw new Error('INVALID_ACCOUNT_DETAILS');
  return result.data;
}

export function canEditAccountDetails(user){
  return Boolean(user?.active&&(['DRIVER','TRANSPORTER','ADMIN'].includes(user.role)||managedBusinessContext(user)));
}
