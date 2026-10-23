export type BusinessWorkspaceIdentity = {
  id:string;name:string;handle:string;kind:'BROKER'|'SHIPPER'|'RECEIVER';city:string|null;
  version:number;actorId:string;actorRole:'CUSTOMER';membershipRole:'OWNER'|'ADMIN'|'STAFF';membershipRevision:number;
  permissions:{capacity:boolean;tracking:boolean;team:boolean;owner:boolean};
};
export type BusinessInvitationIdentity = {id:string;workspaceId:string;businessName:string;handle:string;role:'ADMIN'|'STAFF';capacity:boolean;tracking:boolean;expiresAt:string};
export type AccountSession = {
  accessToken: string; refreshToken: string; expiresAt: number;
  state: 'ACTIVE' | 'JOIN_FLEET' | 'ONBOARDING';
  user: { id: string; name: string; email: string; role: string; platformRole?:string;providerWorkspaceAvailable?:boolean;businessWorkspaceEligible?:boolean;businessWorkspaces?:BusinessWorkspaceIdentity[];businessInvitations?:BusinessInvitationIdentity[];selectedBusinessWorkspace?:BusinessWorkspaceIdentity|null; providerAccountName?:string|null;organizationName: string | null; businessName: string | null; operatingModel?: string | null; review?:true; ownsProviderAccount?:boolean; canManageFleet?:boolean; drivesTruck?:boolean; currentDriverId?:string|null; currentDrivenVehicleId?:string|null };
  access: { granted: boolean; status: string } | null;
};
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid sign-in response');
  return value as Record<string, unknown>;
};
const text = (value: unknown, max = 8192): string => {
  if (typeof value !== 'string' || !value.length || value.length > max) throw new Error('Invalid sign-in response');
  return value;
};
const optional = (value: unknown) => value === null ? null : text(value, 200);
export function parseSession(value: unknown): AccountSession {
  const data = record(value), user = record(data.user);
  const state = text(data.state), role = text(user.role);
  if (!['ACTIVE', 'JOIN_FLEET', 'ONBOARDING'].includes(state) || ['ADMIN', 'SUPPORT'].includes(role) || (state === 'ACTIVE' && !['DRIVER', 'TRANSPORTER','CUSTOMER'].includes(role))) throw new Error('Invalid sign-in response');
  if (typeof data.expiresAt !== 'number' || !Number.isFinite(data.expiresAt) || data.expiresAt <= 0) throw new Error('Invalid sign-in response');
  const access = state === 'ACTIVE' ? record(data.access) : null;
  if (access && (typeof access.granted !== 'boolean' || typeof access.status !== 'string')) throw new Error('Invalid sign-in response');
  const business = parseBusinessIdentity(user, text(user.id,128), role);
  const capabilities: Pick<AccountSession['user'],'ownsProviderAccount'|'canManageFleet'|'drivesTruck'|'currentDriverId'|'currentDrivenVehicleId'> = {};
  if (['ownsProviderAccount','canManageFleet','drivesTruck','currentDriverId','currentDrivenVehicleId'].some(key => key in user)) {
    for (const key of ['ownsProviderAccount','canManageFleet','drivesTruck'] as const) {
      if (typeof user[key] !== 'boolean') throw new Error('Invalid sign-in response');
      capabilities[key] = user[key];
    }
    for (const key of ['currentDriverId','currentDrivenVehicleId'] as const) capabilities[key] = optional(user[key]);
    if (capabilities.canManageFleet && !capabilities.ownsProviderAccount
      || capabilities.currentDrivenVehicleId && !capabilities.currentDriverId
      || state !== 'ACTIVE' && (capabilities.ownsProviderAccount || capabilities.canManageFleet || capabilities.currentDriverId)
      || user.operatingModel === 'COMPANY_DRIVER' && capabilities.ownsProviderAccount) throw new Error('Invalid sign-in response');
  }
  return {
    accessToken: text(data.accessToken), refreshToken: text(data.refreshToken), expiresAt: data.expiresAt,
    state: state as AccountSession['state'],
    user: { id: text(user.id, 128), name: text(user.name, 200), email: text(user.email, 254), role,...(user.providerAccountName!==undefined?{providerAccountName:optional(user.providerAccountName)}:{}), organizationName: optional(user.organizationName), businessName: optional(user.businessName), operatingModel: ['COMPANY_DRIVER','OWNER_OPERATOR','SELF_MANAGED_DRIVER','FLEET_TRANSPORTER'].includes(String(user.operatingModel)) ? String(user.operatingModel) : null,...(user.review===true?{review:true as const}:{}),...capabilities,...business },
    access: access ? { granted: access.granted as boolean, status: access.status as string } : null,
  };
}

