import type {ChatAlertSnapshot,ChatAlertEvent} from './chat-alert-contract';
export function createChatAlertTracker():{reset():void;next(snapshot:ChatAlertSnapshot):ChatAlertEvent[]};
export function chatAlertCopy(change:ChatAlertEvent):string;
