import type {ChatReadState,ChatAlertSnapshot,ChatAlertItem} from './chat-alert-contract';
export function chatReadInput(value:unknown):{throughSequence:number;assignmentVersion:number};
export function chatConversationId(value:unknown):string;
export function chatReadState(value:unknown):ChatReadState;
export function chatAlertSnapshot(value:unknown):ChatAlertSnapshot;
export function chatAlertChanges(previous:ChatAlertSnapshot|null,next:ChatAlertSnapshot):{item:ChatAlertItem;event:'MESSAGE'|'ASSIGNED'|'JOINED'|'QUEUED'|'ENDED'|'RESOLVED'}[];
export function chatAlertHref(item:ChatAlertItem):string;
export function mergeChatReadState(previous:ChatReadState|null,next:ChatReadState):ChatReadState;
export function visibleChatSequence(input:{active:boolean;focused:boolean;offset:number;height:number;messages:{sequence:number;top:number;height:number}[]}):number|null;