function parseBusinessIdentity(user:Record<string,unknown>,actorId:string,role:string):Pick<AccountSession['user'],'platformRole'|'providerWorkspaceAvailable'|'businessWorkspaceEligible'|'businessWorkspaces'|'businessInvitations'|'selectedBusinessWorkspace'> {
  const supplied=['platformRole','businessWorkspaces','selectedBusinessWorkspace','businessInvitations','providerWorkspaceAvailable'].some(key=>key in user);
  if(!supplied){if(role==='CUSTOMER')throw new Error('Invalid sign-in response');return {};}
  const platformRole=text(user.platformRole,40);
  if(['ADMIN','SUPPORT','CUSTOMER'].includes(platformRole)||typeof user.providerWorkspaceAvailable!=='boolean'||typeof user.businessWorkspaceEligible!=='boolean'||!Array.isArray(user.businessWorkspaces)||!Array.isArray(user.businessInvitations))throw new Error('Invalid sign-in response');
  const workspaces=user.businessWorkspaces.map(raw=>{
    const row=record(raw),permissions=record(row.permissions);
    if(row.actorId!==actorId||row.actorRole!=='CUSTOMER'||!['BROKER','SHIPPER','RECEIVER'].includes(String(row.kind))||!['OWNER','ADMIN','STAFF'].includes(String(row.membershipRole))
      ||!Number.isSafeInteger(row.version)||Number(row.version)<1||!Number.isSafeInteger(row.membershipRevision)||Number(row.membershipRevision)<1
      ||['capacity','tracking','team','owner'].some(key=>typeof permissions[key]!=='boolean')
      ||permissions.owner!==(row.membershipRole==='OWNER')||permissions.team!==['OWNER','ADMIN'].includes(String(row.membershipRole)))throw new Error('Invalid sign-in response');
    return {id:text(row.id,128),name:text(row.name,100),handle:text(row.handle,60),kind:row.kind,city:optional(row.city),version:row.version,actorId,actorRole:'CUSTOMER',membershipRole:row.membershipRole,membershipRevision:row.membershipRevision,
      permissions:{capacity:permissions.capacity,tracking:permissions.tracking,team:permissions.team,owner:permissions.owner}} as BusinessWorkspaceIdentity;
  });
  if(new Set(workspaces.map(item=>item.id)).size!==workspaces.length)throw new Error('Invalid sign-in response');
  const invitations=user.businessInvitations.map(raw=>{
    const row=record(raw);if(!['ADMIN','STAFF'].includes(String(row.role))||typeof row.capacity!=='boolean'||typeof row.tracking!=='boolean'||!Number.isFinite(Date.parse(String(row.expiresAt))))throw new Error('Invalid sign-in response');
    return {id:text(row.id,128),workspaceId:text(row.workspaceId,128),businessName:text(row.businessName,100),handle:text(row.handle,60),role:row.role,capacity:row.capacity,tracking:row.tracking,expiresAt:text(row.expiresAt,100)} as BusinessInvitationIdentity;
  });
  const rawSelected=user.selectedBusinessWorkspace;
  let selected:BusinessWorkspaceIdentity|null=null;
  if(rawSelected!==null){const row=record(rawSelected);selected=workspaces.find(item=>item.id===row.id)||null;
    if(!selected||row.actorId!==actorId||row.actorRole!=='CUSTOMER'||row.membershipRevision!==selected.membershipRevision)throw new Error('Invalid sign-in response');}
  if(role==='CUSTOMER'&&!selected||role!=='CUSTOMER'&&selected)throw new Error('Invalid sign-in response');
  if(role==='CUSTOMER'&&(user.ownsProviderAccount||user.canManageFleet||user.drivesTruck||user.currentDriverId||user.currentDrivenVehicleId))throw new Error('Invalid sign-in response');
  return {platformRole,providerWorkspaceAvailable:user.providerWorkspaceAvailable,businessWorkspaceEligible:user.businessWorkspaceEligible,businessWorkspaces:workspaces,businessInvitations:invitations,selectedBusinessWorkspace:selected};
}
