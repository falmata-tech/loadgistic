/** Client-safe contracts shared by web and future native adapters. */
export type TransportChatMessage={id:string;sequence:number;sender_kind:'VISITOR'|'BROKER';body:string;created_at:string;sender_name:string|null};
export type TransportChatSnapshot={request:{id:string;origin:string;destination:string;status:'NEW'|'CONTACTED'|'CLOSED';assignedName:string|null;updatedAt:string;endedAt:string|null;expiresAt:string};messages:TransportChatMessage[];hasMore:boolean;staffDetails?:{name:string;phone:string;version:number;followUpNote:string}};
