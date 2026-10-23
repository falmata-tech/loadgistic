export type TeamService='support'|'brokerage';
export function teamQueuePath(service:TeamService,role:string,options?:{queue?:unknown;view?:unknown;page?:unknown}):string;
export function teamQueueReturnPath(value:unknown,service:TeamService,role:string):string;
export function teamConversationHref(service:TeamService,id:string,returnTo:string):string;
export function supportConversationReturnPath(value:unknown,role:string):string;
