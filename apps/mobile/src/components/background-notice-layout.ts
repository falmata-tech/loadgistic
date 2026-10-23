import {createContext} from 'react';

// Only the in-flow navigation header shares this inset with the global notice.
// Full-window modals continue to use the device's original safe-area context.
export const BackgroundNoticeLayout=createContext(false);
