import {z} from 'zod';

const accountDetails=z.object({
  name:z.string().trim().min(2).max(100).refine(value=>!/[\x00-\x1f\x7f]/.test(value)),
  phone:z.string().trim().max(32).refine(value=>value===''||
    (/^\+?[0-9 ()-]+$/.test(value)&&value.replace(/\D/g,'').length>=7))
}).strict();

export function parseAccountDetails(value){
  const result=accountDetails.safeParse(value);
  if(!result.success)throw new Error('INVALID_ACCOUNT_DETAILS');
  return result.data;
}

export function canEditAccountDetails(user){
  return Boolean(user?.active&&['DRIVER','TRANSPORTER','ADMIN'].includes(user.role));
}
