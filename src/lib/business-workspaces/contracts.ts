export type BusinessKind='BROKER'|'SHIPPER'|'RECEIVER';
export type BusinessMemberRole='OWNER'|'ADMIN'|'STAFF';
export type BusinessPermissions={capacity:boolean;tracking:boolean;team:boolean;owner:boolean};
export interface BusinessWorkspaceSummary {
 id:string;name:string;handle:string;kind:BusinessKind;city:string|null;version:number;
 actorId:string;actorRole:'CUSTOMER';membershipRole:BusinessMemberRole;membershipRevision:number;permissions:BusinessPermissions;
}
export interface BusinessInvitation {
 id:string;workspaceId:string;businessName:string;handle:string;role:'ADMIN'|'STAFF';capacity:boolean;tracking:boolean;expiresAt:string;
}
export interface BusinessWorkspaceContext {
 actorId:string;selectedWorkspaceId:string|null;workspaces:BusinessWorkspaceSummary[];invitations:BusinessInvitation[];
}
export interface BusinessMember {
 userId:string;firstName:string;role:BusinessMemberRole;active:boolean;revision:number;capacity:boolean;tracking:boolean;email?:string;erased?:true;
}
export interface BusinessPendingInvitation {
 id:string;email:string;role:'ADMIN'|'STAFF';capacity:boolean;tracking:boolean;status:'PENDING'|'EXPIRED';expiresAt:string;emailSentAt:string|null;
}
export interface BusinessWorkspaceDirectory {workspace:BusinessWorkspaceSummary;members:BusinessMember[];invitations:BusinessPendingInvitation[]}
export interface BusinessPublicIdentity {id:string;name:string;handle:string;kind:BusinessKind;city:string|null}
export interface BusinessCreateInput {name:string;handle:string;kind:BusinessKind;city?:string|null}
export type BusinessCommand =
 | {action:'UPDATE_DETAILS';expectedVersion:number;name:string;city:string|null}
 | {action:'INVITE';expectedVersion:number;email:string;role:'ADMIN'|'STAFF';capacity:boolean;tracking:boolean}
 | {action:'UPDATE_MEMBER';expectedVersion:number;userId:string;role:'ADMIN'|'STAFF';capacity:boolean;tracking:boolean;active:boolean}
 | {action:'REMOVE_MEMBER'|'TRANSFER_OWNERSHIP';expectedVersion:number;userId:string}
 | {action:'REVOKE_INVITATION';expectedVersion:number;invitationId:string}
 | {action:'LEAVE'|'ARCHIVE';expectedVersion:number};
export type BusinessInvitationDelivery='SENT'|'FAILED'|'PENDING';
export interface BusinessEmailLease {id:string;workspaceId:string;email:string;businessName:string;expiresAt:string;lease:string}
export interface BusinessCommandResult {workspaceId:string;version:number;action:BusinessCommand['action'];invitationId?:string;delivery?:BusinessInvitationDelivery}
export interface BusinessWorkspacePort {
 context(actorId:string):Promise<BusinessWorkspaceContext>;
 create(actorId:string,input:BusinessCreateInput):Promise<BusinessWorkspaceSummary>;
 select(actorId:string,workspaceId:string|null):Promise<BusinessWorkspaceSummary|null>;
 directory(actorId:string,workspaceId:string):Promise<BusinessWorkspaceDirectory>;
 command(actorId:string,workspaceId:string,input:BusinessCommand):Promise<BusinessCommandResult>;
 accept(actorId:string,invitationId:string):Promise<BusinessWorkspaceSummary>;
 search(actorId:string,query:string):Promise<BusinessPublicIdentity[]>;
 claimInvitationEmail(actorId:string,workspaceId:string,invitationId:string):Promise<BusinessEmailLease|null>;
 recordInvitationEmail(actorId:string,workspaceId:string,invitationId:string,leaseId:string,sent:boolean):Promise<boolean>;
}
