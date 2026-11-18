// November17: anonymous email grants cannot authorize Tracking.
import {retiredTrackingAccess} from '@/lib/tracking-sessions/http';
export const runtime='nodejs';
export const POST=()=>retiredTrackingAccess();
