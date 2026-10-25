import {mobileFailure,MobileError} from '@/lib/mobile/server';
export const runtime='nodejs';
export async function GET(){
 return mobileFailure(new MobileError(410,'ACCOUNT_REQUIRED','Sign in to view Shared capacity.'));
}
