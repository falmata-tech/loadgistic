export type ChatKind='SUPPORT'|'BROKERAGE';
export type ChatReadState={customerSeen:number;teamSeen:number;ownSeen:number;latestSequence:number;ownSide:'CUSTOMER'|'TEAM';unreadCount:number;teamJoined:boolean;joinedAt:string|null;assignmentVersion:number};
export type ChatAlertItem={kind:ChatKind;id:string;status:string;side:'CUSTOMER'|'TEAM';queued:boolean;assigned:boolean;assignedName:string|null;assignmentVersion:number;teamJoined:boolean;unreadCount:number;incomingSequence:number;endedAt:string|null;chatEnabled:boolean;updatedAt:string};
export type ChatAlertSnapshot={unreadCount:number;waitingCount:number;items:ChatAlertItem[]};
export type ChatReadAuthority={kind:ChatKind;id:string;actorId:string|null;digest?:string|null};
export type ChatAlertEvent={item:ChatAlertItem;event:'MESSAGE'|'ASSIGNED'|'JOINED'|'QUEUED'|'ENDED'|'RESOLVED'};
