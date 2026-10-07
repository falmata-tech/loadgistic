import { MobileError,mobileFailure } from './server';
export function brokerageFailure(error:unknown){
 if(error instanceof MobileError)return mobileFailure(error);
 const code=error instanceof Error?error.message:'';
 if(code==='FORBIDDEN')return mobileFailure(new MobileError(403,'CHAT_UNAVAILABLE','This conversation is no longer available on this phone.'));
 if(['TRANSPORT_CHAT_CLOSED','TRANSPORT_CHAT_ENDED'].includes(code))return mobileFailure(new MobileError(409,'CHAT_ENDED','This chat has ended. Our team can still follow up by phone.'));
 if(error instanceof Error&&error.name==='ZodError'||['INVALID_TRANSPORT_REQUEST','INVALID_TRANSPORT_MESSAGE'].includes(code))return mobileFailure(new MobileError(400,'INVALID_INPUT','Check the request details or enter a message of up to 2,000 characters.'));
 return mobileFailure(error);
}
