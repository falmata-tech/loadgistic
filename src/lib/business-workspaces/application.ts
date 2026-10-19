import {businessId,businessCreation,businessCommand,businessSearch} from './domain.js';
import type {BusinessWorkspacePort} from './contracts';

// The actor ID is supplied only by a verified inbound identity adapter. A
// context returned earlier is never accepted as proof of current membership.
export function businessWorkspaceService(port:BusinessWorkspacePort){
 return {
  context:(actorId:string)=>port.context(businessId(actorId)),
  create:(actorId:string,input:unknown)=>port.create(businessId(actorId),businessCreation(input)),
  select:(actorId:string,workspaceId:unknown)=>port.select(businessId(actorId),workspaceId===null?null:businessId(workspaceId)),
  directory:(actorId:string,workspaceId:unknown)=>port.directory(businessId(actorId),businessId(workspaceId)),
  command:(actorId:string,workspaceId:unknown,input:unknown)=>port.command(businessId(actorId),businessId(workspaceId),businessCommand(input)),
  accept:(actorId:string,invitationId:unknown)=>port.accept(businessId(actorId),businessId(invitationId)),
  search:(actorId:string,query:unknown)=>port.search(businessId(actorId),businessSearch(query))
 };
}
