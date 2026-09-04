// Compatibility endpoint retained for stale clients; all Google starts use
// the unified access intent, cookies, rate limit, and callback contract.
export {POST} from '@/app/api/applications/google/route';

export const runtime='nodejs';
