import {providerTrackingRecipientDigest} from '../security.js';
import {TrackingSharingError,type OwnerVerification} from './domain';

/** The workspace detail check is authoritative; a matching email alone is not access. */
export function accountOwnerVerification(email:string,isOwner:boolean,now=Date.now()):OwnerVerification{
 if(!isOwner)throw new TrackingSharingError('TRACKING_APPROVAL_FORBIDDEN');
 return {digest:providerTrackingRecipientDigest(email),startedAt:now};
}
