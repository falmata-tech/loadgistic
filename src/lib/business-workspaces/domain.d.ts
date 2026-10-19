import type {BusinessCreateInput,BusinessCommand} from './contracts';
export class BusinessWorkspaceError extends Error {code:string;constructor(code:string)}
export function businessId(input:unknown):string;
export function businessCreation(input:unknown):BusinessCreateInput;
export function businessCommand(input:unknown):BusinessCommand;
export function businessSearch(input:unknown):string;
export function businessCacheKey(actorId:unknown,workspaceId:unknown,membershipRevision:unknown):string;
